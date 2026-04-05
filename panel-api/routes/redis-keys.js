'use strict'
const express = require('express'), router = express.Router()
const { redisClient } = require('./_db')
const redis = redisClient()

// GET /redis-keys/ — List keys with type + ttl
router.get('/', async (req, res) => {
  const { pattern = '*', limit = 50 } = req.query
  try {
    const info = await redis.info('memory')
    const used = info.match(/used_memory_human:(.+)/)?.[1]?.trim()
    const keys = await redis.keys(pattern)
    const slice = keys.slice(0, parseInt(limit))
    const details = await Promise.all(
      slice.map(async key => {
        const [type, ttl] = await Promise.all([redis.type(key), redis.ttl(key)])
        return { key, type, ttl }
      })
    )
    res.json({ total: keys.length, keys: details, memory_used: used })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE /redis-keys/:key
router.delete('/:key', async (req, res) => {
  await redis.del(req.params.key)
  res.json({ ok: true })
})

// ── BullMQ Queue Endpoints ────────────────────────────────────

// GET /redis-keys/queues — Discover queues + counts
router.get('/queues', async (req, res) => {
  try {
    const waitingKeys = await redis.keys('bull:*:waiting')
    const names = [...new Set(waitingKeys.map(k => k.split(':')[1]))]

    const queues = await Promise.all(names.map(async name => {
      const [waiting, active, completed, failed] = await Promise.all([
        redis.llen(`bull:${name}:waiting`),
        redis.llen(`bull:${name}:active`),
        redis.zcard(`bull:${name}:completed`),
        redis.zcard(`bull:${name}:failed`),
      ])
      return { name, waiting, active, completed, failed }
    }))

    // Also check BullMQ v4+ key format (bull:{name}) if no results
    if (queues.length === 0) {
      const altKeys = await redis.keys('bull:*')
      const altNames = [...new Set(
        altKeys.map(k => k.replace(/^bull:/, '').split(':')[0])
      )].filter(n => n && n !== 'undefined')

      const altQueues = await Promise.all(altNames.map(async name => {
        const [waiting, active, completed, failed] = await Promise.all([
          redis.llen(`bull:${name}:wait`).catch(() => 0),
          redis.llen(`bull:${name}:active`).catch(() => 0),
          redis.zcard(`bull:${name}:completed`).catch(() => 0),
          redis.zcard(`bull:${name}:failed`).catch(() => 0),
        ])
        return { name, waiting, active, completed, failed }
      }))
      return res.json(altQueues.filter(q => q.waiting + q.active + q.completed + q.failed > 0))
    }

    res.json(queues)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /redis-keys/queues/:name/failed — Last 20 failed jobs
router.get('/queues/:name/failed', async (req, res) => {
  const { name } = req.params
  try {
    const jobIds = await redis.zrange(`bull:${name}:failed`, -20, -1)
    const jobs = await Promise.all(
      jobIds.map(async id => {
        const raw = await redis.get(`bull:${name}:${id}`)
        try { return { id, ...JSON.parse(raw || '{}') } } catch { return { id } }
      })
    )
    res.json(jobs)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /redis-keys/queues/:name/retry/:jobId — Move failed → waiting
router.post('/queues/:name/retry/:jobId', async (req, res) => {
  const { name, jobId } = req.params
  try {
    await redis.zrem(`bull:${name}:failed`, jobId)
    await redis.rpush(`bull:${name}:waiting`, jobId)
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE /redis-keys/queues/:name/failed/:jobId — Delete failed job
router.delete('/queues/:name/failed/:jobId', async (req, res) => {
  const { name, jobId } = req.params
  try {
    await redis.zrem(`bull:${name}:failed`, jobId)
    await redis.del(`bull:${name}:${jobId}`)
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// DELETE /redis-keys/queues/:name/purge — Delete all queue keys
router.delete('/queues/:name/purge', async (req, res) => {
  const { name } = req.params
  try {
    const keys = await redis.keys(`bull:${name}:*`)
    if (keys.length) await redis.del(...keys)
    res.json({ ok: true, deleted: keys.length })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── Live Monitor SSE ──────────────────────────────────────────
// GET /redis-keys/monitor — Server-Sent Events stream
router.get('/monitor', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  const send = (data) => {
    try { res.write(`data: ${JSON.stringify(data)}\n\n`) } catch {}
  }

  // Subscribe to critical log events (published by ingest-api)
  const Redis = require('ioredis')
  const sub = new Redis(process.env.REDIS_URL || `redis://:${process.env.REDIS_PASSWORD}@${process.env.VM_IP || '127.0.0.1'}:6379`,
    { maxRetriesPerRequest: 1, enableReadyCheck: false })

  sub.on('error', () => {})
  await sub.subscribe('kosh:logs:critical').catch(() => {})
  sub.on('message', (channel, msg) => {
    try {
      const data = JSON.parse(msg)
      send({ type: 'log', level: data.level, service: data.service, event: data.event, message: data.message, ts: new Date().toISOString() })
    } catch {}
  })

  // Periodic Redis stats (every 3s)
  const statsInterval = setInterval(async () => {
    try {
      const info = await redis.info('stats')
      const ops    = info.match(/instantaneous_ops_per_sec:(\d+)/)?.[1] || '0'
      const hits   = info.match(/keyspace_hits:(\d+)/)?.[1] || '0'
      const misses = info.match(/keyspace_misses:(\d+)/)?.[1] || '0'
      send({ type: 'stats', ops_per_sec: parseInt(ops), keyspace_hits: parseInt(hits), keyspace_misses: parseInt(misses), ts: new Date().toISOString() })
    } catch {}
  }, 3000)

  req.on('close', () => {
    clearInterval(statsInterval)
    sub.quit().catch(() => {})
  })
})

module.exports = router
