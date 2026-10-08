const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function runMigration() {
  const envPath = path.resolve(__dirname, '../.env.local');
  let dbUrl = process.env.DATABASE_URL;
  if (!dbUrl && fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
    if (match) dbUrl = match[1];
  }

  if (!dbUrl) {
    console.error('DATABASE_URL not found in', envPath);
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const sqlFile = path.resolve(__dirname, '../database/migrations/00012_configurable_tenant_organization.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    console.log('Running migration 00012_configurable_tenant_organization.sql...');
    await pool.query(sql);
    console.log('Migration 00012 executed successfully!');

    // Test provisioner result
    const checkDept = await pool.query('SELECT count(*) FROM departments');
    console.log('Departments count in DB:', checkDept.rows[0].count);
    const checkPos = await pool.query('SELECT count(*) FROM positions');
    console.log('Positions count in DB:', checkPos.rows[0].count);
    const checkDist = await pool.query('SELECT count(*) FROM distributors');
    console.log('Distributors count in DB:', checkDist.rows[0].count);

    await pool.end();
  } catch (err) {
    console.error('Migration failed:', err);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
