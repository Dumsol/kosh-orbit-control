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
  const client = new Client({
    connectionString: "postgresql://logs_user:vPHIXbAFy7hifp8D6E4dVXIx7ZESYEbU@127.0.0.1:5432/logs_db?sslmode=require"
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
