'use strict'
const { Worker, Queue } = require('bullmq')
const { Pool }          = require('pg')
const Redis             = require('ioredis')
const express           = require('express')

// Carregar configuração do Segredo Único JSON (KOSH_CONFIG)
const config = JSON.parse(process.env.KOSH_CONFIG || '{}')

const redisUrl = config.REDIS_URL || process.env.REDIS_URL
const dbLogsUrl = config.DB_LOGS_URL || process.env.DB_LOGS_URL

// ── Conexões ────────────────────────────────────────────────
// BullMQ precisa de uma conexão separada com maxRetriesPerRequest: null
const redisConn = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
})

const pg = new Pool({
  connectionString: dbLogsUrl,
  ssl: false,
  max: 5,
})

// ── Funções Processadoras (Handlers) ─────────────────────────

// Exporta logs filtrados como CSV
async function handleLogExport(job) {
  const { project, from, to, level, email } = job.data
  console.log(`[Worker] log-export: project=${project} from=${from} to=${to}`)

  const where = ['project=$1']
  const vals  = [project]
  let i = 2
  if (from)  { where.push(`created_at>=$${i++}`); vals.push(from) }
  if (to)    { where.push(`created_at<=$${i++}`); vals.push(to)   }
  if (level) { where.push(`level=$${i++}`);        vals.push(level) }

  const { rows } = await pg.query(
    `SELECT * FROM logs WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT 100000`,
    vals
  )

  const csv = [
    'created_at,project,service,level,event,message,trace_id',
    ...rows.map(r =>
      `${r.created_at},${r.project},${r.service},${r.level},${r.event},"${r.message.replace(/"/g,'""')}",${r.trace_id||''}`
    ),
  ].join('\n')

  // TODO: upload para GCS e envio por email via Resend
  console.log(`[Worker] log-export concluído: ${rows.length} linhas`)
  return { lines: rows.length }
}

async function handleReport(job) {
  const { project, period = '7 days' } = job.data
  const { rows } = await pg.query(`
    SELECT level, COUNT(*) AS count
    FROM logs
    WHERE project=$1 AND created_at >= NOW() - $2::interval
    GROUP BY level ORDER BY count DESC
  `, [project, period])
  console.log(`[Worker] report: ${JSON.stringify(rows)}`)
  return rows
}

async function handleCleanup(job) {
  const { keepDays = 90 } = job.data
  const { rowCount } = await pg.query(
    `DELETE FROM logs WHERE created_at < NOW() - ($1::int * INTERVAL '1 day')`,
    [keepDays]
  )
  console.log(`[Worker] cleanup: ${rowCount} logs removidos (>${keepDays} dias)`)
  return { deleted: rowCount }
}

const QUEUES = {
  'kosh-jobs-log-export':  handleLogExport,
  'kosh-jobs-report':      handleReport,
  'kosh-jobs-cleanup':     handleCleanup,
}

// ── Registro de Workers ──────────────────────────────────────
const workers = Object.entries(QUEUES).map(([queueName, processor]) =>
  new Worker(queueName, processor, {
    connection: redisConn,
    concurrency: 2,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  })
)

workers.forEach(w => {
  w.on('completed', job => console.log(`[Worker] ✓ ${job.queueName} #${job.id}`))
  w.on('failed',    (job, err) => console.error(`[Worker] ✗ ${job?.queueName} #${job?.id}:`, err.message))
})

// ── Health Check (Cloud Run exige porta aberta) ──────────────
const app = express()
app.get('/health', (req, res) => res.json({ ok: true, queues: Object.keys(QUEUES) }))
app.listen(process.env.PORT || 8080, '0.0.0.0',
  () => console.log('[Worker] Processando filas...'))

// ── Shutdown Gracioso ────────────────────────────────────────
process.on('SIGTERM', async () => {
  console.log('[Worker] SIGTERM — encerrando...')
  await Promise.all(workers.map(w => w.close()))
  await pg.end()
  process.exit(0)
})
