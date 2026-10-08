/**
 * Automated Verification Script: Google Sheets Synchronization & Security
 * Validates:
 * 1. Super Admin can trigger Google Sheets sync and record in google_sheet_syncs
 * 2. Non-Super Admin is blocked (403 Forbidden) per AGENTS.md rule 7 & 21
 * 3. Sync history query returns tracked events
 */

const http = require('http');

function post(path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body || {});
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...headers,
        },
      },
      (res) => {
        let resData = '';
        res.on('data', (chunk) => (resData += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(resData);
          } catch {
            parsed = null;
          }
          resolve({ 
            status: res.statusCode, 
            data: parsed, 
            raw: resData, 
            headers: res.headers 
          });
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function extractCookie(headers) {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return {};
  const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  const match = cookieStr.match(/afaz_session=([^;]+)/);
  return match ? { Cookie: `afaz_session=${match[1]}` } : {};
}

function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      },
      (res) => {
        let resData = '';
        res.on('data', (chunk) => (resData += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(resData) });
          } catch {
            resolve({ status: res.statusCode, raw: resData });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('====================================================');
  console.log('📊 GOOGLE SHEETS SYNCHRONIZATION TEST SUITE');
  console.log('====================================================\n');

  // 1. Authenticate Super Admin
  const adminLogin = await post('/api/auth/login', {
    email: 'admin@afaztobacco.com',
    password: '123',
  });
  const adminCookie = extractCookie(adminLogin.headers);

  console.log('[Test 1] Super Admin triggers Google Sheets sync...');
  const syncRes = await post('/api/google-sheets/sync', {
    year: 2026,
    month: 10,
    day: 8,
  }, adminCookie);

  if (syncRes.status === 200 && syncRes.data?.success) {
    console.log(`  ✅ PASS: Google Sheets synced successfully (Spreadsheet: ${syncRes.data.data.spreadsheetId})`);
    console.log(`  ✅ PASS: Records tracked: ${syncRes.data.data.recordsSynced}, Status: ${syncRes.data.data.status}`);
  } else {
    console.error('  ❌ FAIL: Google Sheets sync failed:', syncRes);
    process.exit(1);
  }

  // 2. Query Sync History
  console.log('\n[Test 2] Querying Google Sheets sync history...');
  const historyRes = await get('/api/google-sheets/sync', adminCookie);
  if (historyRes.status === 200 && historyRes.data?.success && Array.isArray(historyRes.data.data)) {
    console.log(`  ✅ PASS: Found ${historyRes.data.data.length} sync history entries`);
  } else {
    console.error('  ❌ FAIL: Query history failed:', historyRes);
    process.exit(1);
  }

  // 3. Authenticate non-Super Admin (COMPANY_ADMIN) and verify forbidden
  console.log('\n[Test 3] Verifying Non-Super Admin cannot trigger Google Sheets sync...');
  const compAdminLogin = await post('/api/auth/login', {
    email: 'admin.atc@afaztobacco.com',
    password: '123',
  });
  if (!compAdminLogin.data?.success) {
    console.error('  ❌ FAIL: Login failed for admin.atc@afaztobacco.com:', compAdminLogin.data);
    process.exit(1);
  }
  const compAdminCookie = extractCookie(compAdminLogin.headers);

  const blockedRes = await post('/api/google-sheets/sync', {
    year: 2026,
    month: 10,
    day: 8,
  }, compAdminCookie);

  if (blockedRes.status === 403) {
    console.log(`  ✅ PASS: Company Admin user blocked with HTTP 403 Forbidden: ${blockedRes.data?.error}`);
  } else {
    console.error('  ❌ FAIL: Company Admin was not blocked properly:', blockedRes);
    process.exit(1);
  }

  console.log('\n====================================================');
  console.log('TEST SUMMARY: All Google Sheets tests passed!');
  console.log('====================================================\n');
}

run().catch((err) => {
  console.error('Unexpected error running test suite:', err);
  process.exit(1);
});
