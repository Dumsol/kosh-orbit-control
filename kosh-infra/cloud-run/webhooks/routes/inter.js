// ═══════════════════════════════════════════════════════════
//  webhooks/routes/inter.js
//
//  Documentação: https://developers.inter.co/references/pix
//  Auth:  OAuth 2.0 mTLS
//  Token: POST https://cdpj.partners.bancointer.com.br/oauth/v2/token
//
//  Secrets necessários no Secret Manager:
//    INTER_CERT_PEM        → base64 do .crt
//    INTER_KEY_PEM         → base64 do .key
//    INTER_CLIENT_ID
//    INTER_CLIENT_SECRET
//    INTER_CONTA_CORRENTE  → número da conta PJ
//    INTER_PIX_KEY         → chave PIX cadastrada (CNPJ/email/telefone)
//
//  Escopos usados:
//    extrato.read | pix-pagamento.read | pix-pagamento.write
//    cob.read | cob.write | webhook.read | webhook.write
// ═══════════════════════════════════════════════════════════
'use strict'

const express = require('express')
const https   = require('https')
const fetch   = require('node-fetch')

const API = process.env.INTER_ENV === 'sandbox'
  ? {
      token:   'https://cdpj-sandbox.partners.uatinter.co/oauth/v2/token',
      banking: 'https://cdpj-sandbox.partners.uatinter.co/banking/v2',
      pix:     'https://cdpj-sandbox.partners.uatinter.co/pix/v2',
      cob:     'https://cdpj-sandbox.partners.uatinter.co/cobranca/v3',
    }
  : {
      token:   'https://cdpj.partners.bancointer.com.br/oauth/v2/token',
      banking: 'https://cdpj.partners.bancointer.com.br/banking/v2',
      pix:     'https://cdpj.partners.bancointer.com.br/pix/v2',
      cob:     'https://cdpj.partners.bancointer.com.br/cobranca/v3',
    }

// ════════════════════════════════════════════════════════════
//  InterClient — OAuth2 mTLS com renovação automática de token
// ════════════════════════════════════════════════════════════
class InterClient {
  constructor() {
    this._token      = null
    this._tokenExp   = 0
    this._agent      = null
    this._agentReady = false
  }

  _getAgent() {
    if (this._agentReady) return this._agent
    const certRaw = process.env.INTER_CERT_PEM || ''
    const keyRaw  = process.env.INTER_KEY_PEM  || ''

    if (!certRaw || !keyRaw) {
      console.warn('[Inter] Certificados mTLS não configurados')
      this._agentReady = true
      return null
    }

    // Aceita PEM direto ou base64
    const decode = s => s.includes('-----') ? s : Buffer.from(s, 'base64').toString('utf8')

    this._agent = new https.Agent({
      cert: decode(certRaw),
      key:  decode(keyRaw),
      rejectUnauthorized: true,
    })
    this._agentReady = true
    return this._agent
  }

  async getToken(scopes = 'extrato.read pix-pagamento.read pix-pagamento.write cob.read cob.write') {
    const now = Date.now()
    if (this._token && now < this._tokenExp - 30_000) return this._token

    const agent = this._getAgent()
    const res   = await fetch(API.token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'client_credentials',
        client_id:     process.env.INTER_CLIENT_ID,
        client_secret: process.env.INTER_CLIENT_SECRET,
        scope:         scopes,
      }).toString(),
      agent,
    })

    if (!res.ok) throw new Error(`[Inter] Token error ${res.status}: ${await res.text()}`)
    const data       = await res.json()
    this._token      = data.access_token
    this._tokenExp   = now + (data.expires_in * 1000)
    return this._token
  }

  async request(method, baseKey, path, body, scopes) {
    const token = await this.getToken(scopes)
    const agent = this._getAgent()

    const res = await fetch(`${API[baseKey]}${path}`, {
      method,
      headers: {
        'Authorization':    `Bearer ${token}`,
        'Content-Type':     'application/json',
        'x-conta-corrente': process.env.INTER_CONTA_CORRENTE || '',
      },
      body:  body ? JSON.stringify(body) : undefined,
      agent,
    })

    if (res.status === 204) return {}
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw Object.assign(new Error(data.message || 'Inter API error'), { status: res.status, data })
    return data
  }

  // ── Banking ─────────────────────────────────────────────────
  getSaldo() {
    return this.request('GET', 'banking', '/saldo', null, 'extrato.read')
  }

  getExtrato({ dataInicio, dataFim, pagina = 0, tamanhoPagina = 50 } = {}) {
    const today = new Date().toISOString().slice(0,10)
    const start = dataInicio || new Date(Date.now() - 30*86400000).toISOString().slice(0,10)
    const qs    = new URLSearchParams({ dataInicio: start, dataFim: dataFim || today, pagina, tamanhoPagina })
    return this.request('GET', 'banking', `/extrato?${qs}`, null, 'extrato.read')
  }

  // ── PIX ─────────────────────────────────────────────────────
  getPixRecebidos({ inicio, fim }) {
    const qs = new URLSearchParams({ inicio, fim })
    return this.request('GET', 'pix', `?${qs}`, null, 'pix-pagamento.read')
  }

  getPix(e2eId) {
    return this.request('GET', 'pix', `/${e2eId}`, null, 'pix-pagamento.read')
  }

  // Devolução PIX — prazo: até 90 dias após recebimento
  // PUT /pix/v2/{e2eId}/devolucao/{id}
  // valor parcial (string "10.50") ou omitir para total
  async solicitarDevolucao(e2eId, { id, valor, descricao } = {}) {
    const devId = id || require('crypto').randomUUID()
    const body  = {}
    if (valor)    body.valor     = String(valor)
    if (descricao) body.descricao = descricao
    return this.request('PUT', 'pix', `/${e2eId}/devolucao/${devId}`, body, 'pix-pagamento.write')
  }

  consultarDevolucao(e2eId, devId) {
    return this.request('GET', 'pix', `/${e2eId}/devolucao/${devId}`, null, 'pix-pagamento.read')
  }

  // ── Cobrança PIX (cob) ───────────────────────────────────────
  criarCobrancaPix({ valor, devedor, expiracao = 3600 } = {}) {
    return this.request('POST', 'cob', '', {
      calendario:  { expiracao },
      devedor,
      valor:       { original: String(valor) },
      chave:       process.env.INTER_PIX_KEY,
    }, 'cob.write')
  }

  // ── Webhook ──────────────────────────────────────────────────
  configurarWebhook(callbackUrl) {
    return this.request('PUT', 'pix', '/webhook', { webhookUrl: callbackUrl }, 'webhook.write')
  }

  getWebhook() {
    return this.request('GET', 'pix', '/webhook', null, 'webhook.read')
  }
}

