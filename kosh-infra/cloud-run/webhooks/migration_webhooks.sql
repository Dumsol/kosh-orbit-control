-- webhook_events: auditoria completa de todos os eventos recebidos
CREATE TABLE IF NOT EXISTS webhook_events (
  id           BIGSERIAL PRIMARY KEY,
  source       TEXT NOT NULL,
  event_type   TEXT NOT NULL,
  project_slug TEXT,
  payload      JSONB NOT NULL,
  processed    BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webhook_events_proc   ON webhook_events(processed, created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_source ON webhook_events(source, event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS customers (
  id               BIGSERIAL PRIMARY KEY,
  project_slug     TEXT NOT NULL,
  external_id      TEXT NOT NULL,
  source           TEXT NOT NULL,
  name             TEXT,
  email            TEXT,
  phone            TEXT,
  document         TEXT,
  plan_name        TEXT,
  acquired_at      TIMESTAMPTZ,
  churned_at       TIMESTAMPTZ,
  acquisition_cost NUMERIC(10,2) DEFAULT 0,
  acquisition_src  TEXT DEFAULT 'organic',
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_slug, source, external_id)
);
CREATE INDEX IF NOT EXISTS idx_customers_project ON customers(project_slug, acquired_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_email   ON customers(email) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS payments (
  id              BIGSERIAL PRIMARY KEY,
  project_slug    TEXT NOT NULL,
  customer_id     BIGINT REFERENCES customers(id),
  external_id     TEXT NOT NULL,
  source          TEXT NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,
  net_amount      NUMERIC(12,2),
  currency        TEXT DEFAULT 'BRL',
  status          TEXT NOT NULL,
  payment_method  TEXT,
  subscription_id TEXT,
  paid_at         TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source, external_id)
);
CREATE INDEX IF NOT EXISTS idx_payments_project_date ON payments(project_slug, paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status       ON payments(project_slug, status);

CREATE TABLE IF NOT EXISTS subscriptions (
  id           BIGSERIAL PRIMARY KEY,
  project_slug TEXT NOT NULL,
  customer_id  BIGINT REFERENCES customers(id),
  external_id  TEXT NOT NULL,
  source       TEXT NOT NULL,
  plan_name    TEXT,
  plan_cycle   TEXT,
  amount       NUMERIC(12,2) NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active',
  started_at   TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  metadata     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source, external_id)
);
CREATE INDEX IF NOT EXISTS idx_subs_project_status ON subscriptions(project_slug, status);

-- Subcontas Asaas por projeto (apiKey protegida aqui)
CREATE TABLE IF NOT EXISTS asaas_accounts (
  id           BIGSERIAL PRIMARY KEY,
  project_slug TEXT UNIQUE NOT NULL,
  account_id   TEXT NOT NULL,
  api_key      TEXT NOT NULL,
  wallet_id    TEXT,
  name         TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Repasses de split
CREATE TABLE IF NOT EXISTS payment_splits (
  id                  BIGSERIAL PRIMARY KEY,
  payment_external_id TEXT NOT NULL,
  source              TEXT NOT NULL DEFAULT 'asaas',
  wallet_id           TEXT NOT NULL,
  fixed_value         NUMERIC(12,2),
  percent_value       NUMERIC(5,2),
  status              TEXT DEFAULT 'pending',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(payment_external_id, wallet_id)
);

CREATE TABLE IF NOT EXISTS costs (
  id           BIGSERIAL PRIMARY KEY,
  project_slug TEXT NOT NULL,
  category     TEXT NOT NULL,
  source       TEXT NOT NULL,
  description  TEXT,
  amount       NUMERIC(12,2) NOT NULL,
  currency     TEXT DEFAULT 'BRL',
  period_start DATE NOT NULL,
  period_end   DATE NOT NULL,
  metadata     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cohort_metrics (
  id             BIGSERIAL PRIMARY KEY,
  project_slug   TEXT NOT NULL,
  cohort_month   DATE NOT NULL,
  months_after   INT NOT NULL,
  cohort_size    INT NOT NULL,
  retained       INT NOT NULL,
  retention_rate NUMERIC(5,2),
  mrr_retained   NUMERIC(12,2),
  calculated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_slug, cohort_month, months_after)
);

CREATE TABLE IF NOT EXISTS funnel_steps (
  id           BIGSERIAL PRIMARY KEY,
  project_slug TEXT NOT NULL,
  funnel_name  TEXT NOT NULL DEFAULT 'main_funnel',
  step_name    TEXT NOT NULL,
  step_order   INT NOT NULL DEFAULT 0,
  event_date   DATE NOT NULL,
  users        INT DEFAULT 0,
  sessions     INT DEFAULT 0,
  source       TEXT DEFAULT 'ga4',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_slug, funnel_name, step_name, event_date)
);

CREATE TABLE IF NOT EXISTS seo_metrics (
  id           BIGSERIAL PRIMARY KEY,
  project_slug TEXT NOT NULL,
  domain       TEXT NOT NULL,
  date         DATE NOT NULL,
  clicks       INT DEFAULT 0,
  impressions  INT DEFAULT 0,
  ctr          NUMERIC(6,4),
  position     NUMERIC(7,2),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_slug, domain, date)
);

CREATE TABLE IF NOT EXISTS projects (
  slug            TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  currency        TEXT DEFAULT 'BRL',
  color           TEXT DEFAULT '#b87333',
  ga4_property_id TEXT,
  gsc_domain      TEXT,
  funnel_config   JSONB,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO projects (slug, name) VALUES
  ('gpcerto', 'GpCerto'), ('queja', 'Queja'),
  ('cspfood', 'CSP Food'), ('nakta', 'Nakta'), ('kosh', 'Kosh Admin')
ON CONFLICT (slug) DO NOTHING;

-- Views
CREATE OR REPLACE VIEW v_mrr_monthly AS
SELECT project_slug, DATE_TRUNC('month', paid_at)::date AS month,
  SUM(amount) AS revenue, COUNT(DISTINCT customer_id) AS paying_customers
FROM payments WHERE status IN ('paid','received')
  AND paid_at >= NOW() - INTERVAL '13 months'
GROUP BY 1,2;

CREATE OR REPLACE VIEW v_churn_monthly AS
SELECT project_slug, DATE_TRUNC('month', churned_at)::date AS month,
  COUNT(*) AS churned_customers
FROM customers WHERE churned_at IS NOT NULL GROUP BY 1,2;

CREATE OR REPLACE VIEW v_cac_by_source AS
SELECT project_slug, acquisition_src AS source,
  DATE_TRUNC('month', acquired_at)::date AS month,
  COUNT(*) AS new_customers, AVG(acquisition_cost) AS avg_cac
FROM customers WHERE acquired_at IS NOT NULL GROUP BY 1,2,3;
