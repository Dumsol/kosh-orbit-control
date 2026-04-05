'use strict'
const express = require('express'), fs = require('fs'), path = require('path'), { exec } = require('child_process'), router = express.Router();
const APPS_DIR = '/home/deploy/apps'
router.get('/projects', (req, res) => {
  try { res.json(fs.readdirSync(APPS_DIR).filter(d => fs.statSync(path.join(APPS_DIR, d)).isDirectory())) } catch { res.json([]) }
})
router.get('/:project', (req, res) => {
  const envPath = path.join(APPS_DIR, req.params.project, '.env')
  if (!fs.existsSync(envPath)) return res.json({ vars: {} })
  const vars = {}; fs.readFileSync(envPath, 'utf8').split('\n').filter(l=>l.includes('=')).forEach(line => {
    const [k,...v] = line.split('='); if (k && !k.startsWith('#')) vars[k.trim()] = v.join('=').trim()
  }); res.json({ vars })
})
router.put('/:project', (req, res) => {
  const envPath = path.join(APPS_DIR, req.params.project, '.env')
  const content = Object.entries(req.body.vars).map(([k,v]) => `${k}=${v}`).join('\n')
  fs.writeFileSync(envPath, content + '\n')
  exec(`pm2 describe ${req.params.project}`, (err) => { if (!err) exec(`pm2 restart ${req.params.project}`) })
  res.json({ ok: true })
})
module.exports = router