const interClient = new InterClient()

// ── Processadores ────────────────────────────────────────────
async function processPixRecebido(pg, projectSlug, pix) {
  const pagador = pix.pagador || {}
  const { rows } = await pg.query(`
    INSERT INTO customers
      (project_slug, external_id, source, name, document, acquired_at)
    VALUES ($1, $2, 'inter', $3, $4, NOW())
    ON CONFLICT (project_slug, source, external_id)
    DO UPDATE SET name = COALESCE(EXCLUDED.name, customers.name)
    RETURNING id
  `, [
    projectSlug,
    pagador.cpf || pagador.cnpj || pix.endToEndId,
    pagador.nome,
    pagador.cpf || pagador.cnpj,
  ])

  await pg.query(`
    INSERT INTO payments
      (project_slug, customer_id, external_id, source,
       amount, currency, status, payment_method, paid_at, metadata)
    VALUES ($1,$2,$3,'inter',$4,'BRL','paid','pix',$5::timestamptz,$6)
    ON CONFLICT (source, external_id)
    DO UPDATE SET status='paid', paid_at=EXCLUDED.paid_at
  `, [
    projectSlug, rows[0]?.id, pix.endToEndId,
    parseFloat(pix.valor), pix.horario, JSON.stringify(pix),
  ])

  console.log(`[Inter] PIX recebido: ${pix.endToEndId} R$${pix.valor} project=${projectSlug}`)
}

async function processBoletoPago(pg, projectSlug, c) {
  const { rows } = await pg.query(`
    INSERT INTO customers
      (project_slug, external_id, source, name, document, acquired_at)
    VALUES ($1, $2, 'inter', $3, $4, NOW())
    ON CONFLICT (project_slug, source, external_id)
    DO UPDATE SET name = COALESCE(EXCLUDED.name, customers.name)
    RETURNING id
  `, [projectSlug, c.cnpjCpfSacado || c.nossoNumero, c.nomeSacado, c.cnpjCpfSacado])

  await pg.query(`
    INSERT INTO payments
      (project_slug, customer_id, external_id, source,
       amount, currency, status, payment_method, paid_at, metadata)
    VALUES ($1,$2,$3,'inter',$4,'BRL','paid','boleto',$5::timestamptz,$6)
    ON CONFLICT (source, external_id)
    DO UPDATE SET status='paid', paid_at=EXCLUDED.paid_at
  `, [
    projectSlug, rows[0]?.id, c.nossoNumero,
    parseFloat(c.valor || c.totalPago || 0),
    c.dataHoraPagamento || new Date().toISOString(),
    JSON.stringify(c),
  ])
}

// ── Router ────────────────────────────────────────────────────
module.exports = function interRouter({ pg }) {
  const router = express.Router()

  // Webhook PIX (formato BACEN): { pix: [{endToEndId, txid, valor, pagador, horario}] }
  router.post('/pix', async (req, res) => {
    const project = req.query.project || 'unknown'
    res.json({ ok: true })
    try {
      await pg.query(
        `INSERT INTO webhook_events (source, event_type, project_slug, payload)
         VALUES ('inter', 'pix.cobranca.pago', $1, $2)`,
        [project, JSON.stringify(req.body)]
      )
      const pixList = req.body.pix || (req.body.endToEndId ? [req.body] : [])
      for (const pix of pixList) await processPixRecebido(pg, project, pix)
    } catch (err) { console.error('[Inter/PIX]', err.message) }
  })

  // Webhook Boleto
  router.post('/cobranca', async (req, res) => {
    const project = req.query.project || 'unknown'
    res.json({ ok: true })
    try {
      await pg.query(
        `INSERT INTO webhook_events (source, event_type, project_slug, payload)
         VALUES ('inter', 'boleto.liquidado', $1, $2)`,
        [project, JSON.stringify(req.body)]
      )
      if (req.body.nossoNumero || req.body.codigoBoleto) {
        await processBoletoPago(pg, project, req.body)
      }
    } catch (err) { console.error('[Inter/Boleto]', err.message) }
  })

  return router
}

module.exports.interClient = interClient
