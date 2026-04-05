'use strict'
const express = require('express')
const http = require('http')
const cors = require('cors')
const helmet = require('helmet')
const WebSocket = require('ws')
const pty = require('node-pty')

const app = express()
const server = http.createServer(app)
const PORT = process.env.PORT || 8080

const config = (() => {
  try {
    return JSON.parse(process.env.KOSH_CONFIG || '{}')
  } catch {
    return {}
  }
})()

Object.entries(config).forEach(([k, v]) => {
  if (!process.env[k]) process.env[k] = v
})

const SECRET = process.env.PANEL_SECRET || config.PANEL_SECRET

app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({ origin: true, credentials: true }))
app.use(express.json())

const auth = (req, res, next) => {
  if (!SECRET) return res.status(503).json({ error: 'PANEL_SECRET not configured' })
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (token !== SECRET) return res.status(401).json({ error: 'Unauthorized' })
  next()
}

app.post('/auth', (req, res) => {
  if (!SECRET) return res.status(503).json({ error: 'PANEL_SECRET not configured' })
  return req.body?.password === SECRET
    ? res.json({ token: SECRET, ok: true })
    : res.status(401).json({ error: 'Invalid' })
})

app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }))

const ROUTES = ['metrics', 'services', 'logs', 'connections', 'env', 'database', 'redis-keys', 'npm', 'query', 'access', 'bi', 'workers', 'costs']
ROUTES.forEach((r) => {
  try {
    app.use('/' + r, auth, require('./routes/' + r))
  } catch (e) {
    console.warn('[panel-api] Route not loaded:', r, e.message)
  }
})

try {
  app.use('/support', require('./routes/support'))
} catch (e) {
  console.warn('[panel-api] support not loaded:', e.message)
}

const apiKeyAuth = (req, res, next) => {
  if (!SECRET) return res.status(503).json({ error: 'PANEL_SECRET not configured' })
  const key = req.headers['x-api-key'] || (req.headers.authorization || '').replace('Bearer ', '')
  if (key !== SECRET) return res.status(401).json({ error: 'Unauthorized' })
  next()
}

try { app.use('/email', apiKeyAuth, require('./routes/email-send')) } catch (e) { console.warn('[panel-api] email-send not loaded:', e.message) }
try { app.use('/telegram', apiKeyAuth, require('./routes/telegram-send')) } catch (e) { console.warn('[panel-api] telegram-send not loaded:', e.message) }
try { app.use('/auth', require('./routes/auth-cli')) } catch (e) { console.warn('[panel-api] auth-cli not loaded:', e.message) }

const wss = new WebSocket.Server({ server, path: '/terminal' })
wss.on('connection', (ws, req) => {
  const token = new URL(req.url, 'http://x').searchParams.get('token')
  if (!SECRET || token !== SECRET) return ws.close()

  const sh = pty.spawn('bash', [], {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    cwd: process.env.HOME || '/root',
    env: process.env,
  })

  sh.onData((d) => {
    try { ws.send(JSON.stringify({ type: 'output', data: d })) } catch {}
  })

  ws.on('message', (m) => {
    try {
      const j = JSON.parse(m)
      if (j.type === 'input') sh.write(j.data)
      if (j.type === 'resize') sh.resize(j.cols, j.rows)
    } catch {}
  })

  ws.on('close', () => sh.kill())
  sh.onExit(() => {
    try { ws.close() } catch {}
  })
})

server.listen(PORT, '0.0.0.0', () => console.log('[panel-api] listening on', PORT))
