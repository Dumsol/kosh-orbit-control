'use strict'
const express = require('express'), fs = require('fs'), path = require('path'), { exec } = require('child_process'), router = express.Router();
const APPS_DIR = '/home/deploy/apps'; const REPOS_DIR = '/home/deploy/repos'
router.get('/', (req, res) => {
  try {
    const projects = fs.readdirSync(REPOS_DIR).filter(d => d.endsWith('.git')).map(repo => {
      const name = repo.replace('.git', ''); const histPath = path.join(APPS_DIR, name, '.deploy-history')
      const history = fs.existsSync(histPath) ? fs.readFileSync(histPath, 'utf8').trim().split('\n').slice(-10).reverse() : []
      return { name, history }
    }); res.json(projects)
  } catch { res.json([]) }
})
router.post('/new', (req, res) => {
  if (!req.body.name || !/^[a-z0-9-]+$/.test(req.body.name)) return res.status(400).json({ error: 'Nome inválido' })
  exec(`/home/deploy/new-project.sh ${req.body.name}`, (err, stdout, stderr) => { if (err) return res.status(500).json({ error: stderr }); res.json({ ok: true, output: stdout }) })
})
router.post('/rollback/:project', (req, res) => {
  const { commit } = req.body; const { project } = req.params
  const cmd = `git --work-tree=/home/deploy/apps/${project} --git-dir=/home/deploy/repos/${project}.git checkout ${commit} -f && pm2 restart ${project} 2>/dev/null || true`
  exec(cmd, (err, stdout, stderr) => { if (err) return res.status(500).json({ error: stderr }); res.json({ ok: true, output: stdout }) })
})
module.exports = router
