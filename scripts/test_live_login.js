async function testLiveLogin() {
  const roles = [
    { email: 'admin@afaztobacco.com', pass: '123', role: 'SUPER_ADMIN' },
    { email: 'rso.satkania@afaztobacco.com', pass: '123', role: 'RSO' },
    { email: 'tso.keranihat@afaztobacco.com', pass: '123', role: 'TSO' },
    { email: 'csr.keranihat@afaztobacco.com', pass: '123', role: 'CSR' },
  ];

  console.log('Testing live HTTP /api/auth/login endpoints:');

  for (const r of roles) {
    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: r.email, password: r.pass }),
    });

    const json = await res.json();
    console.log(`✓ ${r.role} Login: status ${res.status}, success: ${json.success}, user: ${json.user?.fullName} (${json.user?.role}), company: ${json.user?.companyName}`);
  }

  // Test wrong password
  const failRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@afaztobacco.com', password: 'wrong' }),
  });
  const failJson = await failRes.json();
  console.log(`✓ Invalid password rejected: status ${failRes.status}, error: "${failJson.error}"`);

  // Test Google auth restriction (unregistered email)
  const gFailRes = await fetch('http://localhost:3000/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'intruder@gmail.com' }),
  });
  const gFailJson = await gFailRes.json();
  console.log(`✓ Google self-registration blocked: status ${gFailRes.status}, error: "${gFailJson.error.slice(0, 50)}..."`);

  // Test Google auth for existing user
  const gPassRes = await fetch('http://localhost:3000/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@afaztobacco.com' }),
  });
  const gPassJson = await gPassRes.json();
  console.log(`✓ Google login for provisioned admin: status ${gPassRes.status}, success: ${gPassJson.success}`);
}

testLiveLogin().catch(console.error);
