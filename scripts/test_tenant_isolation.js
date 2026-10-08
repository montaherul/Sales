// Standalone Automated Security Test: Tenant Isolation & Company Boundaries
// Verifies Section 56, 57, 58 of Multi-Tenant SaaS Platform specifications

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

async function runTenantIsolationTests() {
  console.log('====================================================');
  console.log('🔒 MULTI-TENANT SAAS ISOLATION SECURITY TEST SUITE');
  console.log('====================================================\n');

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
    console.log('[Step 1] Authenticating actors...');
    const superAdmin = await login('admin@afaztobacco.com', '123');
    const atcAdmin = await login('admin.atc@afaztobacco.com', '123');
    const atiAdmin = await login('admin.ati@akijtobacco.com', '123');

    assert(superAdmin.user.role === 'SUPER_ADMIN', 'Super Admin identity authenticated');
    assert(atcAdmin.user.role === 'COMPANY_ADMIN' && atcAdmin.user.companyName?.includes('Afaz'), 'ATC Company Admin authenticated with ATC tenant context');
    assert(atiAdmin.user.role === 'COMPANY_ADMIN' && atiAdmin.user.companyName?.includes('Akij'), 'ATI Company Admin authenticated with ATI tenant context');
    console.log();

    // 2. Super Admin Platform Privileges
    console.log('[Step 2] Testing Super Admin Platform Access...');
    const statsRes = await fetch(`${BASE_URL}/api/platform/stats`, {
      headers: { Cookie: superAdmin.cookie },
    });
    const statsJson = await statsRes.json();
    assert(statsRes.status === 200 && statsJson.success, 'Super Admin can fetch platform stats');
    assert(Number(statsJson.data?.totalCompanies) >= 2, `Platform stats reports multi-tenancy (${statsJson.data?.totalCompanies} companies)`);

    const companiesRes = await fetch(`${BASE_URL}/api/companies`, {
      headers: { Cookie: superAdmin.cookie },
    });
    const companiesJson = await companiesRes.json();
    assert(companiesJson.data?.length >= 2, `Super Admin can list all ${companiesJson.data?.length} companies`);
    console.log();

    // 3. ATC Company Admin Isolation
    console.log('[Step 3] Testing ATC Company Admin Tenant Isolation...');
    const atcUsersRes = await fetch(`${BASE_URL}/api/users`, {
      headers: { Cookie: atcAdmin.cookie },
    });
    const atcUsersJson = await atcUsersRes.json();
    const atcUsers = atcUsersJson.data || [];
    const nonAtcUsers = atcUsers.filter(u => u.company_id && u.company_id !== atcAdmin.user.companyId);
    assert(nonAtcUsers.length === 0, `ATC Admin only sees ATC tenant users (0 foreign tenant users out of ${atcUsers.length})`);

    const atcBrandsRes = await fetch(`${BASE_URL}/api/brands`, {
      headers: { Cookie: atcAdmin.cookie },
    });
    const atcBrandsJson = await atcBrandsRes.json();
    const atcBrands = atcBrandsJson.data || [];
    const nonAtcBrands = atcBrands.filter(b => b.company_id && b.company_id !== atcAdmin.user.companyId);
    assert(nonAtcBrands.length === 0, `ATC Admin only sees ATC tenant brands (0 foreign tenant brands out of ${atcBrands.length})`);
    console.log();

    // 4. ATI Company Admin Isolation
    console.log('[Step 4] Testing ATI Company Admin Tenant Isolation...');
    const atiUsersRes = await fetch(`${BASE_URL}/api/users`, {
      headers: { Cookie: atiAdmin.cookie },
    });
    const atiUsersJson = await atiUsersRes.json();
    const atiUsers = atiUsersJson.data || [];
    const hasAtcUserInAti = atiUsers.some(u => u.email === 'admin.atc@afaztobacco.com');
    assert(!hasAtcUserInAti, 'ATI Admin CANNOT see ATC Company Admin user');

    // 5. Cross-Tenant Attack Mitigation: ATI Admin attempts to manipulate ATC data
    console.log('[Step 5] Testing Cross-Tenant Attack Mitigation...');
    // ATI Admin attempts to delete ATC Admin
    const atcAdminProfile = atcUsers.find(u => u.email === 'admin.atc@afaztobacco.com');
    if (atcAdminProfile) {
      const deleteAttempt = await fetch(`${BASE_URL}/api/users?id=${atcAdminProfile.id}`, {
        method: 'DELETE',
        headers: { Cookie: atiAdmin.cookie },
      });
      const deleteJson = await deleteAttempt.json();
      assert(
        deleteAttempt.status === 403 || deleteAttempt.status === 404 || deleteJson.success === false,
        `ATI Admin blocked from deleting ATC user (Status: ${deleteAttempt.status}, Error: ${deleteJson.error})`
      );
    } else {
      console.log('  ⚠️ Skipping cross-tenant delete check: ATC Admin profile ID not found in list');
    }

    // ATI Admin attempts to access Super Admin platform stats
    const atiPlatformStats = await fetch(`${BASE_URL}/api/platform/stats`, {
      headers: { Cookie: atiAdmin.cookie },
    });
    assert(atiPlatformStats.status === 403, `ATI Admin blocked from platform stats endpoint (Status: ${atiPlatformStats.status})`);

    console.log('\n====================================================');
    console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTenantIsolationTests();
