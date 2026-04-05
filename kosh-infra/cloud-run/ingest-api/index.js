'use strict'
const express    = require('express')
const { Pool }   = require('pg')
const Redis      = require('ioredis')

const app  = express()
const PORT = process.env.PORT || 8080

// Carregar configuração do Segredo Único JSON (KOSH_CONFIG)
const config = JSON.parse(process.env.KOSH_CONFIG || '{}')

app.use(express.json({ limit: '512kb' }))

const pg = new Pool({
  connectionString: config.DB_LOGS_URL || process.env.DB_LOGS_URL,
  ssl: false,
  max: 10,
  idleTimeoutMillis: 30000,
})

const redis = (config.REDIS_URL || process.env.REDIS_URL)
  ? new Redis(config.REDIS_URL || process.env.REDIS_URL)
  : null

// ── Garante que a tabela de logs existe ──────────────────────
async function ensureTable() {
  await pg.query(`
    CREATE TABLE IF NOT EXISTS logs (
      id          BIGSERIAL PRIMARY KEY,
      project     TEXT NOT NULL,
      service     TEXT NOT NULL,
      level       TEXT NOT NULL,
      event       TEXT NOT NULL,
      message     TEXT NOT NULL,
      trace_id    TEXT,
      env         TEXT,
      user_id     TEXT,
      user_email  TEXT,
      user_role   TEXT,
      duration_ms INTEGER,
      status_code INTEGER,
      http_method TEXT,
      http_path   TEXT,
      stack_trace TEXT,
      fingerprint TEXT,
      metadata    JSONB,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_logs_project   ON logs(project, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_logs_level     ON logs(level, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_logs_service   ON logs(project, service, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_logs_trace     ON logs(trace_id) WHERE trace_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_logs_event     ON logs(event);
    CREATE INDEX IF NOT EXISTS idx_logs_finger    ON logs(fingerprint) WHERE fingerprint IS NOT NULL;
  `)
}

ensureTable().catch(e => console.error('[Ingest] ensureTable:', e.message))

// ── Auth middleware ──────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers['authorization']?.replace(/^Bearer\s+/i, '')
  const secretToken = config.LOG_INGEST_TOKEN || process.env.LOG_INGEST_TOKEN
  if (!token || token !== secretToken) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

// ── Rota principal — aceita com ou sem prefixo /ingest ───────
app.post(['/ingest', '/'], auth, async (req, res) => {
  const body = Array.isArray(req.body) ? req.body : [req.body]

  // Responde imediatamente — fire-and-forget do lado do cliente
  res.json({ ok: true, count: body.length })

  try {
    for (const log of body) {
      if (!log.project || !log.service || !log.level || !log.event || !log.message) continue

      await pg.query(`
        INSERT INTO logs
          (project, service, level, event, message, trace_id, env,
           user_id, user_email, user_role, duration_ms, status_code,
           http_method, http_path, stack_trace, fingerprint, metadata, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
          COALESCE($18::timestamptz, NOW()))
      `, [
        log.project, log.service, log.level, log.event, log.message,
        log.trace_id, log.env,
        log.user?.id, log.user?.email, log.user?.role,
        log.duration_ms, log.status_code,
        log.http_method, log.http_path,
        log.stack_trace, log.fingerprint,
        log.metadata ? JSON.stringify(log.metadata) : null,
        log.created_at,
      ])

      if (redis && ['ERROR', 'CRITICAL'].includes(log.level)) {
        await redis.publish('kosh:logs:critical',
          JSON.stringify({ project: log.project, service: log.service,
                           level: log.level, event: log.event, message: log.message }))
          .catch(() => {})

        if (log.level === 'CRITICAL') {
          await redis.lpush('kosh:alerts:queue', JSON.stringify(log)).catch(() => {})
        }
      }
    }
  } catch (err) {
    console.error('[Ingest] Erro ao salvar log:', err.message)
  }
})

// ── Health ───────────────────────────────────────────────────
app.get(['/health', '/ingest/health'], async (req, res) => {
  try {
    await pg.query('SELECT 1')
    res.json({ ok: true, ts: new Date().toISOString() })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

app.listen(PORT, '0.0.0.0', () => console.log(`[Ingest] Porta ${PORT}`))
