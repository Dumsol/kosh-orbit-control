'use strict'
const express = require('express')
const router = express.Router()
const { metricsPool } = require('./_db')

const pg = metricsPool()
const fetch = (() => {
  try { return require('node-fetch') } catch { return global.fetch }
})()

const toNum = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const toBool = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'boolean') return value
  const s = String(value).toLowerCase().trim()
  if (['1', 'true', 'yes', 'on'].includes(s)) return true
  if (['0', 'false', 'no', 'off'].includes(s)) return false
  return fallback
}

const getProjectId = () =>
  process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || ''

const getRegion = () => process.env.GCP_REGION || process.env.REGION || 'southamerica-east1'

const getAccessToken = async () => {
  if (process.env.GCP_ACCESS_TOKEN) return process.env.GCP_ACCESS_TOKEN

  const metadataUrl = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token'
  const resp = await fetch(metadataUrl, {
    method: 'GET',
    headers: { 'Metadata-Flavor': 'Google' },
    timeout: 4000,
  })

  if (!resp.ok) {
    const txt = await resp.text()
    throw new Error(`metadata token failed: ${resp.status} ${txt}`)
  }

  const data = await resp.json()
  if (!data.access_token) throw new Error('metadata token response without access_token')
  return data.access_token
}

const getRunServicePath = ({ projectId, region, service }) =>
  `https://run.googleapis.com/v2/projects/${projectId}/locations/${region}/services/${service}`

const gcpRequest = async ({ url, method = 'GET', body }) => {
  const token = await getAccessToken()
  const resp = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    timeout: 15000,
  })

  const text = await resp.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = { raw: text } }

  if (!resp.ok) {
    throw new Error(`GCP ${method} ${url} failed: ${resp.status} ${text}`)
  }

  return data
}

const upsertAction = async ({ project, service, action, reason, actor, executed, details }) => {
  await pg.query(
    `
    INSERT INTO cost_actions (project_slug, service_name, action, reason, actor, executed, details)
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
    `,
    [project, service, action, reason, actor, !!executed, JSON.stringify(details || {})]
  )
}

;(async () => {
  try {
    await pg.query(`
      CREATE TABLE IF NOT EXISTS cost_policies (
        project_slug TEXT PRIMARY KEY,
        monthly_budget NUMERIC DEFAULT 0,
        threshold_pct NUMERIC DEFAULT 90,
        auto_pause_enabled BOOLEAN DEFAULT FALSE,
        pause_services TEXT[] DEFAULT ARRAY[]::TEXT[],
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS cost_actions (
        id BIGSERIAL PRIMARY KEY,
        project_slug TEXT NOT NULL,
        service_name TEXT NOT NULL,
        action TEXT NOT NULL,
        reason TEXT,
        actor TEXT DEFAULT 'panel',
        executed BOOLEAN DEFAULT FALSE,
        details JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE cost_actions ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;
    `)
  } catch (e) {
    console.error('[costs] init:', e.message)
  }
})()

