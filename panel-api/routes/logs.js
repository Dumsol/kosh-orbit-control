'use strict'
const express = require('express'), { Pool } = require('pg'), router = express.Router();
const { logsPool } = require('./_db');
const pg = logsPool();

// Real-time Stream (SSE)
router.get('/stream', (req, res) => {
  res.set({ 
    'Content-Type': 'text/event-stream', 
    'Cache-Control': 'no-cache', 
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no' // Desabilita buffering do nginx
  })
  res.flushHeaders()

  const { project, service, level } = req.query
  let lastId = 0

  const poll = async () => {
    try {
      const where = [`id > $1`]
      const vals  = [lastId]
      let i = 2
      if (project) { where.push(`project=$${i++}`); vals.push(project) }
      if (service) { where.push(`service=$${i++}`); vals.push(service) }
      if (level)   { where.push(`level=$${i++}`);   vals.push(level)   }

      const { rows } = await pg.query(
        `SELECT * FROM logs WHERE ${where.join(' AND ')}
         ORDER BY id DESC LIMIT 100`,
        vals
      )
      if (rows.length) {
        lastId = rows[0].id
        res.write(`data: ${JSON.stringify(rows.reverse())}\n\n`)
      }
    } catch {}
  }

  const iv = setInterval(poll, 2000)
  req.on('close', () => clearInterval(iv))
})

// Busca Full-text e Histórico
router.get('/', async (req, res) => {
  try {
    const { project, service, level, from, to, q, page = 1 } = req.query
    const limit = 100
    const offset = (page - 1) * limit

    const where = ['1=1']
    const vals  = []
    let i = 1

    if (project) { where.push(`project=$${i++}`);    vals.push(project) }
    if (service) { where.push(`service=$${i++}`);    vals.push(service) }
    if (level)   { where.push(`level=$${i++}`);      vals.push(level)   }
    if (from)    { where.push(`created_at>=$${i++}`);vals.push(from)    }
    if (to)      { where.push(`created_at<=$${i++}`);vals.push(to)      }
    if (q)       { where.push(`(message ILIKE $${i} OR event ILIKE $${i})`); vals.push(`%${q}%`); i++ }

    const { rows } = await pg.query(
      `SELECT * FROM logs WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC LIMIT $${i} OFFSET $${i+1}`,
      [...vals, limit, offset]
    )
    
    // Contagem total para paginação (mantendo compatibilidade com o front)
    const { rows: cnt } = await pg.query(`SELECT COUNT(*)::int AS total FROM logs WHERE ${where.join(' AND ')}`, vals.slice(0, i-1))
    
    res.json({
        logs: rows,
        total: cnt[0].total,
        page: parseInt(page),
        pages: Math.ceil(cnt[0].total / limit)
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Mantém suporte para Trace ID individual
router.get('/trace/:id', async (req,res) => { 
    try {
        const {rows} = await pg.query('SELECT * FROM logs WHERE trace_id=$1 ORDER BY created_at ASC',[req.params.id]); 
        res.json(rows) 
    } catch(e) {
        res.status(500).json({ error: e.message })
    }
})

// Mantém Stats para Sparklines e Termômetro
router.get('/stats', async (req, res) => {
    const { project } = req.query
    try {
      const [therm, byProject] = await Promise.all([
        project
          ? pg.query(
              `SELECT date_trunc('hour',created_at) AS h, COUNT(*)::int AS c
               FROM logs
               WHERE created_at >= NOW()-INTERVAL '24 hours' AND project=$1
               GROUP BY h ORDER BY h`,
              [project]
            )
          : pg.query(
              `SELECT date_trunc('hour',created_at) AS h, COUNT(*)::int AS c
               FROM logs
               WHERE created_at >= NOW()-INTERVAL '24 hours'
               GROUP BY h ORDER BY h`
            ),
        project
          ? pg.query(
              `SELECT project, COUNT(*)::int AS c
               FROM logs
               WHERE created_at >= NOW()-INTERVAL '24 hours' AND project=$1
               GROUP BY project ORDER BY c DESC LIMIT 10`,
              [project]
            )
          : pg.query(
              `SELECT project, COUNT(*)::int AS c
               FROM logs
               WHERE created_at >= NOW()-INTERVAL '24 hours'
               GROUP BY project ORDER BY c DESC LIMIT 10`
            )
      ]);
      res.json({ thermometer: therm.rows, byProject: byProject.rows });
    } catch (e) { res.status(500).json({ error: e.message }) }
});

// GET /logs/alerts — Last 10 CRITICAL/ERROR in past 1 hour (for OverviewView)
router.get('/alerts', async (req, res) => {
  const { project } = req.query
  try {
    const { rows } = project
      ? await pg.query(`
          SELECT level, event, message, created_at
          FROM logs
          WHERE level IN ('CRITICAL','ERROR')
            AND created_at >= NOW() - INTERVAL '1 hour'
            AND project = $1
          ORDER BY created_at DESC
          LIMIT 10
        `, [project])
      : await pg.query(`
          SELECT level, event, message, created_at
          FROM logs
          WHERE level IN ('CRITICAL','ERROR')
            AND created_at >= NOW() - INTERVAL '1 hour'
          ORDER BY created_at DESC
          LIMIT 10
        `)
    const alerts = rows.map(r => ({
      level:   r.level,
      time:    new Date(r.created_at).toLocaleTimeString('pt-BR', { hour12: false }),
      msg:     `[${r.event}] ${r.message}`.slice(0, 80),
    }))
    res.json(alerts)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
