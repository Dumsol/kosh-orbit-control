'use strict'
const express = require('express')
const fetch   = require('node-fetch')
const { Pool }= require('pg')
const Redis   = require('ioredis')

const app      = express()
const PORT     = process.env.PORT || 8080

// Carregar configuração do Segredo Único JSON (KOSH_CONFIG)
const config = JSON.parse(process.env.KOSH_CONFIG || '{}')

const TOKEN    = config.TELEGRAM_TOKEN || process.env.TELEGRAM_TOKEN
const CHAT_ID  = config.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID
const BASE_URL = `https://api.telegram.org/bot${TOKEN}`

app.use(express.json())

const pg = new Pool({
  connectionString: config.DB_LOGS_URL || process.env.DB_LOGS_URL,
  ssl: false, max: 3,
})

const redis = new Redis(config.REDIS_URL || process.env.REDIS_URL)

// ── Envia mensagem ───────────────────────────────────────────
async function send(chatId, text, parse_mode = 'Markdown') {
  await fetch(`${BASE_URL}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode }),
  }).catch(e => console.error('[Bot] send:', e.message))
}

// ── Comandos ─────────────────────────────────────────────────
const COMMANDS = {
  '/start': async (chatId) => {
    await send(chatId, [
      '👋 *Kosh Admin Bot*',
      '',
      'Comandos disponíveis:',
      '`/status` — status dos serviços',
      '`/errors` — últimos 5 erros críticos',
      '`/logs <projeto>` — últimos 10 logs',
      '`/mrr` — MRR atual por projeto',
      '`/redis` — uso de memória Redis',
      '`/help` — esta mensagem',
    ].join('\n'))
  },

  '/status': async (chatId) => {
    const pgOk = await pg.query('SELECT 1').then(() => '✅').catch(() => '❌')
    const rdOk = await redis.ping().then(r => r === 'PONG' ? '✅' : '❌').catch(() => '❌')
    const rdMem = await redis.info('memory')
      .then(i => i.match(/used_memory_human:(.+)/)?.[1]?.trim() || '?')
      .catch(() => '?')

    await send(chatId, [
      '📊 *Status dos Serviços*',
      `Postgres: ${pgOk}`,
      `Redis:    ${rdOk} (${rdMem})`,
    ].join('\n'))
  },

  '/errors': async (chatId) => {
    const { rows } = await pg.query(`
      SELECT project, service, event, message, created_at
      FROM logs
      WHERE level IN ('ERROR','CRITICAL')
      ORDER BY created_at DESC LIMIT 5
    `)
    if (!rows.length) return send(chatId, '✅ Nenhum erro recente')
    const text = rows.map(r =>
      `🔴 *${r.project}/${r.service}*\n\`${r.event}\` — ${r.message.slice(0,80)}\n_${new Date(r.created_at).toLocaleString('pt-BR')}_`
    ).join('\n\n')
    await send(chatId, text)
  },

  '/redis': async (chatId) => {
    const info = await redis.info('memory')
    const used = info.match(/used_memory_human:(.+)/)?.[1]?.trim() || '?'
    const peak = info.match(/used_memory_peak_human:(.+)/)?.[1]?.trim() || '?'
    await send(chatId, `💾 *Redis Memória*\nUsado: ${used}\nPico:  ${peak}`)
  },
}

// Comando /logs <projeto>
async function handleLogs(chatId, project) {
  const { rows } = await pg.query(`
    SELECT service, level, event, message, created_at
    FROM logs WHERE project=$1
    ORDER BY created_at DESC LIMIT 10
  `, [project || 'kosh'])

  if (!rows.length) return send(chatId, `Nenhum log para _${project}_`)

  const icons = { INFO:'ℹ️', WARN:'⚠️', ERROR:'🔴', CRITICAL:'🚨', DEBUG:'🔹' }
  const text  = rows.map(r =>
    `${icons[r.level]||'•'} *${r.service}* \`${r.event}\`\n${r.message.slice(0,60)}`
  ).join('\n')
  await send(chatId, `*Logs — ${project}*\n\n${text}`)
}

// Comando /mrr
async function handleMrr(chatId) {
  try {
    const pgM = new Pool({ connectionString: config.DB_METRICS_URL || process.env.DB_METRICS_URL, ssl: false, max: 2 })
    const { rows } = await pgM.query(`
      SELECT project_slug, SUM(amount) AS mrr
      FROM payments
      WHERE status IN ('paid','received')
        AND paid_at >= DATE_TRUNC('month', NOW())
      GROUP BY project_slug ORDER BY mrr DESC
    `)
    await pgM.end()
    if (!rows.length) return send(chatId, 'Nenhuma receita este mês ainda.')
    const text = rows.map(r => `*${r.project_slug}*: R$ ${parseFloat(r.mrr).toFixed(2)}`).join('\n')
    await send(chatId, `💰 *MRR — ${new Date().toLocaleString('pt-BR',{month:'long'})}*\n\n${text}`)
  } catch (e) {
    await send(chatId, `Erro ao buscar MRR: ${e.message}`)
  }
}

// ── Webhook do Telegram ──────────────────────────────────────
app.post('/telegram', async (req, res) => {
  res.sendStatus(200)
  const msg = req.body.message
  if (!msg?.text) return

  // Só responde ao chat autorizado
  const chatId = msg.chat.id
  if (String(chatId) !== String(CHAT_ID)) {
    return send(chatId, '⛔ Acesso não autorizado.')
  }

  const [cmd, ...args] = msg.text.split(' ')

  if (cmd === '/logs')    return handleLogs(chatId, args[0])
  if (cmd === '/mrr')     return handleMrr(chatId)
  if (COMMANDS[cmd])      return COMMANDS[cmd](chatId)

  await send(chatId, 'Comando não reconhecido. Use `/help`.')
})

app.get('/health', (req, res) => res.json({ ok: true }))

// ── Registra webhook no Telegram ────────────────────────────
async function registerWebhook() {
  const publicUrl = config.PUBLIC_URL || process.env.PUBLIC_URL
  const url = `${publicUrl}/telegram`
  const res = await fetch(`${BASE_URL}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, drop_pending_updates: true }),
  })
  const data = await res.json()
  console.log('[Bot] Webhook registrado:', data.ok ? '✓' : data.description)
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Bot] Porta ${PORT}`)
  registerWebhook().catch(e => console.error('[Bot] Webhook:', e.message))
})
