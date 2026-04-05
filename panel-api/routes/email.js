'use strict'
const express = require('express'), { exec } = require('child_process'), router = express.Router();
const STALWART = '/usr/local/bin/stalwart-mail'; const CONFIG = '--config /etc/stalwart/config.toml'
router.get('/accounts', (req, res) => { exec(`${STALWART} ${CONFIG} account list 2>&1`, (err, stdout) => res.json({ output: stdout, error: err?.message })) })
router.post('/accounts', (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'email e password obrigatórios' })
  exec(`${STALWART} ${CONFIG} account create ${email} ${password}`, (err, stdout, stderr) => { if (err) return res.status(500).json({ error: stderr }); res.json({ ok: true, output: stdout }) })
})
router.delete('/accounts/:email', (req, res) => {
  exec(`${STALWART} ${CONFIG} account delete ${req.params.email}`, (err, stdout, stderr) => { if (err) return res.status(500).json({ error: stderr }); res.json({ ok: true }) })
})
module.exports = router
