'use strict'
const express = require('express')
const router = express.Router()

// GET /access
// Returns connection metadata without exposing raw secrets.
router.get('/', (req, res) => {
  const base = process.env.PUBLIC_URL || 'http://localhost:8080'

  res.json({
    redis: {
      name: 'Redis Cache',
      url: process.env.REDIS_URL ? process.env.REDIS_URL.replace(/:\/\/:[^@]+@/, '://:***@') : 'not configured',
    },
    postgres: {
      name: 'PostgreSQL Logs',
      connection_string: process.env.DB_LOGS_URL
        ? process.env.DB_LOGS_URL.replace(/:([^:@]+)@/, ':***@')
        : 'not configured',
    },
    ingest: {
      name: 'Kosh Log Ingest',
      url: `${base}/ingest`,
      token_status: process.env.LOG_INGEST_TOKEN ? 'configured' : 'missing',
    },
    panel: {
      name: 'Panel API',
      url: `${base}/api`,
      token_status: process.env.PANEL_SECRET ? 'configured' : 'missing',
    },
  })
})

module.exports = router
