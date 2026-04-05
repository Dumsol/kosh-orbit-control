'use strict'
const express = require('express')
const router = express.Router()
const { logsPool, redisClient, VM_IP } = require('./_db')
const fetch = (() => {
  try { return require('node-fetch') } catch { return global.fetch }
})()

router.get('/', async (req, res) => {
  const project = String(req.query.project || 'kosh')
  const publicUrl = process.env.PUBLIC_URL || 'http://localhost:8080'
  const r = {}

  try {
    const pg = logsPool()
    await pg.query('SELECT 1')
    await pg.end()
    r.postgres = { status: 'online', host: VM_IP }
  } catch (e) {
    r.postgres = { status: 'offline', error: e.message }
  }

  try {
    const rd = redisClient()
    await rd.ping()
    const info = await rd.info('memory')
    const mem = info.match(/used_memory_human:(.+)/)?.[1]?.trim() || '?'
    r.redis = { status: 'online', memory: mem }
  } catch (e) {
    r.redis = { status: 'offline', error: e.message }
  }

  const services = [
    { name: 'ingest-api', url: `${publicUrl}/ingest/health` },
    { name: 'webhooks', url: `${publicUrl}/webhooks/health` },
    { name: 'suitecrm', url: `${process.env.SUITECRM_PUBLIC_URL || `${publicUrl}/crm-app/`}` },
  ]

  r.cloudRun = {}
  if (fetch) {
    await Promise.all(
      services.map(async (s) => {
        try {
          const resp = await fetch(s.url, { timeout: 3000 })
          r.cloudRun[s.name] = { status: resp.ok ? 'online' : 'degraded' }
        } catch {
          r.cloudRun[s.name] = { status: 'offline' }
        }
      })
    )
  }

  r.project = project
  r.stalwart = { status: 'unknown', note: 'check VM directly' }
  res.json(r)
})

module.exports = router
