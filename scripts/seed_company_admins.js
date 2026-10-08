const bcrypt = require('bcryptjs');
const { createClient } = require('./db_client');

async function seedCompanyAdmins() {
  const client = createClient();
  try {
    await client.connect();
    const hash = bcrypt.hashSync('123', 10);

    const roleRes = await client.query("SELECT id FROM roles WHERE name = 'COMPANY_ADMIN'");
    const roleId = roleRes.rows[0].id;

    const atcRes = await client.query("SELECT id FROM companies WHERE code = 'ATC'");
    const atcId = atcRes.rows[0].id;

    const atiRes = await client.query("SELECT id FROM companies WHERE code = 'ATI'");
    const atiId = atiRes.rows[0].id;

    // ATC Company Admin
    const u1 = await client.query(`
      INSERT INTO user_profiles (email, full_name, phone, role_id, is_active, password_hash, must_change_password, is_onboarded)
      VALUES ($1, $2, $3, $4, TRUE, $5, FALSE, TRUE)
      ON CONFLICT (email) DO UPDATE 
      SET role_id = EXCLUDED.role_id, full_name = EXCLUDED.full_name
      RETURNING id;
    `, ['admin.atc@afaztobacco.com', 'Afaz Company Administrator', '+8801711111111', roleId, hash]);

    await client.query('DELETE FROM user_scopes WHERE user_id = $1;', [u1.rows[0].id]);
    await client.query('INSERT INTO user_scopes (user_id, company_id) VALUES ($1, $2);', [u1.rows[0].id, atcId]);

    // ATI Company Admin
    const u2 = await client.query(`
      INSERT INTO user_profiles (email, full_name, phone, role_id, is_active, password_hash, must_change_password, is_onboarded)
      VALUES ($1, $2, $3, $4, TRUE, $5, FALSE, TRUE)
      ON CONFLICT (email) DO UPDATE 
      SET role_id = EXCLUDED.role_id, full_name = EXCLUDED.full_name
      RETURNING id;
    `, ['admin.ati@akijtobacco.com', 'Akij Company Administrator', '+8801722222222', roleId, hash]);

    await client.query('DELETE FROM user_scopes WHERE user_id = $1;', [u2.rows[0].id]);
    await client.query('INSERT INTO user_scopes (user_id, company_id) VALUES ($1, $2);', [u2.rows[0].id, atiId]);

    console.log('✓ Successfully seeded Company Admins for ATC (admin.atc@afaztobacco.com) and ATI (admin.ati@akijtobacco.com)!');
  } catch (err) {
    console.error('Failed to seed company admins:', err);
  } finally {
    await client.end();
  }
}

seedCompanyAdmins();
