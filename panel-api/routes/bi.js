'use strict';
const express = require('express'), router = express.Router();
const { metricsPool } = require('./_db');
const pgMetrics = metricsPool();

// Auto-create metrics_db tables on startup
// v_mrr_monthly may exist as a VIEW — use dedicated writable table mrr_data
;(async () => {
  try {
    await pgMetrics.query(`
      CREATE TABLE IF NOT EXISTS mrr_data (
        project_slug TEXT, month DATE, revenue NUMERIC DEFAULT 0, paying_customers INT DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS cohort_metrics (
        project_slug TEXT, cohort_month DATE, months_after INT, retained INT DEFAULT 0, cohort_size INT DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS funnel_steps (
        project_slug TEXT, funnel_name TEXT, step_name TEXT, step_order INT,
        users INT DEFAULT 0, sessions INT DEFAULT 0, event_date DATE
      );
      CREATE TABLE IF NOT EXISTS acquisition_metrics (
        source TEXT, project_slug TEXT, cac NUMERIC DEFAULT 0, ltv NUMERIC DEFAULT 0,
        payback_months INT DEFAULT 0, created_at DATE DEFAULT CURRENT_DATE
      );
      CREATE TABLE IF NOT EXISTS seo_metrics (
        project_slug TEXT, query TEXT, clicks INT DEFAULT 0, impressions INT DEFAULT 0,
        position NUMERIC DEFAULT 0, ctr NUMERIC DEFAULT 0, date DATE DEFAULT CURRENT_DATE
      );
      CREATE TABLE IF NOT EXISTS costs (
        project TEXT, project_slug TEXT, category TEXT, source TEXT, description TEXT,
        amount NUMERIC DEFAULT 0, period_start DATE DEFAULT CURRENT_DATE
      );
    `)
    // Ensure funnel_steps.event_date allows NULL (ALTER if already exists with NOT NULL)
    await pgMetrics.query(`ALTER TABLE funnel_steps ALTER COLUMN event_date DROP NOT NULL`).catch(() => {})
  } catch (e) { console.error('[bi] metrics_db init:', e.message) }
})()

