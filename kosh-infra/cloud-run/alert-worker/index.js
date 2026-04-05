'use strict'
const Redis   = require('ioredis')
const fetch   = require('node-fetch')
const express = require('express')

// Carregar configuração do Segredo Único JSON (KOSH_CONFIG)
const config = JSON.parse(process.env.KOSH_CONFIG || '{}')

const redisUrl = config.REDIS_URL || process.env.REDIS_URL
const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
})

const TELEGRAM_TOKEN = config.TELEGRAM_TOKEN || process.env.TELEGRAM_TOKEN
const CHAT_ID        = config.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID
const RESEND_KEY     = config.RESEND_API_KEY || process.env.RESEND_API_KEY

const TELEGRAM_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`

// Cooldown por fingerprint para evitar flood de alertas (5 min)
const COOLDOWN_MS  = 5 * 60 * 1000
const sentAt       = new Map()

function shouldSend(key) {
  const last = sentAt.get(key) || 0
  if (Date.now() - last < COOLDOWN_MS) return false
  sentAt.set(key, Date.now())
  return true
}

// ── Telegram ─────────────────────────────────────────────────
async function sendTelegram(log) {
  if (!CHAT_ID || !TELEGRAM_TOKEN) return

  const icon = log.level === 'CRITICAL' ? '🔴' : '🟡'
  const text = [
    `${icon} *${log.level}* — \`${log.project}\``,
    `*Serviço:* ${log.service}`,
    `*Evento:* \`${log.event}\``,
    `*Mensagem:* ${log.message.slice(0, 300)}`,
    log.trace_id ? `*Trace:* \`${log.trace_id}\`` : '',
  ].filter(Boolean).join('\n')

  await fetch(`${TELEGRAM_URL}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id:    CHAT_ID,
      text,
      parse_mode: 'Markdown',
    }),
  }).catch(e => console.error('[Alert] Telegram:', e.message))
}

// ── Email via Resend ─────────────────────────────────────────
async function sendEmail(log) {
  if (!RESEND_KEY) return

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${RESEND_KEY}`,
    },
    body: JSON.stringify({
      from:    'alerts@cspfood.com.br',
      to:      ['koshsistemas@gmail.com'],
      subject: `[${log.level}] ${log.project} — ${log.event}`,
      html: `
        <h2 style="color:${log.level==='CRITICAL'?'#ef4444':'#f59e0b'}">${log.level}</h2>
        <table>
          <tr><td><b>Projeto</b></td><td>${log.project}</td></tr>
          <tr><td><b>Serviço</b></td><td>${log.service}</td></tr>
          <tr><td><b>Evento</b></td><td>${log.event}</td></tr>
          <tr><td><b>Mensagem</b></td><td>${log.message}</td></tr>
          ${log.trace_id ? `<tr><td><b>Trace</b></td><td><code>${log.trace_id}</code></td></tr>` : ''}
          ${log.stack_trace ? `<tr><td><b>Stack</b></td><td><pre>${log.stack_trace.slice(0,2000)}</pre></td></tr>` : ''}
        </table>
      `,
    }),
  }).catch(e => console.error('[Alert] Email:', e.message))
}

// ── Loop principal: BLPOP na fila de alertas ─────────────────
async function processAlerts() {
  console.log('[Alert Worker] Aguardando alertas...')
  while (true) {
    try {
      const result = await redis.blpop('kosh:alerts:queue', 30)
      if (!result) continue

      const log = JSON.parse(result[1])
      const key = log.fingerprint || `${log.project}:${log.service}:${log.event}`

      if (!shouldSend(key)) {
        console.log(`[Alert] Cooldown ativo para: ${key}`)
        continue
      }

      console.log(`[Alert] Processando: ${log.level} ${log.project}/${log.service}`)

      await sendTelegram(log)
      if (log.level === 'CRITICAL') await sendEmail(log)

    } catch (err) {
      if (!err.message.includes('Connection')) {
        console.error('[Alert] Erro:', err.message)
      }
      await new Promise(r => setTimeout(r, 2000))
    }
  }
}

processAlerts()

// Health check
const app = express()
app.get('/health', (req, res) =>
  res.json({ ok: true, cooldowns: sentAt.size }))
app.listen(process.env.PORT || 8080, '0.0.0.0')

process.on('SIGTERM', async () => {
  await redis.quit()
  process.exit(0)
})
