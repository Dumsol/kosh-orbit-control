'use strict'
const express = require('express')
const router = express.Router()
const { adminPool, VM_IP } = require('./_db')

router.get('/databases', async (_req, res) => {
  try {
    const pg = adminPool()
    const { rows } = await pg.query(
      `SELECT d.datname AS name,
              pg_size_pretty(pg_database_size(d.datname)) AS size,
              r.rolname AS owner
       FROM pg_database d
       JOIN pg_roles r ON d.datdba = r.oid
       WHERE d.datistemplate = false
       ORDER BY d.datname`
    )
    await pg.end()
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/string/:dbname', (_req, res) => {
  const publicUrl = process.env.PUBLIC_URL || 'http://localhost:8080'
  res.json({
    postgres: process.env.DB_LOGS_URL || `postgresql://logs_user:***@${VM_IP}:5432/logs_db`,
    redis: process.env.REDIS_URL || `redis://:***@${VM_IP}:6379`,
    ingest: `${publicUrl}/ingest`,
    ingest_token: process.env.LOG_INGEST_TOKEN ? 'configured' : 'missing',
  })
})

module.exports = router
