'use strict'
// integration-bus — recebe eventos de qualquer sistema,
// normaliza e distribui para metrics_db + crm + logs + redis
const express  = require('express')
const { Pool } = require('pg')
const Redis    = require('ioredis')
const crypto   = require('crypto')

const app  = express()
const PORT = process.env.PORT || 8080
app.use(express.json({ limit: '2mb' }))

const pgMetrics = new Pool({ connectionString: process.env.DB_METRICS_URL, ssl: false, max: 5 })
const pgCrm     = new Pool({ connectionString: process.env.DB_SUITECRM_URL, ssl: false, max: 3 })
const redis     = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null })

// ── Adapters por source ──────────────────────────────────────
const ADAPTERS = {

  hotmart: (body) => ({
    event_type:     mapHotmartEvent(body.event),
    entity_type:    'payment',
    entity_id:      body.data?.purchase?.transaction,
    amount:         body.data?.purchase?.price?.value,
    currency:       body.data?.purchase?.price?.currency_value || 'BRL',
    customer_email: body.data?.buyer?.email,
    customer_name:  body.data?.buyer?.name,
    customer_doc:   body.data?.buyer?.document,
    metadata:       body,
  }),

  kiwify: (body) => ({
    event_type:     body.webhook_event_type === 'order_approved' ? 'payment.received' : body.webhook_event_type,
    entity_type:    'payment',
    entity_id:      body.order_id,
    amount:         parseFloat(body.order_total_amount || 0) / 100,
    currency:       'BRL',
    customer_email: body.Customer?.email,
    customer_name:  body.Customer?.full_name,
    customer_doc:   body.Customer?.CPF,
    metadata:       body,
  }),

  eduzz: (body) => ({
    event_type:     body.key === 'BILLET_PAID' || body.key === 'SALE_APPROVED' ? 'payment.received' : body.key?.toLowerCase().replace('_', '.'),
    entity_type:    'payment',
    entity_id:      String(body.trans_cod || body.sale_id || ''),
    amount:         parseFloat(body.trans_paid || body.sale_price || 0),
    currency:       'BRL',
    customer_email: body.cli_email,
    customer_name:  body.cli_nome,
    customer_doc:   body.cli_cpf,
    metadata:       body,
  }),

  stripe: (body) => ({
    event_type:     body.type?.replace('.', '_') === 'payment_intent_succeeded' ? 'payment.received' : body.type,
    entity_type:    body.type?.startsWith('customer.subscription') ? 'subscription' : 'payment',
    entity_id:      body.data?.object?.id,
    amount:         (body.data?.object?.amount || body.data?.object?.amount_paid || 0) / 100,
    currency:       (body.data?.object?.currency || 'brl').toUpperCase(),
    customer_email: body.data?.object?.customer_email || body.data?.object?.billing_details?.email,
    customer_name:  body.data?.object?.billing_details?.name,
    metadata:       body,
  }),

  custom: (body) => ({
    event_type:     body.event_type || body.event || 'custom.event',
    entity_type:    body.entity_type || 'custom',
    entity_id:      body.entity_id || body.id,
    amount:         parseFloat(body.amount || 0),
    currency:       body.currency || 'BRL',
    customer_email: body.customer_email || body.email,
    customer_name:  body.customer_name || body.name,
    customer_doc:   body.customer_doc || body.document,
    metadata:       body,
  }),
}

function mapHotmartEvent(event) {
  const map = {
    'PURCHASE_APPROVED':     'payment.received',
    'PURCHASE_REFUNDED':     'payment.refunded',
    'PURCHASE_CHARGEBACK':   'payment.chargeback',
    'SUBSCRIPTION_CANCELLATION': 'subscription.cancelled',
    'PURCHASE_COMPLETE':     'payment.received',
  }
  return map[event] || event?.toLowerCase().replace('_', '.')
}

async function authIntegration(req, res, next) {
  const key     = req.headers['x-kosh-key'] || req.headers['authorization']?.replace(/^Bearer\s+/i, '')
  if (!key) return res.status(401).json({ error: 'x-kosh-key header obrigatório' })

  const { rows } = await pgMetrics.query(
    `SELECT * FROM integrations WHERE api_key=$1 AND active=true LIMIT 1`,
    [key]
  ).catch((err) => {
    console.error('[Auth Error]', err.message);
    return { rows: [] };
  })

  if (!rows.length) return res.status(401).json({ error: 'API key inválida' })

  req.integration = rows[0]
  req.projectSlug = rows[0].project_slug
  next()
}

