const fs = require('fs');
const path = require('path');
const { createClient } = require('./db_client');

async function run() {
  const client = createClient();

  await client.connect();

  console.log('Resetting hierarchy tables and applying strict uniqueness...');
  await client.query(`
    DELETE FROM targets;
    DELETE FROM user_scopes;
    DELETE FROM territories;
    DELETE FROM regions;
    DELETE FROM wings;
    DELETE FROM divisions;

    DO $$ BEGIN
      ALTER TABLE divisions ADD CONSTRAINT uq_divisions_comp_name UNIQUE (company_id, name);
    EXCEPTION WHEN others THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE wings ADD CONSTRAINT uq_wings_div_name UNIQUE (division_id, name);
    EXCEPTION WHEN others THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE regions ADD CONSTRAINT uq_regions_wing_name UNIQUE (wing_id, name);
    EXCEPTION WHEN others THEN NULL;
    END $$;
  `);

  // Now re-run seed migrations 3 and 4
  const mig3 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/00003_seed_data.sql'), 'utf-8');
  await client.query(mig3);
  console.log('✓ Migration 00003 re-applied cleanly.');

  const mig4 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/00004_seed_users_and_targets.sql'), 'utf-8');
  await client.query(mig4);
  console.log('✓ Migration 00004 re-applied cleanly.');

  const res = await client.query('SELECT t.id, t.name, r.name as region, t.sort_order FROM territories t JOIN regions r ON t.region_id = r.id ORDER BY t.sort_order;');
  console.log('\nFinal Verified Territories in Database:');
  console.table(res.rows);

  const users = await client.query('SELECT u.email, u.full_name, r.name as role FROM user_profiles u JOIN roles r ON u.role_id = r.id;');
  console.log('\nFinal Verified Users in Database:');
  console.table(users.rows);

  const targets = await client.query('SELECT count(*) as total_targets FROM targets;');
  console.log('\nTotal Seeded Brand Targets:', targets.rows[0].total_targets);

  await client.end();
}

run().catch(console.error);