// GET /bi/seed — Insert sample data for demo/testing
router.get('/seed', async (req, res) => {
  const errors = []
  try {
    // Clear and re-seed MRR (12 months for kosh) — use mrr_data (writable table)
    await pgMetrics.query(`DELETE FROM mrr_data WHERE project_slug='kosh'`).catch(e => errors.push('del_mrr:'+e.message))
    const now = new Date()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const month = d.toISOString().slice(0, 10)
      const base = 1200 + (11 - i) * 180
      const revenue = Math.round((base + Math.random() * 200) * 100) / 100
      const customers = Math.round(8 + (11 - i) * 1.5)
      await pgMetrics.query(
        `INSERT INTO mrr_data (project_slug, month, revenue, paying_customers) VALUES ($1, $2, $3, $4)`,
        ['kosh', month, revenue, customers]
      ).catch(e => errors.push('ins_mrr:'+e.message))
    }
    // Sample acquisition data
    await pgMetrics.query(`DELETE FROM acquisition_metrics WHERE project_slug='kosh'`).catch(e => errors.push(e.message))
    for (const [source, cac, ltv, payback] of [
      ['Google Ads', 45, 520, 7], ['Organic', 12, 480, 4],
      ['Referral', 30, 390, 6],   ['Direct', 8, 310, 3],
    ]) {
      await pgMetrics.query(
        `INSERT INTO acquisition_metrics (source, project_slug, cac, ltv, payback_months) VALUES ($1, 'kosh', $2, $3, $4)`,
        [source, cac, ltv, payback]
      ).catch(e => errors.push(e.message))
    }
    // Sample funnel
    await pgMetrics.query(`DELETE FROM funnel_steps WHERE project_slug='kosh'`).catch(e => errors.push(e.message))
    for (const [step, order, sessions] of [
      ['Landing Page', 1, 4200], ['Sign Up', 2, 1890], ['Onboarding', 3, 1240],
      ['Trial Start', 4, 820],   ['Purchase', 5, 310],
    ]) {
      await pgMetrics.query(
        `INSERT INTO funnel_steps (project_slug, funnel_name, step_name, step_order, sessions, users, event_date) VALUES ('kosh', 'main_funnel', $1, $2, $3, $3, CURRENT_DATE)`,
        [step, order, sessions]
      ).catch(e => errors.push(e.message))
    }
    res.json({ ok: errors.length === 0, message: 'Seed complete', errors })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// 1. MRR por mês — reads from mrr_data (writable), falls back to v_mrr_monthly view
router.get('/mrr', async (req, res) => {
  const { project } = req.query;
  try {
    // Try writable table first
    const { rows } = await pgMetrics.query(`
      SELECT project_slug, month::text, revenue, paying_customers
      FROM mrr_data
      ${project ? 'WHERE project_slug=$1' : ''}
      ORDER BY month
    `, project ? [project] : []);
    if (rows.length > 0) return res.json(rows);
    // Fallback to view (read-only, populated by real integrations)
    const { rows: viewRows } = await pgMetrics.query(`
      SELECT project_slug, month::text, revenue, paying_customers
      FROM v_mrr_monthly
      ${project ? 'WHERE project_slug=$1' : ''}
      ORDER BY month
    `, project ? [project] : []).catch(() => ({ rows: [] }));
    res.json(viewRows);
  } catch (e) { res.status(500).json({ error: e.message }) }
});

// 2. Cohort retention
router.get('/cohort', async (req, res) => {
  const { project } = req.query;
  try {
    const { rows } = await pgMetrics.query(`
      SELECT * FROM cohort_metrics
      WHERE project_slug=$1
      ORDER BY cohort_month, months_after
    `, [project || 'all']);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }) }
});

// 3. Funil (GA4/Internal)
router.get('/funnel', async (req, res) => {
  const { project, funnel = 'main_funnel', days = 30 } = req.query;
  try {
    const { rows } = await pgMetrics.query(`
      SELECT step_name, step_order, SUM(users) AS users, SUM(sessions) AS sessions
      FROM funnel_steps
      WHERE project_slug=$1 AND funnel_name=$2
        AND event_date >= CURRENT_DATE - $3::int
      GROUP BY step_name, step_order ORDER BY step_order
    `, [project, funnel, days]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }) }
});

// 4. Aquisição (CAC / LTV / Payback)
router.get('/acquisition', async (req, res) => {
  const { project } = req.query;
  try {
    const { rows } = await pgMetrics.query(`
      SELECT source, cac, ltv, payback_months, created_at
      FROM acquisition_metrics
      WHERE project_slug=$1
      ORDER BY created_at DESC
    `, [project || 'all']);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }) }
});

// 5. SEO (Clicks / Impressions / GSC)
router.get('/seo', async (req, res) => {
  const { project, days = 30 } = req.query;
  try {
    const { rows } = await pgMetrics.query(`
      SELECT query, clicks, impressions, position, ctr
      FROM seo_metrics
      WHERE project_slug=$1 AND date >= CURRENT_DATE - $2::int
      ORDER BY clicks DESC LIMIT 50
    `, [project || 'all', days]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }) }
});

// 6. GCP Billing por serviço
router.get('/costs', async (req, res) => {
  const { project, months = 3 } = req.query;
  try {
    const { rows } = await pgMetrics.query(`
      SELECT category, source, description,
             SUM(amount) AS total,
             DATE_TRUNC('month', period_start)::date AS month
      FROM costs
      WHERE project_slug=$1
        AND period_start >= CURRENT_DATE - ($2::int * 30)
      GROUP BY 1,2,3,5 ORDER BY 5 DESC, 4 DESC
    `, [project || 'kosh', months]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }) }
});

module.exports = router;
