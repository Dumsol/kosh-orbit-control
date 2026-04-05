'use strict'
const express = require('express'), fetch = require('node-fetch'), fs = require('fs'), router = express.Router();
const creds = {}; try { fs.readFileSync('/home/deploy/.credentials', 'utf8').split('\n').filter(l=>l.includes('=')).forEach(l=>{const [k,...v]=l.split('=');creds[k.trim()]=v.join('=').trim()}) } catch(e){}
const REGISTRY = 'http://127.0.0.1:4873'; const AUTH = Buffer.from(`kosh:${creds.VERDACCIO_PASS}`).toString('base64')
router.get('/packages', async (req, res) => {
  try {
    const r = await fetch(`${REGISTRY}/-/all`, { headers: { Authorization: `Basic ${AUTH}` } }); const data = await r.json()
    const packages = Object.entries(data).filter(([k]) => k !== '_updated').map(([name, info]) => ({ name, version: info['dist-tags']?.latest, description: info.description, modified: info.time?.modified }))
    res.json(packages)
  } catch (e) { res.status(500).json({ error: e.message }) }
});
router.delete('/packages/:name', async (req, res) => {
  const { exec } = require('child_process'); exec(`npm unpublish ${req.params.name} --registry ${REGISTRY} --force`, (err, out) => {
    if (err) return res.status(500).json({ error: err.message }); res.json({ ok: true })
  })
});
module.exports = router
