// ═══════════════════════════════════════════════════════════
//  webhooks/routes/banking.js
//  Auth: Bearer PANEL_SECRET
//  Prefix: /banking
// ═══════════════════════════════════════════════════════════
'use strict'

const express = require('express')
const crypto  = require('crypto')

const { AsaasClient, rootClient } = require('./asaas')
const { interClient }             = require('./inter')

module.exports = function bankingRouter({ pg, redis }) {
  const router = express.Router()

  // ── ASAAS ─────────────────────────────────────────────────

  // GET /banking/asaas/balance
  router.get('/asaas/balance', async (req, res) => {
    try {
      const data = await rootClient.getBalance()
      res.json({ balance: data.balance, totalOutTransfers: data.totalOutTransfers, source: 'asaas' })
    } catch (e) { res.status(502).json({ error: e.message }) }
  })

  // POST /banking/asaas/refund — { paymentId, value?, projectSlug? }
  // value omitido = estorno total
  router.post('/asaas/refund', async (req, res) => {
    const { paymentId, value, projectSlug } = req.body
    if (!paymentId) return res.status(400).json({ error: 'paymentId obrigatório' })
    try {
      const subKey = await getSubAccountKey(pg, projectSlug)
      const client = subKey ? new AsaasClient(subKey) : rootClient
      const result = await client.refundPayment(paymentId, value)
      await pg.query(`
        UPDATE payments
        SET status = CASE WHEN $2::numeric IS NULL THEN 'refunded' ELSE 'partial_refund' END,
            metadata = metadata || $3
        WHERE source='asaas' AND external_id=$1
      `, [paymentId, value || null, JSON.stringify({ refundedAt: new Date(), refundValue: value, result })])
      res.json({ ok: true, result })
    } catch (e) { res.status(502).json({ error: e.message, detail: e.data }) }
  })

  // POST /banking/asaas/subaccounts — cria subconta para um projeto
  // Body: { projectSlug, name, email, cpfCnpj, birthDate, companyType, phone, address, ... }
  router.post('/asaas/subaccounts', async (req, res) => {
    const { projectSlug, ...accountData } = req.body
    if (!projectSlug) return res.status(400).json({ error: 'projectSlug obrigatório' })
    try {
      const account = await rootClient.createSubAccount({
        ...accountData,
        webhooks: [{
          name:       `Kosh - ${projectSlug}`,
          url:        `${process.env.PUBLIC_URL}/webhooks/asaas?project=${projectSlug}`,
          email:      accountData.email,
          sendType:   'SEQUENTIALLY',
          interrupted: false,
          enabled:    true,
          apiVersion: 3,
          authToken:  process.env.ASAAS_WEBHOOK_TOKEN,
          events: ['PAYMENT_RECEIVED','PAYMENT_CONFIRMED','PAYMENT_REFUNDED',
                   'SUBSCRIPTION_CREATED','SUBSCRIPTION_CANCELLED','SUBSCRIPTION_UPDATED'],
        }],
      })
      // Persiste no DB — apiKey fica protegida, não retorna no body
      await pg.query(`
        INSERT INTO asaas_accounts (project_slug, account_id, api_key, wallet_id, name)
        VALUES ($1,$2,$3,$4,$5) ON CONFLICT (project_slug) DO UPDATE SET api_key=$3, wallet_id=$4
      `, [projectSlug, account.id, account.apiKey, account.walletId, accountData.name])
        .catch(() => pg.query(
          `UPDATE projects SET metadata=COALESCE(metadata,'{}')::jsonb||$2 WHERE slug=$1`,
          [projectSlug, JSON.stringify({ asaas: { id: account.id, walletId: account.walletId } })]
        ))
      res.json({ id: account.id, walletId: account.walletId })
    } catch (e) { res.status(502).json({ error: e.message, detail: e.data }) }
  })

  // GET /banking/asaas/subaccounts
  router.get('/asaas/subaccounts', async (req, res) => {
    try {
      const { rows } = await pg.query(
        `SELECT project_slug, account_id, wallet_id, name, created_at
         FROM asaas_accounts ORDER BY created_at DESC`
      ).catch(() => ({ rows: [] }))
      if (rows.length) return res.json(rows)
      const data = await rootClient.listSubAccounts()
      res.json(data.data || [])
    } catch (e) { res.status(502).json({ error: e.message }) }
  })

  // GET /banking/asaas/payment/:id
  router.get('/asaas/payment/:id', async (req, res) => {
    try { res.json(await rootClient.getPayment(req.params.id)) }
    catch (e) { res.status(502).json({ error: e.message }) }
  })

  // ── INTER ─────────────────────────────────────────────────

  // GET /banking/inter/saldo
  router.get('/inter/saldo', async (req, res) => {
    try { res.json({ ...(await interClient.getSaldo()), source: 'inter' }) }
    catch (e) { res.status(502).json({ error: e.message }) }
  })

  // GET /banking/inter/extrato?dataInicio=&dataFim=&pagina=
  router.get('/inter/extrato', async (req, res) => {
    try { res.json(await interClient.getExtrato(req.query)) }
    catch (e) { res.status(502).json({ error: e.message }) }
  })

  // POST /banking/inter/devolucao — { e2eId, valor?, descricao? }
  // Devolução PIX — prazo até 90 dias
  router.post('/inter/devolucao', async (req, res) => {
    const { e2eId, valor, descricao } = req.body
    if (!e2eId) return res.status(400).json({ error: 'e2eId obrigatório' })
    try {
      const devId  = crypto.randomUUID()
      const result = await interClient.solicitarDevolucao(e2eId, { id: devId, valor, descricao })
      await pg.query(`
        UPDATE payments
        SET status = CASE WHEN $2 IS NULL THEN 'refunded' ELSE 'partial_refund' END,
            metadata = metadata || $3
        WHERE source='inter' AND external_id=$1
      `, [e2eId, valor || null, JSON.stringify({ devId, devolvido: valor, descricao, result })])
      res.json({ ok: true, devId, result })
    } catch (e) { res.status(502).json({ error: e.message }) }
  })

  // GET /banking/inter/pix/:e2eId
  router.get('/inter/pix/:e2eId', async (req, res) => {
    try { res.json(await interClient.getPix(req.params.e2eId)) }
    catch (e) { res.status(502).json({ error: e.message }) }
  })

  // POST /banking/inter/webhook/setup — configura callback PIX no Inter (1x)
  router.post('/inter/webhook/setup', async (req, res) => {
    const url = req.body.url ||
      `${process.env.PUBLIC_URL}/webhooks/inter/pix?project=${req.body.project || 'unknown'}`
    try {
      res.json({ ok: true, url, result: await interClient.configurarWebhook(url) })
    } catch (e) { res.status(502).json({ error: e.message }) }
  })

  // ── RESUMO FINANCEIRO cross-gateway ─────────────────────────
  // GET /banking/summary?project=gpcerto&days=30
  router.get('/summary', async (req, res) => {
    const { project, days = 30 } = req.query
    try {
      const where = project ? 'AND project_slug=$2' : ''
      const vals  = project ? [days, project] : [days]
      const { rows } = await pg.query(`
        SELECT
          source,
          COUNT(*)                                     AS transactions,
          SUM(amount)                                  AS gross,
          SUM(COALESCE(net_amount, amount * 0.97))     AS net,
          COUNT(*) FILTER (WHERE status='refunded')    AS refunds,
          SUM(amount) FILTER (WHERE status='refunded') AS refund_amount
        FROM payments
        WHERE paid_at >= NOW() - ($1::int * INTERVAL '1 day')
          AND status IN ('paid','received','refunded')
          ${where}
        GROUP BY source
      `, vals)

      // Saldo ao vivo com cache Redis 5 min
      let liveBalance = {}
      if (redis) {
        const key    = `banking:balance:${project || 'all'}`
        const cached = await redis.get(key).catch(() => null)
        if (cached) {
          liveBalance = JSON.parse(cached)
        } else {
          const [a, i] = await Promise.allSettled([
            rootClient.getBalance(),
            interClient.getSaldo(),
          ])
          liveBalance = {
            asaas: a.status === 'fulfilled' ? a.value : null,
            inter: i.status === 'fulfilled' ? i.value : null,
          }
          await redis.setex(key, 300, JSON.stringify(liveBalance)).catch(() => {})
        }
      }

      res.json({ byGateway: rows, liveBalance, period: `${days} days` })
    } catch (e) { res.status(500).json({ error: e.message }) }
  })

  return router
}

async function getSubAccountKey(pg, projectSlug) {
  if (!projectSlug) return null
  try {
    const { rows } = await pg.query(
      `SELECT api_key FROM asaas_accounts WHERE project_slug=$1 LIMIT 1`,
      [projectSlug]
    )
    return rows[0]?.api_key || null
  } catch { return null }
}
