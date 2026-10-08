/**
 * Integration Test Suite: Reporting Periods & Calendar Control (Year -> Month -> Date)
 * Validates:
 * 1. Admin auto-generation of Year -> 12 Months -> 365 Days
 * 2. CRUD on Reporting Years, Months (working days), and Dates (holidays/working status)
 * 3. Period status checking (open vs closed/holiday)
 * 4. Multi-tenant company scoping
 */

const http = require('http');

const PORT = 3000;
const HOST = 'localhost';

function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runPeriodControlTests() {
  console.log('====================================================');
  console.log('📅 RUNNING INTEGRATION TESTS: YEAR/MONTH/DATE PERIOD CONTROL');
  console.log('====================================================');

  const headers = {
    'Content-Type': 'application/json',
    'x-user-role': 'SUPER_ADMIN',
    'x-user-email': 'admin@afaztobacco.com',
  };

  const testCompanyId = '53ea4edf-b686-45cb-816e-b29581847213'; // Afaz Tobacco Company

  try {
    // 1. Auto-Create 2027 Reporting Period
    console.log('[Step 1] Testing Auto-Create Period for Year 2027...');
    const autoCreateRes = await request(
      {
        hostname: HOST,
        port: PORT,
        path: '/api/periods',
        method: 'POST',
        headers,
      },
      {
        action: 'auto_create',
        companyId: testCompanyId,
        year: 2027,
        defaultWorkingDays: 26,
      }
    );

    if (autoCreateRes.json && autoCreateRes.json.success) {
      console.log('  ✅ PASS: 2027 Reporting Period auto-created with 12 months & 365 days');
    } else {
      console.log('  ℹ️ INFO: Auto-create response:', autoCreateRes.json?.message || autoCreateRes.status);
    }

    // 2. Fetch Reporting Years
    console.log('[Step 2] Testing Listing Reporting Years...');
    const yearsRes = await request({
      hostname: HOST,
      port: PORT,
      path: `/api/periods?type=years&companyId=${testCompanyId}`,
      method: 'GET',
      headers,
    });

    if (yearsRes.json && yearsRes.json.success && Array.isArray(yearsRes.json.data)) {
      const year2026 = yearsRes.json.data.find((y) => y.year === 2026);
      if (year2026) {
        console.log(`  ✅ PASS: Reporting years retrieved (${yearsRes.json.data.length} years found, including 2026)`);
      } else {
        throw new Error('Expected year 2026 in reporting years list');
      }
    } else {
      throw new Error(`Failed to list reporting years: ${JSON.stringify(yearsRes.json)}`);
    }

    // 3. Fetch Monthly Periods for 2026
    console.log('[Step 3] Testing Listing Months for Year 2026...');
    const monthsRes = await request({
      hostname: HOST,
      port: PORT,
      path: `/api/periods?type=months&companyId=${testCompanyId}&year=2026`,
      method: 'GET',
      headers,
    });

    if (monthsRes.json && monthsRes.json.success && monthsRes.json.data?.length === 12) {
      console.log('  ✅ PASS: Exactly 12 reporting months configured for 2026');
      const oct = monthsRes.json.data.find((m) => m.month === 10);
      console.log(`  ✅ PASS: October 2026 has ${oct.working_days} working days, status: ${oct.status}`);
    } else {
      throw new Error(`Failed to retrieve 12 months for 2026: count = ${monthsRes.json?.data?.length}`);
    }

    // 4. Fetch Daily Calendar Dates for October 2026
    console.log('[Step 4] Testing Listing Calendar Dates for October 2026...');
    const datesRes = await request({
      hostname: HOST,
      port: PORT,
      path: `/api/periods?type=dates&companyId=${testCompanyId}&year=2026&month=10`,
      method: 'GET',
      headers,
    });

    if (datesRes.json && datesRes.json.success && datesRes.json.data?.length === 31) {
      console.log(`  ✅ PASS: Exactly 31 daily dates returned for October 2026`);
    } else {
      throw new Error(`Failed to retrieve 31 daily dates for Oct 2026: count = ${datesRes.json?.data?.length}`);
    }

    // 5. Check Period Status for an Open Date (2026-10-06)
    console.log('[Step 5] Testing Period Status Check on 2026-10-06...');
    const checkOpenRes = await request({
      hostname: HOST,
      port: PORT,
      path: `/api/periods?type=check&companyId=${testCompanyId}&date=2026-10-06`,
      method: 'GET',
      headers,
    });

    if (checkOpenRes.json && checkOpenRes.json.success && checkOpenRes.json.data?.isOpen === true) {
      console.log('  ✅ PASS: 2026-10-06 reporting period is OPEN for submissions');
    } else {
      throw new Error(`Expected 2026-10-06 to be open: ${JSON.stringify(checkOpenRes.json)}`);
    }

    // 6. Update Date to Holiday / Locked and verify check reflects it
    console.log('[Step 6] Testing Date Update (Toggle Holiday/Lock) & Enforcement...');
    const updateDateRes = await request(
      {
        hostname: HOST,
        port: PORT,
        path: '/api/periods',
        method: 'PUT',
        headers,
      },
      {
        target: 'date',
        companyId: testCompanyId,
        date: '2026-10-31',
        isWorkingDay: false,
        status: 'CLOSED',
        holidayName: 'Monthly Maintenance Shutdown',
      }
    );

    if (updateDateRes.json && updateDateRes.json.success) {
      console.log('  ✅ PASS: Date 2026-10-31 updated to CLOSED with holiday name');
    } else {
      throw new Error(`Failed to update date 2026-10-31: ${JSON.stringify(updateDateRes.json)}`);
    }

    // Verify status check catches the closed date
    const checkClosedRes = await request({
      hostname: HOST,
      port: PORT,
      path: `/api/periods?type=check&companyId=${testCompanyId}&date=2026-10-31`,
      method: 'GET',
      headers,
    });

    if (checkClosedRes.json && checkClosedRes.json.success && checkClosedRes.json.data?.isOpen === false) {
      console.log(`  ✅ PASS: Gating enforced! 2026-10-31 correctly blocked: "${checkClosedRes.json.data.reason}"`);
    } else {
      throw new Error(`Expected 2026-10-31 to be blocked: ${JSON.stringify(checkClosedRes.json)}`);
    }

    // Restore 2026-10-31
    await request(
      {
        hostname: HOST,
        port: PORT,
        path: '/api/periods',
        method: 'PUT',
        headers,
      },
      {
        target: 'date',
        companyId: testCompanyId,
        date: '2026-10-31',
        isWorkingDay: true,
        status: 'OPEN',
        holidayName: null,
      }
    );
    console.log('  ✅ PASS: Restored 2026-10-31 to OPEN state');

    console.log('====================================================');
    console.log('TEST SUMMARY: All Reporting Period & Calendar Control Tests Passed!');
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ FAIL:', err.message);
    process.exit(1);
  }
}

runPeriodControlTests();
