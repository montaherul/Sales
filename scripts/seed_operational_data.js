const { createClient } = require('./db_client');

async function seed() {
  const client = createClient();

  await client.connect();
  console.log('Connected to Supabase. Seeding operational records for 2026-10-06...');

  // Get territories
  const terrRes = await client.query('SELECT id, name FROM territories ORDER BY sort_order;');
  const territories = terrRes.rows;

  // Get brands
  const brandRes = await client.query('SELECT id, name, type FROM brands ORDER BY sort_order;');
  const brands = brandRes.rows;
  const brandMap = {};
  brands.forEach(b => brandMap[b.name] = b.id);

  // Get an admin user
  const userRes = await client.query('SELECT id FROM user_profiles LIMIT 1;');
  const userId = userRes.rows[0]?.id;

  const data = [
    {
      territory: 'Kerani hat',
      status: 'SUBMITTED',
      cSales: { Wilson: 0.00, Shahara: 0.00, Express: 0.68, Nexus: 0.00, SB: 0.00, SM: 0.00 },
      cStock: { Wilson: 0.19, Shahara: 0.00, Express: 0.84, Nexus: 0.00, SB: 0.00, SM: 0.00 },
      zSales: { SLB: 0.01, '22/25': 5, '99/14': 0, '33/15': 0 },
      zStock: { SLB: 0.97, '22/25': 1298, '99/14': 0, '33/15': 0 },
      empty: 6660,
      remarks: 'Active field route'
    },
    {
      territory: 'Satkania',
      status: 'TSO_APPROVED',
      cSales: { Wilson: 0.01, Shahara: 0.00, Express: 0.41, Nexus: 0.00, SB: 0.00, SM: 0.00 },
      cStock: { Wilson: 0.05, Shahara: 0.00, Express: 1.15, Nexus: 0.00, SB: 0.00, SM: 0.00 },
      zSales: { SLB: 0.01, '22/25': 10, '99/14': 0, '33/15': 0 },
      zStock: { SLB: 0.63, '22/25': 363, '99/14': 0, '33/15': 0 },
      empty: 4270,
      remarks: ''
    },
    {
      territory: 'Bandarban',
      status: 'RSO_APPROVED',
      cSales: { Wilson: 0.00, Shahara: 0.00, Express: 0.42, Nexus: 0.00, SB: 0.00, SM: 0.00 },
      cStock: { Wilson: 0.22, Shahara: 0.00, Express: 2.71, Nexus: 0.00, SB: 0.00, SM: 0.00 },
      zSales: { SLB: 0.03, '22/25': 0, '99/14': 60, '33/15': 0 },
      zStock: { SLB: 1.15, '22/25': 60, '99/14': 1134, '33/15': 0 },
      empty: 4050,
      remarks: ''
    },
    {
      territory: 'Rajasthali',
      status: 'SUBMITTED',
      cSales: { Wilson: 0.00, Shahara: 0.00, Express: 0.06, Nexus: 0.00, SB: 0.00, SM: 0.00 },
      cStock: { Wilson: 0.09, Shahara: 0.00, Express: 0.11, Nexus: 0.00, SB: 0.00, SM: 0.00 },
      zSales: { SLB: 0.01, '22/25': 0, '99/14': 0, '33/15': 0 },
      zStock: { SLB: 0.11, '22/25': 0, '99/14': 0, '33/15': 0 },
      empty: 600,
      remarks: ''
    },
    {
      territory: 'Dohazari',
      status: 'FINALIZED',
      cSales: { Wilson: 0.00, Shahara: 0.00, Express: 0.62, Nexus: 0.00, SB: 0.00, SM: 0.00 },
      cStock: { Wilson: 0.10, Shahara: 0.00, Express: 3.82, Nexus: 0.00, SB: 0.00, SM: 0.00 },
      zSales: { SLB: 0.00, '22/25': 18, '99/14': 0, '33/15': 0 },
      zStock: { SLB: 0.58, '22/25': 962, '99/14': 0, '33/15': 0 },
      empty: 6400,
      remarks: ''
    }
  ];

  for (const item of data) {
    const t = territories.find(x => x.name.toLowerCase() === item.territory.toLowerCase());
    if (!t) continue;

    // Upsert daily_submission
    const subRes = await client.query(`
      INSERT INTO daily_submissions (territory_id, report_date, status, created_by)
      VALUES ($1, '2026-10-06', $2, $3)
      ON CONFLICT (territory_id, report_date) DO UPDATE
      SET status = EXCLUDED.status, updated_at = NOW()
      RETURNING id;
    `, [t.id, item.status, userId]);

    const subId = subRes.rows[0].id;

    // Cigarette Sales
    for (const [bName, qty] of Object.entries(item.cSales)) {
      const bId = brandMap[bName];
      if (bId) {
        await client.query(`
          INSERT INTO daily_sales (submission_id, brand_id, quantity)
          VALUES ($1, $2, $3)
          ON CONFLICT (submission_id, brand_id) DO UPDATE SET quantity = EXCLUDED.quantity;
        `, [subId, bId, qty]);
      }
    }

    // Cigarette Stock
    for (const [bName, stk] of Object.entries(item.cStock)) {
      const bId = brandMap[bName];
      if (bId) {
        await client.query(`
          INSERT INTO daily_stock (submission_id, brand_id, closing_stock)
          VALUES ($1, $2, $3)
          ON CONFLICT (submission_id, brand_id) DO UPDATE SET closing_stock = EXCLUDED.closing_stock;
        `, [subId, bId, stk]);
      }
    }

    // Zarda Sales
    for (const [bName, qty] of Object.entries(item.zSales)) {
      const bId = brandMap[bName];
      if (bId) {
        const price = bName === '22/25' ? 15 : (bName === '99/14' ? 6 : (bName === '33/15' ? 8 : 0));
        await client.query(`
          INSERT INTO zarda_sales (submission_id, brand_id, quantity, unit_price, total_value)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (submission_id, brand_id) DO UPDATE
          SET quantity = EXCLUDED.quantity, unit_price = EXCLUDED.unit_price, total_value = EXCLUDED.total_value;
        `, [subId, bId, qty, price, qty * price]);
      }
    }

    // Zarda Stock
    for (const [bName, stk] of Object.entries(item.zStock)) {
      const bId = brandMap[bName];
      if (bId) {
        const price = bName === '22/25' ? 15 : (bName === '99/14' ? 6 : (bName === '33/15' ? 8 : 0));
        await client.query(`
          INSERT INTO zarda_stock (submission_id, brand_id, closing_stock, unit_price, total_value)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (submission_id, brand_id) DO UPDATE
          SET closing_stock = EXCLUDED.closing_stock, unit_price = EXCLUDED.unit_price, total_value = EXCLUDED.total_value;
        `, [subId, bId, stk, price, stk * price]);
      }
    }

    // Express Empty Packet
    const expressId = brandMap['Express'];
    if (expressId) {
      await client.query(`
        INSERT INTO empty_packets (submission_id, brand_id, quantity, remarks)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (submission_id, brand_id) DO UPDATE
        SET quantity = EXCLUDED.quantity, remarks = EXCLUDED.remarks;
      `, [subId, expressId, item.empty, item.remarks]);
    }

    console.log(`✓ Seeded submission for ${item.territory} (${item.status})`);
  }

  // Verify rows
  const countRes = await client.query(`
    SELECT count(*) as total_subs FROM daily_submissions;
  `);
  console.log('\nTotal daily submissions now in Supabase:', countRes.rows[0].total_subs);

  await client.end();
}

seed().catch(console.error);
