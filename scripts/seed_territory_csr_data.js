const ExcelJS = require('exceljs');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

let connectionString = process.env.DATABASE_URL;
if (!connectionString && fs.existsSync('.env.local')) {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  const match = envContent.match(/DATABASE_URL=([^\r\n]+)/);
  if (match) connectionString = match[1].trim();
}
const pool = new Pool({ connectionString: connectionString || undefined, ssl: { rejectUnauthorized: false } });

async function seed() {
  console.log('Seeding Territory CSR data from Chandanaish Territory CSR sales.xlsx...');

  // 1. Resolve Company Afaz Tobacco Company
  const compRes = await pool.query("SELECT id FROM companies WHERE name ILIKE '%afaz%' LIMIT 1");
  const companyId = compRes.rows[0]?.id;
  if (!companyId) throw new Error('Company Afaz Tobacco Company not found');

  // 2. Resolve Wing 'Chittagong'
  const wingRes = await pool.query("SELECT id FROM wings WHERE name ILIKE '%chittagong%' LIMIT 1");
  let wingId = wingRes.rows[0]?.id;
  if (!wingId) {
    const divRes = await pool.query("SELECT id FROM divisions WHERE company_id = $1 LIMIT 1", [companyId]);
    const divId = divRes.rows[0].id;
    const newWing = await pool.query("INSERT INTO wings (division_id, name, code) VALUES ($1, 'Chittagong', 'CTG') RETURNING id", [divId]);
    wingId = newWing.rows[0].id;
  }

  // 3. Resolve Region 'Chattogram'
  let regRes = await pool.query("SELECT id FROM regions WHERE name ILIKE '%chattogram%' OR name ILIKE '%ctg%' LIMIT 1");
  let regionId = regRes.rows[0]?.id;
  if (!regionId) {
    const newReg = await pool.query("INSERT INTO regions (wing_id, name) VALUES ($1, 'Chattogram') RETURNING id", [wingId]);
    regionId = newReg.rows[0].id;
  }

  // 4. Resolve Territory 'Chandanaish'
  let terrRes = await pool.query("SELECT id FROM territories WHERE name ILIKE '%chandanaish%' LIMIT 1");
  let territoryId = terrRes.rows[0]?.id;
  if (!territoryId) {
    const newTerr = await pool.query("INSERT INTO territories (region_id, name, sort_order) VALUES ($1, 'Chandanaish', 6) RETURNING id", [regionId]);
    territoryId = newTerr.rows[0].id;
  }

  // 5. Parse authoritative Excel file
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('excel/Chandanaish Territory CSR sales.xlsx');

  // Parse Target Sheet
  const targetWs = wb.getWorksheet('Target');
  const lms = Number(targetWs.getCell('K2').value) || 11.06;
  const lmAds = Number(targetWs.getCell('K3').value) || 0.43;
  const workingDays = Number(targetWs.getCell('H2').value) || 26;

  // Save Territory Target Benchmarks
  await pool.query(`
    INSERT INTO territory_target_benchmarks (company_id, territory_id, year, month, lms, lm_ads, working_days, updated_at)
    VALUES ($1, $2, 2026, 10, $3, $4, $5, NOW())
    ON CONFLICT (territory_id, year, month)
    DO UPDATE SET lms = EXCLUDED.lms, lm_ads = EXCLUDED.lm_ads, working_days = EXCLUDED.working_days, updated_at = NOW();
  `, [companyId, territoryId, lms, lmAds, workingDays]);

  // Read routes from rows 4 to 15 of Target sheet
  const routesData = [];
  for (let r = 4; r <= 15; r++) {
    const row = targetWs.getRow(r);
    const slNo = Number(row.getCell(1).value) || (r - 3);
    const csrName = String(row.getCell(2).value || '').trim();
    const routeName = String(row.getCell(3).value || '').trim();
    const outlets = Number(row.getCell(4).value) || 0;
    const targetCigarette = Number(row.getCell(5).value) || 0;
    const targetBidi = Number(row.getCell(6).value) || 0;

    if (routeName) {
      routesData.push({ slNo, csrName, routeName, outlets, targetCigarette, targetBidi, rowIndex: r });
    }
  }

  console.log(`Parsed ${routesData.length} routes from Target sheet.`);

  // Upsert routes and route_targets
  const routeMap = new Map(); // routeName => routeId
  for (const r of routesData) {
    const rRes = await pool.query(`
      INSERT INTO routes (territory_id, name, code, csr_name, outlet_count, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT DO NOTHING
      RETURNING id;
    `, [territoryId, r.routeName, `RT-${r.slNo}`, r.csrName, r.outlets, r.slNo]);

    let routeId = rRes.rows[0]?.id;
    if (!routeId) {
      const getR = await pool.query('SELECT id FROM routes WHERE territory_id = $1 AND name = $2', [territoryId, r.routeName]);
      routeId = getR.rows[0]?.id;
      // Update metadata
      await pool.query('UPDATE routes SET csr_name = $1, outlet_count = $2, sort_order = $3 WHERE id = $4', [r.csrName, r.outlets, r.slNo, routeId]);
    }

    routeMap.set(r.routeName, routeId);

    // Upsert target
    await pool.query(`
      INSERT INTO route_targets (company_id, territory_id, route_id, year, month, target_cigarette, target_bidi, updated_at)
      VALUES ($1, $2, $3, 2026, 10, $4, $5, NOW())
      ON CONFLICT (route_id, year, month)
      DO UPDATE SET target_cigarette = EXCLUDED.target_cigarette, target_bidi = EXCLUDED.target_bidi, updated_at = NOW();
    `, [companyId, territoryId, routeId, r.targetCigarette, r.targetBidi]);
  }

  // Parse Daily Sales from sheets 1 to 31
  let totalDailySalesInserted = 0;
  for (let day = 1; day <= 31; day++) {
    const ws = wb.getWorksheet(String(day));
    if (!ws) continue;

    const dayStr = String(day).padStart(2, '0');
    const reportDate = `2026-10-${dayStr}`;

    for (const r of routesData) {
      const row = ws.getRow(r.rowIndex + 1); // in daily sheet, data starts at row 5 (r=4 in target => row 5 in daily)
      const cSales = Number(row.getCell(7).value || 0);
      const bSales = Number(row.getCell(8).value || 0);
      const remarks = String(row.getCell(12).value || '');

      const routeId = routeMap.get(r.routeName);
      if (!routeId) continue;

      if (cSales > 0 || bSales > 0) {
        await pool.query(`
          INSERT INTO route_daily_sales (company_id, territory_id, route_id, report_date, sales_cigarette, sales_bidi, remarks, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT (route_id, report_date)
          DO UPDATE SET sales_cigarette = EXCLUDED.sales_cigarette, sales_bidi = EXCLUDED.sales_bidi, remarks = EXCLUDED.remarks, updated_at = NOW();
        `, [companyId, territoryId, routeId, reportDate, cSales, bSales, remarks]);
        totalDailySalesInserted++;
      }
    }
  }

  console.log(`Successfully seeded ${totalDailySalesInserted} route daily sales entries.`);

  // Also seed default routes for Kerani hat and Satkania so TSO can switch to other territories
  const otherTerrs = await pool.query("SELECT id, name FROM territories WHERE name IN ('Kerani hat', 'Satkania')");
  for (const ot of otherTerrs.rows) {
    const sampleRoutes = [
      { name: `${ot.name} Main Bazar`, csr: 'Rahim', outlets: 45, cig: 1.5, bidi: 0.2 },
      { name: `${ot.name} College Road`, csr: 'Rahim', outlets: 38, cig: 1.1, bidi: 0.1 },
      { name: `${ot.name} Station Road`, csr: 'Solaiman', outlets: 52, cig: 1.8, bidi: 0.3 },
      { name: `${ot.name} Highway Point`, csr: 'Solaiman', outlets: 41, cig: 1.4, bidi: 0.2 },
    ];

    await pool.query(`
      INSERT INTO territory_target_benchmarks (company_id, territory_id, year, month, lms, lm_ads, working_days, updated_at)
      VALUES ($1, $2, 2026, 10, 5.5, 0.21, 26, NOW())
      ON CONFLICT (territory_id, year, month) DO NOTHING;
    `, [companyId, ot.id]);

    for (let i = 0; i < sampleRoutes.length; i++) {
      const sr = sampleRoutes[i];
      let rId;
      const exist = await pool.query('SELECT id FROM routes WHERE territory_id = $1 AND name = $2', [ot.id, sr.name]);
      if (exist.rows.length > 0) {
        rId = exist.rows[0].id;
      } else {
        const ins = await pool.query('INSERT INTO routes (territory_id, name, code, csr_name, outlet_count, sort_order) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
          [ot.id, sr.name, `RT-${ot.name.slice(0,3).toUpperCase()}-${i+1}`, sr.csr, sr.outlets, i+1]);
        rId = ins.rows[0].id;
      }

      await pool.query(`
        INSERT INTO route_targets (company_id, territory_id, route_id, year, month, target_cigarette, target_bidi, updated_at)
        VALUES ($1, $2, $3, 2026, 10, $4, $5, NOW())
        ON CONFLICT (route_id, year, month) DO NOTHING;
      `, [companyId, ot.id, rId, sr.cig, sr.bidi]);
    }
  }

  console.log('Seeding completed successfully!');
  await pool.end();
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  pool.end();
  process.exit(1);
});
