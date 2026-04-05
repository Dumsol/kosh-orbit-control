// ═══════════════════════════════════════════════════════════
//  webhooks/index.js — Entry point
// ═══════════════════════════════════════════════════════════
'use strict'

// Injetando as variáveis do segredo único KOSH_CONFIG no ambiente global (sem alterar o restante do código)
const koshConfig = JSON.parse(process.env.KOSH_CONFIG || '{}')
Object.assign(process.env, koshConfig)

const express    = require('express')
const { Pool }   = require('pg')
const Redis      = require('ioredis')

const app  = express()
const PORT = process.env.PORT || 8080

app.use(express.json({ limit: '2mb' }))
app.use(express.raw({ type: 'application/octet-stream', limit: '2mb' }))

// ── Conexões ────────────────────────────────────────────────
const pg = new Pool({
  connectionString: process.env.DB_METRICS_URL,
  ssl: false,
  max: 5,
  idleTimeoutMillis: 30000,
})

const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL)
  : null

// ── Middlewares de autenticação por gateway ─────────────────
function authAsaas(req, res, next) {
  const token =
    req.headers['asaas-access-token'] ||
    req.headers['authorization']?.replace(/^Bearer\s+/i, '')

  if (!token || token !== process.env.ASAAS_WEBHOOK_TOKEN) {
    console.warn('[Asaas] Token inválido:', token?.slice(0, 8))
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

function authInter(req, res, next) {
  // Inter valida pelo certificado mTLS configurado no Cloud Run.
  // Se INTER_WEBHOOK_TOKEN estiver definido, valida o header também.
  const sig = req.headers['x-inter-signature']
  if (process.env.INTER_WEBHOOK_TOKEN && sig !== process.env.INTER_WEBHOOK_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

// ── Rotas ──────────────────────────────────────────────────
app.use('/webhooks/asaas', authAsaas, require('./routes/asaas')({ pg, redis }))
app.use('/webhooks/inter', authInter, require('./routes/inter')({ pg, redis }))

// ── Painel: APIs de consulta bancária (protegidas por PANEL_SECRET) ──
app.use('/banking', (req, res, next) => {
  const token = req.headers['authorization']?.replace(/^Bearer\s+/i, '')
  if (token !== process.env.PANEL_SECRET) return res.status(401).json({ error: 'Unauthorized' })
  next()
}, require('./routes/banking')({ pg, redis }))

// ── Health ──────────────────────────────────────────────────
app.get(['/health', '/webhooks/health'], async (req, res) => {
  try {
    await pg.query('SELECT 1')
    res.json({ ok: true, pg: 'up', ts: new Date().toISOString() })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

app.listen(PORT, '0.0.0.0', () =>
  console.log(`[Webhooks] Porta ${PORT}`))

module.exports = { pg, redis }
