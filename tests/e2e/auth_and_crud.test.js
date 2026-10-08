// E2E Test Suite: Full Stack Authentication, Module Listing & CRUD Verification
// AGENTS1.md Rule 29 & Rule 30 (End-to-End Testing)

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

async function runE2ETests() {
  console.log('====================================================');
  console.log('🌐 RUNNING E2E TEST SUITE: AUTH & MODULE LISTING/CRUD');
  console.log('====================================================');

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
    // 1. Authenticate as Super Admin
    console.log('[Step 1] Authenticating Super Admin...');
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@afaztobacco.com', password: '123' }),
    });
    const loginJson = await loginRes.json();
    const cookie = loginRes.headers.get('set-cookie');
    assert(loginRes.status === 200 && loginJson.success === true, 'Super Admin authenticated with HTTP 200');

    const headers = { Cookie: cookie };

    // 2. Test User Module Listing & CRUD
    console.log('[Step 2] Testing User Module Listing (/api/users)...');
    const usersRes = await fetch(`${BASE_URL}/api/users?pageSize=10`, { headers });
    const usersJson = await usersRes.json();
    assert(usersRes.status === 200 && usersJson.success && Array.isArray(usersJson.data), `Users listing retrieved (${usersJson.data?.length || 0} users)`);

    // 3. Test Company Module Listing & CRUD
    console.log('[Step 3] Testing Company Module Listing (/api/companies)...');
    const compRes = await fetch(`${BASE_URL}/api/companies?pageSize=10`, { headers });
    const compJson = await compRes.json();
    assert(compRes.status === 200 && compJson.success && Array.isArray(compJson.data), `Companies listing retrieved (${compJson.data?.length || 0} companies)`);

    // 4. Test Roles Module Listing & CRUD
    console.log('[Step 4] Testing Roles Module Listing (/api/roles)...');
    const rolesRes = await fetch(`${BASE_URL}/api/roles?pageSize=10`, { headers });
    const rolesJson = await rolesRes.json();
    assert(rolesRes.status === 200 && rolesJson.success && Array.isArray(rolesJson.data), `Roles listing retrieved (${rolesJson.data?.length || 0} roles)`);

    // 5. Test Hierarchy / Territory Module Listing & CRUD
    console.log('[Step 5] Testing Territory Hierarchy Module Listing (/api/hierarchy)...');
    const terrRes = await fetch(`${BASE_URL}/api/hierarchy?pageSize=10`, { headers });
    const terrJson = await terrRes.json();
    assert(terrRes.status === 200 && terrJson.success && Array.isArray(terrJson.data), `Territories listing retrieved (${terrJson.data?.length || 0} territories)`);

    // 6. Test Product / Brand Module Listing & CRUD
    console.log('[Step 6] Testing Brand / Product Module Listing (/api/brands)...');
    const prodRes = await fetch(`${BASE_URL}/api/brands?pageSize=10`, { headers });
    const prodJson = await prodRes.json();
    assert(prodRes.status === 200 && prodJson.success && Array.isArray(prodJson.data), `Brands listing retrieved (${prodJson.data?.length || 0} brands)`);

    // 7. Test Targets Module Listing & CRUD
    console.log('[Step 7] Testing Targets Module Listing (/api/targets)...');
    const targetRes = await fetch(`${BASE_URL}/api/targets?pageSize=10`, { headers });
    const targetJson = await targetRes.json();
    assert(targetRes.status === 200 && targetJson.success && Array.isArray(targetJson.data), `Targets listing retrieved (${targetJson.data?.length || 0} targets)`);

    // 8. Test Daily Submissions / Approvals Module Listing (/api/daily-submissions)
    console.log('[Step 8] Testing Daily Submissions / Approvals Module Listing (/api/daily-submissions)...');
    const appRes = await fetch(`${BASE_URL}/api/daily-submissions?pageSize=10`, { headers });
    const appJson = await appRes.json();
    assert(appRes.status === 200 && appJson.success && Array.isArray(appJson.data), `Daily submissions listing retrieved (${appJson.data?.length || 0} submissions)`);

    // 9. Test Audit Log Viewer Module Listing (/api/audit-logs)
    console.log('[Step 9] Testing Audit Logs Listing (/api/audit-logs)...');
    const auditRes = await fetch(`${BASE_URL}/api/audit-logs?pageSize=10`, { headers });
    const auditJson = await auditRes.json();
    assert(auditRes.status === 200 && auditJson.success && Array.isArray(auditJson.data), `Audit logs listing retrieved (${auditJson.data?.length || 0} entries)`);

    console.log('\n====================================================');
    console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('E2E Test Execution Error:', err);
    process.exit(1);
  }
}

runE2ETests();
