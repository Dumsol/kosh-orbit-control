'use strict'
const express = require('express')
const crypto = require('crypto')
const router = express.Router()
const { redisClient, metricsPool } = require('./_db')

const redis = redisClient()
const pgMetrics = metricsPool()

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {}
  if (!password) return res.status(400).json({ error: 'password required' })

  const secret = process.env.PANEL_SECRET
  if (!secret) return res.status(503).json({ error: 'PANEL_SECRET not configured' })
  if (password !== secret) return res.status(401).json({ error: 'Invalid credentials' })

  const token = crypto.randomBytes(32).toString('hex')
  await redis.setex(`cli:token:${token}`, 30 * 86400, JSON.stringify({ email: email || 'admin' })).catch(() => {})

  res.json({ token, user: { email: email || 'admin' } })
})

// GET /auth/projects
router.get('/projects', async (_req, res) => {
  try {
    const { rows } = await pgMetrics.query(
      `SELECT DISTINCT project_slug AS slug, project_slug AS name FROM v_mrr_monthly ORDER BY 1`
    )
    const projects = rows.length
      ? rows
      : [
          { slug: 'kosh', name: 'Kosh' },
          { slug: 'nakta', name: 'Nakta' },
          { slug: 'csp', name: 'CSP Food' },
          { slug: 'opemly', name: 'Opemly' },
        ]
    res.json(projects)
  } catch {
    res.json([
      { slug: 'kosh', name: 'Kosh' },
      { slug: 'nakta', name: 'Nakta' },
      { slug: 'csp', name: 'CSP Food' },
      { slug: 'opemly', name: 'Opemly' },
    ])
  }
})

module.exports = router
