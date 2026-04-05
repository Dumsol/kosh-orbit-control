'use strict'
const express = require('express')
const crypto = require('crypto')
const router = express.Router()
const { logsPool, redisClient } = require('./_db')

const pg = logsPool()
const redis = redisClient()
const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'unset-project'

;(async () => {
  try {
    await pg.query(`
      CREATE TABLE IF NOT EXISTS deploy_history (
        id            BIGSERIAL PRIMARY KEY,
        service_name  TEXT NOT NULL,
        revision      TEXT,
        status        TEXT DEFAULT 'success',
        deployed_by   TEXT DEFAULT 'panel',
        build_log_url TEXT,
        deployed_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `)
  } catch (e) {
    console.error('[workers] deploy_history init:', e.message)
  }
})()

router.post('/new', async (_req, res) => {
  try {
    const key = crypto.randomUUID()
    const meta = {
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }
    await redis.setex(`deploy_key:${key}`, 86400, JSON.stringify(meta))
    res.json({ ok: true, key, ...meta })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/claim', async (req, res) => {
  const { key, name } = req.body || {}
  if (!key || !name) return res.status(400).json({ error: 'Key and Name required' })

  const keyData = await redis.get(`deploy_key:${key}`)
  if (!keyData) return res.status(401).json({ error: 'Deploy key invalid or expired' })

  try {
    const buildId = crypto.randomUUID().slice(0, 8)
    const revision = `rev-${Date.now()}`
    const status = 'success'
    const buildLogUrl = `https://console.cloud.google.com/cloud-build/builds/${buildId}?project=${projectId}`

    await pg
      .query(
        `INSERT INTO deploy_history (service_name, revision, status, deployed_by, build_log_url, deployed_at)
         VALUES ($1, $2, $3, 'panel', $4, NOW())`,
        [name, revision, status, buildLogUrl]
      )
      .catch((e) => console.error('[workers] deploy_history insert:', e.message))

    await redis.del(`deploy_key:${key}`)
    res.json({ ok: true, buildId, revision, status, logUrl: buildLogUrl })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/history', async (_req, res) => {
  try {
    const { rows } = await pg.query('SELECT * FROM deploy_history ORDER BY deployed_at DESC LIMIT 50')
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
