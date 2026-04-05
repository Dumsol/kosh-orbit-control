'use strict'
const { Pool } = require('pg')
const Redis = require('ioredis')

const VM_IP = process.env.VM_IP || '127.0.0.1'

const logsPool = () =>
  new Pool({
    connectionString:
      process.env.DB_LOGS_URL ||
      `postgresql://logs_user:${process.env.LOGS_DB_PASS}@${VM_IP}:5432/logs_db`,
    ssl: false,
    max: 3,
  })

const metricsPool = () =>
  new Pool({
    connectionString:
      process.env.DB_METRICS_URL ||
      `postgresql://postgres:${process.env.DB_ADMIN_PASS}@${VM_IP}:5432/metrics_db`,
    ssl: false,
    max: 3,
  })

const adminPool = () => {
  const base = process.env.DB_METRICS_URL || ''
  const adminUrl = base.replace(/\/metrics_db/, '/postgres').replace(/\/[^/]+$/, '/postgres')
  return new Pool({
    connectionString: adminUrl || `postgresql://postgres:${process.env.DB_ADMIN_PASS}@${VM_IP}:5432/postgres`,
    ssl: false,
    max: 2,
  })
}

let _redis = null
const redisClient = () => {
  if (!_redis) {
    _redis = new Redis(process.env.REDIS_URL || `redis://:${process.env.REDIS_PASSWORD}@${VM_IP}:6379`, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
    })
    _redis.on('error', () => {})
  }
  return _redis
}

module.exports = { logsPool, metricsPool, adminPool, redisClient, VM_IP }
