// ═══════════════════════════════════════════════════════════
//  webhooks/routes/asaas.js
//
//  Documentação: https://docs.asaas.com/docs/webhook-para-cobrancas
//  Auth:    header "asaas-access-token"
//  Prod:    https://api.asaas.com/v3
//  Sandbox: https://sandbox.asaas.com/api/v3
//
//  Subcontas: POST /v3/accounts → retorna { apiKey, walletId }
//  Estorno:   POST /v3/payments/{id}/refund
//  Split:     objeto "split" dentro do payload da cobrança
// ═══════════════════════════════════════════════════════════
'use strict'

const express = require('express')
const fetch   = require('node-fetch')

const ASAAS_BASE = process.env.ASAAS_ENV === 'sandbox'
  ? 'https://sandbox.asaas.com/api/v3'
  : 'https://api.asaas.com/v3'

// ── Cliente HTTP Asaas ───────────────────────────────────────
class AsaasClient {
  constructor(apiKey) {
    this.apiKey = apiKey
  }

  async request(method, path, body) {
    const res = await fetch(`${ASAAS_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'access_token': this.apiKey,
        'User-Agent':   'Kosh-Platform/1.0',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw Object.assign(
      new Error(data.errors?.[0]?.description || 'Asaas error'),
      { status: res.status, data }
    )
    return data
  }

  getPayment(id)           { return this.request('GET',  `/payments/${id}`) }
  refundPayment(id, value) { return this.request('POST', `/payments/${id}/refund`, value ? { value } : undefined) }
  getSubscription(id)      { return this.request('GET',  `/subscriptions/${id}`) }
  getCustomer(id)          { return this.request('GET',  `/customers/${id}`) }
  getBalance()             { return this.request('GET',  '/finance/balance') }

  // Cria subconta — retorna { id, apiKey, walletId }
  createSubAccount(data)   { return this.request('POST', '/accounts', data) }
  listSubAccounts()        { return this.request('GET',  '/accounts') }

  // Configura webhook em subcontas recém-criadas
  createWebhook(config) {
    return this.request('POST', '/webhooks', {
      name:        config.name || 'Kosh Webhook',
      url:         config.url,
      email:       config.email,
      sendType:    'SEQUENTIALLY',
      interrupted: false,
      enabled:     true,
      apiVersion:  3,
      authToken:   config.token,
      events: [
        'PAYMENT_CREATED', 'PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED',
        'PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED',
        'PAYMENT_DELETED', 'PAYMENT_UPDATED', 'PAYMENT_OVERDUE',
        'SUBSCRIPTION_CREATED', 'SUBSCRIPTION_UPDATED',
        'SUBSCRIPTION_DELETED', 'SUBSCRIPTION_CANCELLED',
      ],
    })
  }
}

const rootClient = new AsaasClient(process.env.ASAAS_API_KEY)

// ── Helpers DB ───────────────────────────────────────────────
async function upsertCustomer(pg, projectSlug, data) {
  const { rows } = await pg.query(`
    INSERT INTO customers
      (project_slug, external_id, source, name, email, phone, document, acquired_at, metadata)
    VALUES ($1, $2, 'asaas', $3, $4, $5, $6, NOW(), $7)
    ON CONFLICT (project_slug, source, external_id)
    DO UPDATE SET
      name  = COALESCE(EXCLUDED.name,  customers.name),
      email = COALESCE(EXCLUDED.email, customers.email),
      phone = COALESCE(EXCLUDED.phone, customers.phone)
    RETURNING id
  `, [
    projectSlug, data.id || data.customer,
    data.name, data.email,
    data.mobilePhone || data.phone,
    data.cpfCnpj,
    JSON.stringify(data),
  ])
  return rows[0]?.id
}

async function upsertPayment(pg, projectSlug, customerId, p, status) {
  await pg.query(`
    INSERT INTO payments
      (project_slug, customer_id, external_id, source,
       amount, net_amount, currency, status,
       payment_method, subscription_id, paid_at, metadata)
    VALUES ($1,$2,$3,'asaas',$4,$5,'BRL',$6,$7,$8,
      CASE WHEN $6 IN ('paid','received') THEN NOW() ELSE NULL END, $9)
    ON CONFLICT (source, external_id)
    DO UPDATE SET
      status     = EXCLUDED.status,
      net_amount = COALESCE(EXCLUDED.net_amount, payments.net_amount),
      paid_at    = CASE
        WHEN EXCLUDED.status IN ('paid','received') AND payments.paid_at IS NULL
        THEN NOW() ELSE payments.paid_at END,
      metadata   = payments.metadata || EXCLUDED.metadata
  `, [
    projectSlug, customerId, p.id,
    p.value, p.netValue, status,
    p.billingType?.toLowerCase(),
    p.subscription,
    JSON.stringify(p),
  ])
}

async function saveRaw(pg, source, eventType, projectSlug, payload) {
  await pg.query(
    `INSERT INTO webhook_events (source, event_type, project_slug, payload)
     VALUES ($1, $2, $3, $4)`,
    [source, eventType, projectSlug, JSON.stringify(payload)]
  )
}

// ── Handlers de eventos ──────────────────────────────────────
const EVENT_HANDLERS = {

  // Cobrança confirmada (saldo ainda não disponível)
  PAYMENT_CONFIRMED: async (pg, project, body) => {
    const p = body.payment
    const customerId = await upsertCustomer(pg, project, {
      id: p.customer, email: p.customerEmail, name: p.customerName,
    })
    await upsertPayment(pg, project, customerId, p, 'confirmed')
  },

  // Cobrança recebida — EVENTO DEFINITIVO (saldo disponível)
  PAYMENT_RECEIVED: async (pg, project, body) => {
    const p = body.payment
    let customerData = { id: p.customer }
    try { if (p.customer) customerData = await rootClient.getCustomer(p.customer) } catch {}

    const customerId = await upsertCustomer(pg, project, customerData)
    await upsertPayment(pg, project, customerId, p, 'paid')

    // Registra splits se houver
    if (p.split?.length) {
      for (const s of p.split) {
        await pg.query(`
          INSERT INTO payment_splits
            (payment_external_id, source, wallet_id, fixed_value, percent_value, status)
          VALUES ($1, 'asaas', $2, $3, $4, 'pending')
          ON CONFLICT DO NOTHING
        `, [p.id, s.walletId, s.fixedValue, s.percentualValue]).catch(() => {})
      }
    }
  },

  // Estorno / reembolso
  PAYMENT_REFUNDED: async (pg, project, body) => {
    const p = body.payment
    await pg.query(`
      UPDATE payments SET status='refunded', metadata = metadata || $2
      WHERE source='asaas' AND external_id=$1
    `, [p.id, JSON.stringify({ refundedAt: new Date().toISOString(), refundValue: p.refundedValue })])
  },

  // Chargeback
  PAYMENT_CHARGEBACK_REQUESTED: async (pg, project, body) => {
    const p = body.payment
    await pg.query(`
      UPDATE payments SET status='chargeback_requested', metadata = metadata || $2
      WHERE source='asaas' AND external_id=$1
    `, [p.id, JSON.stringify({ chargebackAt: new Date().toISOString() })])
  },

  // Assinatura criada
  SUBSCRIPTION_CREATED: async (pg, project, body) => {
    const s = body.subscription
    const customerId = await upsertCustomer(pg, project, { id: s.customer })
    await pg.query(`
      INSERT INTO subscriptions
        (project_slug, customer_id, external_id, source,
         plan_name, plan_cycle, amount, status, started_at, metadata)
      VALUES ($1,$2,$3,'asaas',$4,$5,$6,'active',NOW(),$7)
      ON CONFLICT (source, external_id) DO NOTHING
    `, [project, customerId, s.id, s.description, s.cycle?.toLowerCase(), s.value, JSON.stringify(s)])
  },

  // Assinatura atualizada
  SUBSCRIPTION_UPDATED: async (pg, project, body) => {
    const s = body.subscription
    await pg.query(`
      UPDATE subscriptions SET plan_name=$2, amount=$3, metadata=metadata || $4
      WHERE source='asaas' AND external_id=$1
    `, [s.id, s.description, s.value, JSON.stringify({ updatedAt: new Date() })])
  },

  // Assinatura cancelada → marca churn se não tem outra ativa
  SUBSCRIPTION_CANCELLED: async (pg, project, body) => {
    const s = body.subscription
    await pg.query(`
      UPDATE subscriptions SET status='cancelled', cancelled_at=NOW()
      WHERE source='asaas' AND external_id=$1
    `, [s.id])
    await pg.query(`
      UPDATE customers c SET churned_at = NOW()
      WHERE source='asaas'
        AND id = (
          SELECT customer_id FROM subscriptions
          WHERE source='asaas' AND external_id=$1
        )
        AND NOT EXISTS (
          SELECT 1 FROM subscriptions
          WHERE customer_id = c.id AND status='active' AND source='asaas'
        )
    `, [s.id])
  },

  SUBSCRIPTION_DELETED: async (pg, project, body) => {
    await pg.query(`
      UPDATE subscriptions SET status='deleted', cancelled_at=NOW()
      WHERE source='asaas' AND external_id=$1
    `, [body.subscription?.id])
  },
}

// ── Factory do router ────────────────────────────────────────
module.exports = function asaasRouter({ pg }) {
  const router = express.Router()

  router.post('/', async (req, res) => {
    const body    = req.body
    const event   = body.event
    const project = req.query.project || body.account?.id || 'unknown'

    // Responde imediatamente — Asaas exige 200 em até 5s
    res.json({ received: true })

    try {
      await saveRaw(pg, 'asaas', event, project, body)
      const handler = EVENT_HANDLERS[event]
      if (handler) {
        await handler(pg, project, body)
        console.log(`[Asaas] ✓ ${event} project=${project}`)
      } else {
        console.log(`[Asaas] Evento não tratado: ${event}`)
      }
    } catch (err) {
      console.error(`[Asaas] Erro em ${event}:`, err.message)
    }
  })

  return router
}

module.exports.AsaasClient = AsaasClient
module.exports.rootClient  = rootClient
