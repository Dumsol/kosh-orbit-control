const { Client } = require('pg');

const sql = `
CREATE TABLE IF NOT EXISTS deploy_history (
  id            BIGSERIAL PRIMARY KEY,
  service_name  TEXT NOT NULL,
  revision      TEXT,
  status        TEXT,
  deployed_by   TEXT,
  build_log_url TEXT,
  deployed_at   TIMESTAMPTZ DEFAULT NOW()
);
`;

async function run() {
  const connectionString = process.env.DB_LOGS_URL;
  if (!connectionString) {
    throw new Error("DB_LOGS_URL is required. Configure via Secret Manager/KOSH_CONFIG.");
  }
  const client = new Client({
    connectionString
  });
  try {
    await client.connect();
    await client.query(sql);
    console.log("[OK] Table deploy_history created in logs_db");
  } catch (err) {
    console.error("Migration failed:", err.message);
  } finally {
    await client.end();
  }
}

run();
