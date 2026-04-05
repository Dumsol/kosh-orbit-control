'use strict'
const express = require('express')
const crypto = require('crypto')
const router = express.Router()
const { metricsPool, logsPool } = require('./_db')

const pgMetrics = metricsPool()
const pgLogs = logsPool()

const PANEL_SECRET = process.env.PANEL_SECRET
const WEBHOOK_SECRET = process.env.PEPPERMINT_WEBHOOK_SECRET

const requirePanelAuth = (req, res, next) => {
  if (!PANEL_SECRET) return res.status(503).json({ error: 'PANEL_SECRET not configured' })
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (token !== PANEL_SECRET) return res.status(401).json({ error: 'Unauthorized' })
  next()
}

const webhookAuth = (req, res, next) => {
  if (!WEBHOOK_SECRET) return res.status(503).json({ error: 'PEPPERMINT_WEBHOOK_SECRET not configured' })
  const token = req.headers['x-webhook-secret'] || req.headers['x-peppermint-secret'] || ''
  if (token !== WEBHOOK_SECRET) return res.status(401).json({ error: 'Invalid webhook secret' })
  next()
}

const toText = (value, fallback = '') => String(value || fallback).trim()
const normalizeStatus = (value) => {
  const s = toText(value, 'open').toLowerCase()
  if (['resolved', 'closed', 'done'].includes(s)) return 'closed'
  if (['pending', 'on-hold', 'waiting'].includes(s)) return 'pending'
  return 'open'
}

;(async () => {
  try {
    await pgMetrics.query(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id BIGSERIAL PRIMARY KEY,
        source TEXT DEFAULT 'peppermint',
        project_slug TEXT NOT NULL,
        ticket_id TEXT NOT NULL,
        status TEXT DEFAULT 'open',
        subject TEXT,
        requester TEXT,
        priority TEXT,
        payload JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (source, project_slug, ticket_id)
      )
    `)
  } catch (e) {
    console.error('[support] init:', e.message)
  }
})()

router.get('/stats', requirePanelAuth, async (req, res) => {
  const project = toText(req.query.project, 'kosh')
  try {
    const { rows } = await pgMetrics.query(
      `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status='open')::int AS open,
        COUNT(*) FILTER (WHERE status='pending')::int AS pending,
        COUNT(*) FILTER (WHERE status='closed')::int AS closed,
        MAX(updated_at) AS last_update
      FROM support_tickets
      WHERE project_slug = $1
      `,
      [project]
    )
    const row = rows[0] || { total: 0, open: 0, pending: 0, closed: 0, last_update: null }
    res.json({
      project,
      total: Number(row.total || 0),
      open: Number(row.open || 0),
      pending: Number(row.pending || 0),
      closed: Number(row.closed || 0),
      lastUpdate: row.last_update ? new Date(row.last_update).toISOString() : null,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/tickets/recent', requirePanelAuth, async (req, res) => {
  const project = toText(req.query.project, 'kosh')
  try {
    const { rows } = await pgMetrics.query(
      `
      SELECT ticket_id, status, subject, requester, priority, updated_at
      FROM support_tickets
      WHERE project_slug = $1
      ORDER BY updated_at DESC
      LIMIT 20
      `,
      [project]
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/webhook/peppermint', webhookAuth, async (req, res) => {
  const body = req.body || {}
  const event = toText(body.event || body.type || body.action, 'support.ticket.updated')
  const payload = body.ticket || body.data || body

  const project = toText(payload.project_slug || payload.project || body.project_slug, 'kosh')
  const ticketId = toText(payload.id || payload.ticket_id || body.ticket_id)
  if (!ticketId) return res.status(400).json({ error: 'ticket_id required' })

  const status = normalizeStatus(
    payload.status || body.status || (event.includes('resolved') ? 'closed' : 'open')
  )
  const subject = toText(payload.subject || payload.title, `Ticket ${ticketId}`)
  const requester = toText(payload.requester || payload.email || payload.user_email)
  const priority = toText(payload.priority, 'normal')

  try {
    await pgMetrics.query(
      `
      INSERT INTO support_tickets (source, project_slug, ticket_id, status, subject, requester, priority, payload, updated_at)
      VALUES ('peppermint', $1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
      ON CONFLICT (source, project_slug, ticket_id)
      DO UPDATE SET
        status = EXCLUDED.status,
        subject = EXCLUDED.subject,
        requester = EXCLUDED.requester,
        priority = EXCLUDED.priority,
        payload = EXCLUDED.payload,
        updated_at = NOW()
      `,
      [project, ticketId, status, subject, requester, priority, JSON.stringify(body)]
    )

    // Lightweight event logging for support timeline in LogsView.
    await pgLogs.query(
      `
      INSERT INTO logs (level, project, service, event, message, trace_id, metadata, created_at)
      VALUES ($1, $2, 'support', $3, $4, $5, $6::jsonb, NOW())
      `,
      [
        status === 'closed' ? 'INFO' : 'WARN',
        project,
        event,
        `[support] ${subject} (#${ticketId}) => ${status}`,
        crypto.randomUUID(),
        JSON.stringify({ ticketId, status, requester, priority, source: 'peppermint' }),
      ]
    ).catch(() => {})

    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
