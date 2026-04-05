'use strict'
const express = require('express'), router = express.Router()
const fetch   = (() => { try { return require('node-fetch') } catch { return null } })()

// POST /email/send — Proxy to Resend API
// Auth: x-api-key header (PANEL_SECRET) or Authorization Bearer
router.post('/send', async (req, res) => {
  if (!fetch) return res.status(501).json({ error: 'node-fetch not available' })

  const { from, to, subject, html, project } = req.body
  if (!to || !subject || !html) return res.status(400).json({ error: 'to, subject, html required' })

  const RESEND_KEY = process.env.RESEND_API_KEY
  if (!RESEND_KEY) return res.status(503).json({ error: 'RESEND_API_KEY not configured' })

  try {
    const result = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${RESEND_KEY}`,
      },
      body: JSON.stringify({
        from:    from || `noreply@cspfood.com.br`,
        to:      Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    })
    const data = await result.json()
    if (!result.ok) return res.status(502).json({ error: data.message || 'Resend error' })
    res.json({ ok: true, id: data.id })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
