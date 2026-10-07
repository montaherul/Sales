const fs = require('fs');
const path = require('path');
const { createClient } = require('./db_client');

async function runMigrations() {
  console.log('Connecting to Supabase PostgreSQL database...');
  const client = createClient();

  try {
    await client.connect();
    console.log('Connected successfully to Supabase database!');

    const migrations = [
      '00001_initial_schema.sql',
      '00002_rls_policies.sql',
      '00003_seed_data.sql',
      '00004_seed_users_and_targets.sql',
      '00005_menu_management.sql',
    ];

    for (const mig of migrations) {
      const filePath = path.resolve(process.cwd(), 'supabase', 'migrations', mig);
      if (!fs.existsSync(filePath)) {
        console.error(`Migration file not found: ${filePath}`);
        continue;
      }
      console.log(`Executing migration ${mig}...`);
      const sql = fs.readFileSync(filePath, 'utf-8');
      await client.query(sql);
      console.log(`✓ Migration ${mig} applied successfully.`);
    }

    // Verify seeded tables
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('\nVerified Public Tables in Database:');
    res.rows.forEach(r => console.log(' - ' + r.table_name));

    // Check seeded regions & territories
    const territories = await client.query('SELECT name FROM territories ORDER BY sort_order;');
    console.log('\nSeeded Territories:');
    territories.rows.forEach(t => console.log(' - ' + t.name));

  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await client.end();
  }
}

runMigrations();
