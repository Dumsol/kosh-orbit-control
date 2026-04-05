'use strict'
const express = require('express'), router = express.Router()
const fetch   = (() => { try { return require('node-fetch') } catch { return null } })()

// POST /telegram/send — Proxy to Telegram Bot API
router.post('/send', async (req, res) => {
  if (!fetch) return res.status(501).json({ error: 'node-fetch not available' })

  const { text, parse_mode = 'Markdown', chat_id } = req.body
  if (!text) return res.status(400).json({ error: 'text required' })

  const TOKEN   = process.env.TELEGRAM_TOKEN
  const CHAT_ID = chat_id || process.env.TELEGRAM_CHAT_ID
  if (!TOKEN || !CHAT_ID) return res.status(503).json({ error: 'TELEGRAM_TOKEN or TELEGRAM_CHAT_ID not configured' })

  try {
    const result = await fetch(
      `https://api.telegram.org/bot${TOKEN}/sendMessage`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ chat_id: CHAT_ID, text, parse_mode }),
      }
    )
    const data = await result.json()
    if (!data.ok) return res.status(502).json({ error: data.description })
    res.json({ ok: true, message_id: data.result?.message_id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
