const { createClient } = require('./db_client');

async function testCreateCompanyAdmin() {
  console.log('Testing creating a Company Admin for an existing company via API...');

  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@afaztobacco.com', password: '123' }),
  });
  const cookie = loginRes.headers.get('set-cookie').split(';')[0];

  const client = createClient();
  await client.connect();
  const atcRes = await client.query("SELECT id, name FROM companies WHERE code = 'ATC'");
  const atcId = atcRes.rows[0].id;
  const atcName = atcRes.rows[0].name;
  await client.end();

  const createRes = await fetch('http://localhost:3000/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      fullName: 'ATC Operations Administrator',
      email: 'ops.atc@afaztobacco.com',
      phone: '+8801755555555',
      password: '123',
      roleName: 'COMPANY_ADMIN',
      companyId: atcId,
    }),
  });

  const json = await createRes.json();
  console.log(`✓ User creation response status ${createRes.status}:`, json);

  // Verify logging in as the newly created Company Admin
  const newLoginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ops.atc@afaztobacco.com', password: '123' }),
  });
  const newJson = await newLoginRes.json();
  console.log(
    `✓ New Company Admin login status ${newLoginRes.status}:`,
    `Name: ${newJson.user?.fullName}, Role: ${newJson.user?.role}, Company: ${newJson.user?.companyName}`
  );
}

testCreateCompanyAdmin().catch(console.error);
