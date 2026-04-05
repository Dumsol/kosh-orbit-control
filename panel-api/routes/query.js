'use strict'
const express = require('express')
const router = express.Router()
const { logsPool } = require('./_db')

const PANEL_SECRET = process.env.PANEL_SECRET
const POSTGRES_REST_TOKEN = process.env.POSTGRES_REST_TOKEN

const authenticate = (req, res, next) => {
  if (!PANEL_SECRET && !POSTGRES_REST_TOKEN) {
    return res.status(503).json({ error: 'Query auth secrets are not configured' })
  }

  const authHeader = req.headers.authorization || ''
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' })
  }

  const token = authHeader.split(' ')[1]
  const valid = [POSTGRES_REST_TOKEN, PANEL_SECRET].filter(Boolean)
  if (!valid.includes(token)) {
    return res.status(403).json({ error: 'Forbidden: Invalid token' })
  }
  next()
}

const pool = logsPool()

// POST /query
router.post('/', authenticate, async (req, res) => {
  const { sql, params } = req.body || {}
  if (!sql) return res.status(400).json({ error: 'Parameter "sql" is required' })

  try {
    const start = Date.now()
    const { rows, fields, rowCount } = await pool.query(sql, params || [])
    const duration = Date.now() - start

    res.json({
      ok: true,
      rows,
      rowCount,
      duration_ms: duration,
      fields: (fields || []).map((f) => ({ name: f.name, type: f.dataTypeID })),
    })
  } catch (e) {
    res.status(500).json({ error: e.message, code: e.code })
  }
})

module.exports = router
