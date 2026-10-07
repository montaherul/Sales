const { createClient } = require('./db_client');
const bcrypt = require('bcryptjs');

async function test() {
  const client = createClient();
  await client.connect();

  const emails = [
    'admin@afaztobacco.com',
    'rso.satkania@afaztobacco.com',
    'tso.keranihat@afaztobacco.com',
    'csr.keranihat@afaztobacco.com',
  ];

  console.log('Testing authentication for all 4 roles:');
  for (const email of emails) {
    const res = await client.query('SELECT sp_get_user_for_auth($1) as user_context', [email]);
    const u = res.rows[0].user_context;
    if (!u) {
      console.log(`❌ User not found: ${email}`);
      continue;
    }
    const is123Valid = bcrypt.compareSync('123', u.passwordHash);
    console.log(`✓ ${u.role}: ${u.email} -> password "123" valid: ${is123Valid}, company: ${u.companyName}, territory: ${u.territoryName}`);
  }

  await client.end();
}

test().catch(console.error);