app.post('/integrations/event/:source?', authIntegration, async (req, res) => {
  const source  = req.params.source || req.integration.source
  const project = req.projectSlug

  res.json({ ok: true, source, project })

  try {
    const adapter    = ADAPTERS[source] || ADAPTERS.custom
    const normalized = adapter(req.body)

    const { rows } = await pgMetrics.query(`
      INSERT INTO integration_events
        (project_slug, source, event_type, entity_type, entity_id,
         amount, currency, customer_email, customer_name, customer_doc, metadata)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING id
    `, [
      project, source,
      normalized.event_type, normalized.entity_type, normalized.entity_id,
      normalized.amount, normalized.currency,
      normalized.customer_email, normalized.customer_name, normalized.customer_doc,
      JSON.stringify(normalized.metadata),
    ])
    const eventId = rows[0]?.id

    if (['payment.received', 'payment.confirmed'].includes(normalized.event_type) && normalized.amount > 0) {
      const { rows: custRows } = await pgMetrics.query(`
        INSERT INTO customers
          (project_slug, external_id, source, name, email, document, acquired_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (project_slug, source, external_id)
        DO UPDATE SET name=COALESCE(EXCLUDED.name, customers.name),
                      email=COALESCE(EXCLUDED.email, customers.email)
        RETURNING id
      `, [
        project,
        normalized.customer_email || normalized.entity_id,
        source, normalized.customer_name,
        normalized.customer_email, normalized.customer_doc,
      ])

      await pgMetrics.query(`
        INSERT INTO payments
          (project_slug, customer_id, external_id, source, amount, currency, status, paid_at, metadata)
        VALUES ($1,$2,$3,$4,$5,$6,'paid',NOW(),$7)
        ON CONFLICT (source, external_id) DO UPDATE SET status='paid', paid_at=NOW()
      `, [
        project, custRows[0]?.id,
        normalized.entity_id || String(eventId), source,
        normalized.amount, normalized.currency,
        JSON.stringify(normalized.metadata),
      ])
    }

    await redis.publish('kosh:integration:event', JSON.stringify({
      project, source, event_type: normalized.event_type,
      amount: normalized.amount, customer_email: normalized.customer_email,
      ts: new Date().toISOString(),
    }))

    await pgMetrics.query(
      `UPDATE integration_events SET processed=true WHERE id=$1`, [eventId]
    )

    console.log(`[Bus] ✓ ${source} ${normalized.event_type} project=${project} R$${normalized.amount || 0}`)
  } catch (err) {
    console.error(`[Bus] Erro:`, err.message)
  }
})

app.use('/integrations/manage', (req, res, next) => {
  const token = req.headers['authorization']?.replace(/^Bearer\s+/i, '')
  if (token !== process.env.PANEL_SECRET) return res.status(401).json({ error: 'Unauthorized' })
  next()
})

app.get('/integrations/manage', async (req, res) => {
  const { project } = req.query
  const { rows } = await pgMetrics.query(
    `SELECT id, project_slug, source, name, webhook_url, active, created_at
     FROM integrations WHERE project_slug=$1 ORDER BY created_at DESC`,
    [project]
  )
  res.json(rows)
})

app.post('/integrations/manage', async (req, res) => {
  const { project_slug, source, name } = req.body
  const api_key    = crypto.randomBytes(24).toString('hex')
  const PUBLIC_URL = process.env.PUBLIC_URL || 'https://registry.cspfood.com.br'
  const webhook_url = `${PUBLIC_URL}/integrations/event/${source}?project=${project_slug}`

  const { rows } = await pgMetrics.query(`
    INSERT INTO integrations (project_slug, source, name, api_key, webhook_url)
    VALUES ($1,$2,$3,$4,$5) RETURNING id, api_key, webhook_url
  `, [project_slug, source, name, api_key, webhook_url])

  res.json({ ...rows[0], message: 'Salve a api_key — não será exibida novamente' })
})

app.delete('/integrations/manage/:id', async (req, res) => {
  await pgMetrics.query(`UPDATE integrations SET active=false WHERE id=$1`, [req.params.id])
  res.json({ ok: true })
})

app.get('/health', (req, res) => res.json({ ok: true }))
app.listen(PORT, '0.0.0.0', () => console.log(`[Integration Bus] Porta ${PORT}`))