router.get('/summary', async (req, res) => {
  const project = String(req.query.project || 'kosh')
  try {
    const [spentRes, policyRes] = await Promise.all([
      pg.query(
        `
        SELECT COALESCE(SUM(amount), 0)::numeric AS spent
        FROM costs
        WHERE project_slug = $1
          AND DATE_TRUNC('month', period_start) = DATE_TRUNC('month', CURRENT_DATE)
        `,
        [project]
      ),
      pg.query(
        `
        SELECT project_slug, monthly_budget, threshold_pct, auto_pause_enabled, pause_services
        FROM cost_policies
        WHERE project_slug = $1
        `,
        [project]
      ),
    ])

    const spent = toNum(spentRes.rows[0]?.spent, 0)
    const policy = policyRes.rows[0] || {
      project_slug: project,
      monthly_budget: 0,
      threshold_pct: 90,
      auto_pause_enabled: false,
      pause_services: [],
    }

    const budget = toNum(policy.monthly_budget, 0)
    const thresholdPct = toNum(policy.threshold_pct, 90)
    const usagePct = budget > 0 ? (spent / budget) * 100 : 0

    res.json({
      project,
      spent,
      budget,
      usagePct: Number(usagePct.toFixed(2)),
      thresholdPct,
      thresholdReached: budget > 0 ? usagePct >= thresholdPct : false,
      autoPauseEnabled: !!policy.auto_pause_enabled,
      pauseServices: Array.isArray(policy.pause_services) ? policy.pause_services : [],
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/services', async (req, res) => {
  const project = String(req.query.project || 'kosh')
  const months = toNum(req.query.months, 1)
  try {
    const { rows } = await pg.query(
      `
      SELECT
        source,
        COALESCE(description, source) AS label,
        COALESCE(SUM(amount), 0)::numeric AS total
      FROM costs
      WHERE project_slug = $1
        AND period_start >= CURRENT_DATE - ($2::int * 31)
      GROUP BY source, COALESCE(description, source)
      ORDER BY total DESC
      LIMIT 30
      `,
      [project, months]
    )
    res.json(rows.map((r) => ({ ...r, total: toNum(r.total, 0) })))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/actions', async (req, res) => {
  const project = String(req.query.project || 'kosh')
  try {
    const { rows } = await pg.query(
      `
      SELECT id, project_slug, service_name, action, reason, actor, executed, details, created_at
      FROM cost_actions
      WHERE project_slug = $1
      ORDER BY created_at DESC
      LIMIT 50
      `,
      [project]
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/policy', async (req, res) => {
  const project = String(req.body.project || 'kosh')
  const budget = toNum(req.body.monthlyBudget, 0)
  const thresholdPct = Math.max(1, Math.min(100, toNum(req.body.thresholdPct, 90)))
  const autoPauseEnabled = !!req.body.autoPauseEnabled
  const pauseServices = Array.isArray(req.body.pauseServices)
    ? req.body.pauseServices.map((s) => String(s).trim()).filter(Boolean)
    : []

  try {
    await pg.query(
      `
      INSERT INTO cost_policies (project_slug, monthly_budget, threshold_pct, auto_pause_enabled, pause_services, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (project_slug)
      DO UPDATE SET
        monthly_budget = EXCLUDED.monthly_budget,
        threshold_pct = EXCLUDED.threshold_pct,
        auto_pause_enabled = EXCLUDED.auto_pause_enabled,
        pause_services = EXCLUDED.pause_services,
        updated_at = NOW()
      `,
      [project, budget, thresholdPct, autoPauseEnabled, pauseServices]
    )
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/pause-service', async (req, res) => {
  const project = String(req.body.project || 'kosh')
  const service = String(req.body.service || '').trim()
  const actor = String(req.body.actor || 'panel').trim()
  const reason = String(req.body.reason || 'Budget threshold reached').trim()

  if (!service) return res.status(400).json({ error: 'service required' })

  const projectId = getProjectId()
  const region = String(req.body.region || getRegion())
  if (!projectId) return res.status(503).json({ error: 'GCP project id not configured' })

  const pauseMin = toNum(req.body.minInstances, 0)
  const pauseMax = Math.max(1, toNum(req.body.maxInstances, toNum(process.env.CLOUD_RUN_PAUSE_MAX, 1)))
  const pauseIngress = String(req.body.ingress || process.env.CLOUD_RUN_PAUSE_INGRESS || 'INGRESS_TRAFFIC_INTERNAL_ONLY')

  try {
    const serviceUrl = getRunServicePath({ projectId, region, service })
    const before = await gcpRequest({ url: serviceUrl, method: 'GET' })

    const updateMask = ['scaling.minInstanceCount', 'scaling.maxInstanceCount', 'ingress'].join(',')
    const patchBody = {
      scaling: { minInstanceCount: pauseMin, maxInstanceCount: pauseMax },
      ingress: pauseIngress,
    }

    const op = await gcpRequest({
      url: `${serviceUrl}?updateMask=${encodeURIComponent(updateMask)}`,
      method: 'PATCH',
      body: patchBody,
    })

    const details = {
      region,
      projectId,
      operation: op?.name || null,
      before: {
        ingress: before?.ingress,
        minInstanceCount: before?.scaling?.minInstanceCount,
        maxInstanceCount: before?.scaling?.maxInstanceCount,
      },
      after: {
        ingress: pauseIngress,
        minInstanceCount: pauseMin,
        maxInstanceCount: pauseMax,
      },
    }

    await upsertAction({ project, service, action: 'pause', reason, actor, executed: true, details })
    res.json({ ok: true, executed: true, details })
  } catch (e) {
    await upsertAction({
      project,
      service,
      action: 'pause',
      reason,
      actor,
      executed: false,
      details: { error: e.message },
    }).catch(() => {})
    res.status(500).json({ error: e.message })
  }
})

router.post('/resume-service', async (req, res) => {
  const project = String(req.body.project || 'kosh')
  const service = String(req.body.service || '').trim()
  const actor = String(req.body.actor || 'panel').trim()
  const reason = String(req.body.reason || 'Manual resume').trim()

  if (!service) return res.status(400).json({ error: 'service required' })

  const projectId = getProjectId()
  const region = String(req.body.region || getRegion())
  if (!projectId) return res.status(503).json({ error: 'GCP project id not configured' })

  try {
    const lastPause = await pg.query(
      `
      SELECT details
      FROM cost_actions
      WHERE project_slug = $1 AND service_name = $2 AND action = 'pause'
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [project, service]
    )

    const previous = lastPause.rows[0]?.details?.before || {}
    const resumeMin = toNum(req.body.minInstances, toNum(previous.minInstanceCount, 0))
    const resumeMax = Math.max(1, toNum(req.body.maxInstances, toNum(previous.maxInstanceCount, toNum(process.env.CLOUD_RUN_RESUME_MAX, 10))))
    const resumeIngress = String(req.body.ingress || previous.ingress || process.env.CLOUD_RUN_RESUME_INGRESS || 'INGRESS_TRAFFIC_ALL')

    const serviceUrl = getRunServicePath({ projectId, region, service })
    const updateMask = ['scaling.minInstanceCount', 'scaling.maxInstanceCount', 'ingress'].join(',')
    const patchBody = {
      scaling: { minInstanceCount: resumeMin, maxInstanceCount: resumeMax },
      ingress: resumeIngress,
    }

    const op = await gcpRequest({
      url: `${serviceUrl}?updateMask=${encodeURIComponent(updateMask)}`,
      method: 'PATCH',
      body: patchBody,
    })

    const details = {
      region,
      projectId,
      operation: op?.name || null,
      after: {
        ingress: resumeIngress,
        minInstanceCount: resumeMin,
        maxInstanceCount: resumeMax,
      },
    }

    await upsertAction({ project, service, action: 'resume', reason, actor, executed: true, details })
    res.json({ ok: true, executed: true, details })
  } catch (e) {
    await upsertAction({
      project,
      service,
      action: 'resume',
      reason,
      actor,
      executed: false,
      details: { error: e.message },
    }).catch(() => {})
    res.status(500).json({ error: e.message })
  }
})

router.post('/enforce', async (req, res) => {
  const project = String(req.body.project || 'kosh')
  try {
    const [summaryRes, policyRes] = await Promise.all([
      pg.query(
        `SELECT COALESCE(SUM(amount), 0)::numeric AS spent
         FROM costs
         WHERE project_slug=$1 AND DATE_TRUNC('month', period_start)=DATE_TRUNC('month', CURRENT_DATE)`,
        [project]
      ),
      pg.query(`SELECT monthly_budget, threshold_pct, auto_pause_enabled, pause_services FROM cost_policies WHERE project_slug=$1`, [project]),
    ])

    const policy = policyRes.rows[0]
    if (!policy) return res.json({ ok: true, skipped: true, reason: 'no_policy' })
    if (!toBool(policy.auto_pause_enabled, false)) return res.json({ ok: true, skipped: true, reason: 'auto_pause_disabled' })

    const spent = toNum(summaryRes.rows[0]?.spent, 0)
    const budget = toNum(policy.monthly_budget, 0)
    const threshold = toNum(policy.threshold_pct, 90)
    if (budget <= 0) return res.json({ ok: true, skipped: true, reason: 'budget_not_set' })

    const usage = (spent / budget) * 100
    if (usage < threshold) return res.json({ ok: true, skipped: true, reason: 'threshold_not_reached', usage })

    const targets = Array.isArray(policy.pause_services) ? policy.pause_services : []
    const results = []
    for (const service of targets) {
      try {
        const fakeReq = { body: { project, service, reason: `auto-pause threshold ${usage.toFixed(2)}%` } }
        const fakeRes = { statusCode: 200 }
        // Reuse the same logic through direct call helper by mimicking route action.
        // For simplicity and determinism, execute PATCH inline.
        const projectId = getProjectId()
        const region = getRegion()
        const serviceUrl = getRunServicePath({ projectId, region, service })
        const before = await gcpRequest({ url: serviceUrl, method: 'GET' })
        const updateMask = ['scaling.minInstanceCount', 'scaling.maxInstanceCount', 'ingress'].join(',')
        const patchBody = {
          scaling: {
            minInstanceCount: 0,
            maxInstanceCount: Math.max(1, toNum(process.env.CLOUD_RUN_PAUSE_MAX, 1)),
          },
          ingress: process.env.CLOUD_RUN_PAUSE_INGRESS || 'INGRESS_TRAFFIC_INTERNAL_ONLY',
        }
        const op = await gcpRequest({
          url: `${serviceUrl}?updateMask=${encodeURIComponent(updateMask)}`,
          method: 'PATCH',
          body: patchBody,
        })
        await upsertAction({
          project,
          service,
          action: 'pause',
          reason: `auto-pause threshold ${usage.toFixed(2)}%`,
          actor: 'auto-budget-enforcer',
          executed: true,
          details: {
            operation: op?.name || null,
            before: {
              ingress: before?.ingress,
              minInstanceCount: before?.scaling?.minInstanceCount,
              maxInstanceCount: before?.scaling?.maxInstanceCount,
            },
            after: patchBody,
          },
        })
        results.push({ service, ok: true })
      } catch (e) {
        results.push({ service, ok: false, error: e.message })
      }
    }

    res.json({ ok: true, usage, threshold, services: results })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router
