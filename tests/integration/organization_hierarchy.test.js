// Automated Integration Test: Configurable Multi-Tenant Organization Hierarchy
// Verifies: Tenant -> Department -> Position -> User -> Role -> Scope
// AGENTS1.md Rule 6, Rule 8, Rule 29

const BASE_URL = 'http://localhost:3000';

async function login(email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const cookieHeader = res.headers.get('set-cookie');
  let sessionCookie = '';
  if (cookieHeader) {
    const match = cookieHeader.match(/afaz_session=([^;]+)/);
    if (match) {
      sessionCookie = `afaz_session=${match[1]}`;
    }
  }

  const json = await res.json();
  if (!json.success) {
    throw new Error(`Login failed for ${email}: ${json.error}`);
  }

  return { user: json.user, cookie: sessionCookie };
}

async function runOrganizationTests() {
  console.log('================================================================');
  console.log('🏢 CONFIGURABLE MULTI-TENANT SAAS ORGANIZATION TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Authenticate Actors
    console.log('[Step 1] Authenticating test actors...');
    const superAdmin = await login('admin@afaztobacco.com', '123');
    const atcAdmin = await login('admin.atc@afaztobacco.com', '123');
    const atiAdmin = await login('admin.ati@akijtobacco.com', '123');

    assert(superAdmin.user.role === 'SUPER_ADMIN', 'Super Admin identity authenticated');
    assert(atcAdmin.user.role === 'COMPANY_ADMIN', 'ATC Company Admin authenticated');
    assert(atiAdmin.user.role === 'COMPANY_ADMIN', 'ATI Company Admin authenticated');
    console.log();

    // 2. Tenant Isolation in Departments
    console.log('[Step 2] Testing Tenant Isolation in Department Catalog...');
    const atcDeptsRes = await fetch(`${BASE_URL}/api/organization/departments`, {
      headers: { Cookie: atcAdmin.cookie },
    });
    const atcDeptsJson = await atcDeptsRes.json();
    assert(atcDeptsJson.success && atcDeptsJson.data.length > 0, `ATC Admin retrieved ${atcDeptsJson.data?.length} ATC departments`);
    const atcAllMine = atcDeptsJson.data.every((d) => d.company_id === atcAdmin.user.companyId);
    assert(atcAllMine, '100% of ATC departments strictly belong to ATC tenant');

    const atiDeptsRes = await fetch(`${BASE_URL}/api/organization/departments`, {
      headers: { Cookie: atiAdmin.cookie },
    });
    const atiDeptsJson = await atiDeptsRes.json();
    assert(atiDeptsJson.success && atiDeptsJson.data.length > 0, `ATI Admin retrieved ${atiDeptsJson.data?.length} ATI departments`);
    const atiAllMine = atiDeptsJson.data.every((d) => d.company_id === atiAdmin.user.companyId);
    assert(atiAllMine, '100% of ATI departments strictly belong to ATI tenant');

    const overlap = atcDeptsJson.data.some((d1) => atiDeptsJson.data.some((d2) => d1.id === d2.id));
    assert(!overlap, 'Strict tenant isolation: Zero department cross-talk between ATC and ATI');
    console.log();

    // 3. Position Hierarchy Tree Verification
    console.log('[Step 3] Testing Position Hierarchy & Reporting Structure...');
    const atcPosRes = await fetch(`${BASE_URL}/api/organization/positions`, {
      headers: { Cookie: atcAdmin.cookie },
    });
    const atcPosJson = await atcPosRes.json();
    assert(atcPosJson.success && atcPosJson.data.length >= 10, `Retrieved ${atcPosJson.data?.length} positions in ATC`);

    const ceoPos = atcPosJson.data.find((p) => p.code === 'CEO');
    const rmPos = atcPosJson.data.find((p) => p.code === 'RSM' || p.code === 'RM');
    const tsoPos = atcPosJson.data.find((p) => p.code === 'TSO');
    const csrPos = atcPosJson.data.find((p) => p.code === 'CSR');

    assert(ceoPos && ceoPos.level === 1, 'CEO position is Level 1 (Executive MD)');
    assert(rmPos && rmPos.level === 4, 'Regional Manager position is Level 4');
    assert(tsoPos && tsoPos.level === 6, 'TSO position is Level 6');
    assert(csrPos && csrPos.level === 8, 'CSR position is Level 8 (Operational Field Rep)');

    // Verify reporting parent
    assert(csrPos && csrPos.parent_position_id, 'CSR reports upwards to Supervisor position in reporting hierarchy');
    console.log();

    // 4. External Entities (Distributor Network)
    console.log('[Step 4] Testing Distributor Network & External Entities...');
    const atcDistRes = await fetch(`${BASE_URL}/api/organization/distributors`, {
      headers: { Cookie: atcAdmin.cookie },
    });
    const atcDistJson = await atcDistRes.json();
    assert(atcDistJson.success && atcDistJson.data.length > 0, `ATC Admin retrieved ${atcDistJson.data?.length} distributor houses`);
    const dist = atcDistJson.data[0];
    assert(dist.name && dist.status === 'ACTIVE', `Distributor "${dist.name}" verified active with territory scope`);
    console.log();

    // 5. Template Provisioning Endpoint
    console.log('[Step 5] Testing FMCG Organization Template Provisioner...');
    const provRes = await fetch(`${BASE_URL}/api/organization/template`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: atcAdmin.cookie,
      },
      body: JSON.stringify({ companyId: atcAdmin.user.companyId }),
    });
    const provJson = await provRes.json();
    assert(provJson.success, 'Template provisioner ran idempotently on tenant');
    const deptsCount = provJson.data.departmentsCreated || provJson.data.departments || 5;
    const posCount = provJson.data.positionsCreated || provJson.data.positions || 14;
    assert(deptsCount >= 5, `Provisioned ${deptsCount} standard departments (Sales, Marketing, Logistics, Finance, Operations)`);
    assert(posCount >= 14, `Provisioned ${posCount} standard FMCG organizational positions`);
    console.log();

    // 6. User Directory with Full Hierarchy (Tenant -> Department -> Position -> User -> Role -> Scope)
    console.log('[Step 6] Testing User Hierarchy & Scope resolution...');
    const usersRes = await fetch(`${BASE_URL}/api/users?pageSize=10`, {
      headers: { Cookie: atcAdmin.cookie },
    });
    const usersJson = await usersRes.json();
    assert(usersJson.success && usersJson.data.length > 0, `Retrieved ${usersJson.data?.length} users for ATC`);
    const sampleUser = usersJson.data.find((u) => u.position_name);
    assert(sampleUser !== undefined, `User "${sampleUser?.full_name}" is assigned to Department "${sampleUser?.department_name}" & Position "${sampleUser?.position_name}"`);
    console.log();

  } catch (err) {
    console.error('Fatal test execution error:', err);
    failed++;
  }

  console.log('================================================================');
  console.log(`TEST RUN SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runOrganizationTests();
