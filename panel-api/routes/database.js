'use strict'
const express = require('express'), router = express.Router()
const { adminPool, VM_IP } = require('./_db')
const adminPg = adminPool
router.get('/', async (req, res) => {
  const pg = adminPg()
  try { const { rows } = await pg.query("SELECT datname AS name, pg_size_pretty(pg_database_size(datname)) AS size FROM pg_database WHERE datistemplate=false ORDER BY datname"); res.json(rows) } catch (e) { res.status(500).json({ error: e.message }) } finally { await pg.end() }
});
router.post('/', async (req, res) => {
  const { dbname, username, password } = req.body
  if (!dbname || !username || !password) return res.status(400).json({ error: 'dbname, username e password obrigatórios' })
  const pg = adminPg()
  try {
    await pg.query(`CREATE DATABASE ${dbname}`); await pg.query(`CREATE USER ${username} WITH PASSWORD '${password}'`); await pg.query(`GRANT ALL PRIVILEGES ON DATABASE ${dbname} TO ${username}`);
    res.json({ ok:true, connection_string:`postgresql://${username}:${password}@${VM_IP}:5432/${dbname}` })
  } catch (e) { res.status(500).json({ error: e.message }) } finally { await pg.end() }
});
module.exports = router
