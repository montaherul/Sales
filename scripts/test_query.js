const { createClient } = require('./db_client');

async function test() {
  const client = createClient();

  await client.connect();
  const res = await client.query(`
    SELECT 
      s.id as submission_id,
      s.territory_id,
      t.name as territory_name,
      r.name as region_name,
      s.report_date::text as report_date,
      EXTRACT(DAY FROM s.report_date)::int as day_number,
      s.status,
      s.is_locked,
      s.unlock_reason,
      COALESCE((SELECT quantity FROM daily_sales ds JOIN brands b ON ds.brand_id = b.id WHERE ds.submission_id = s.id AND b.name = 'Wilson'), 0)::numeric as c_wilson_sales,
      COALESCE((SELECT quantity FROM daily_sales ds JOIN brands b ON ds.brand_id = b.id WHERE ds.submission_id = s.id AND b.name = 'Shahara'), 0)::numeric as c_shahara_sales,
      COALESCE((SELECT quantity FROM daily_sales ds JOIN brands b ON ds.brand_id = b.id WHERE ds.submission_id = s.id AND b.name = 'Express'), 0)::numeric as c_express_sales,
      COALESCE((SELECT quantity FROM daily_sales ds JOIN brands b ON ds.brand_id = b.id WHERE ds.submission_id = s.id AND b.name = 'Nexus'), 0)::numeric as c_nexus_sales,
      COALESCE((SELECT quantity FROM daily_sales ds JOIN brands b ON ds.brand_id = b.id WHERE ds.submission_id = s.id AND b.name = 'SB'), 0)::numeric as c_sb_sales,
      COALESCE((SELECT quantity FROM daily_sales ds JOIN brands b ON ds.brand_id = b.id WHERE ds.submission_id = s.id AND b.name = 'SM'), 0)::numeric as c_sm_sales,
      COALESCE((SELECT closing_stock FROM daily_stock dst JOIN brands b ON dst.brand_id = b.id WHERE dst.submission_id = s.id AND b.name = 'Wilson'), 0)::numeric as c_wilson_stock,
      COALESCE((SELECT closing_stock FROM daily_stock dst JOIN brands b ON dst.brand_id = b.id WHERE dst.submission_id = s.id AND b.name = 'Shahara'), 0)::numeric as c_shahara_stock,
      COALESCE((SELECT closing_stock FROM daily_stock dst JOIN brands b ON dst.brand_id = b.id WHERE dst.submission_id = s.id AND b.name = 'Express'), 0)::numeric as c_express_stock,
      COALESCE((SELECT closing_stock FROM daily_stock dst JOIN brands b ON dst.brand_id = b.id WHERE dst.submission_id = s.id AND b.name = 'Nexus'), 0)::numeric as c_nexus_stock,
      COALESCE((SELECT closing_stock FROM daily_stock dst JOIN brands b ON dst.brand_id = b.id WHERE dst.submission_id = s.id AND b.name = 'SB'), 0)::numeric as c_sb_stock,
      COALESCE((SELECT closing_stock FROM daily_stock dst JOIN brands b ON dst.brand_id = b.id WHERE dst.submission_id = s.id AND b.name = 'SM'), 0)::numeric as c_sm_stock,
      COALESCE((SELECT quantity FROM zarda_sales zs JOIN brands b ON zs.brand_id = b.id WHERE zs.submission_id = s.id AND b.name = 'SLB'), 0)::numeric as z_slb_sales,
      COALESCE((SELECT quantity FROM zarda_sales zs JOIN brands b ON zs.brand_id = b.id WHERE zs.submission_id = s.id AND b.name = '22/25'), 0)::int as z_22_25_sales,
      COALESCE((SELECT quantity FROM zarda_sales zs JOIN brands b ON zs.brand_id = b.id WHERE zs.submission_id = s.id AND b.name = '99/14'), 0)::int as z_99_14_sales,
      COALESCE((SELECT quantity FROM zarda_sales zs JOIN brands b ON zs.brand_id = b.id WHERE zs.submission_id = s.id AND b.name = '33/15'), 0)::int as z_33_15_sales,
      COALESCE((SELECT closing_stock FROM zarda_stock zst JOIN brands b ON zst.brand_id = b.id WHERE zst.submission_id = s.id AND b.name = 'SLB'), 0)::numeric as z_slb_stock,
      COALESCE((SELECT closing_stock FROM zarda_stock zst JOIN brands b ON zst.brand_id = b.id WHERE zst.submission_id = s.id AND b.name = '22/25'), 0)::int as z_22_25_stock,
      COALESCE((SELECT closing_stock FROM zarda_stock zst JOIN brands b ON zst.brand_id = b.id WHERE zst.submission_id = s.id AND b.name = '99/14'), 0)::int as z_99_14_stock,
      COALESCE((SELECT closing_stock FROM zarda_stock zst JOIN brands b ON zst.brand_id = b.id WHERE zst.submission_id = s.id AND b.name = '33/15'), 0)::int as z_33_15_stock,
      COALESCE((SELECT quantity FROM empty_packets ep JOIN brands b ON ep.brand_id = b.id WHERE ep.submission_id = s.id AND b.name = 'Express'), 0)::int as empty_packets,
      COALESCE((SELECT remarks FROM empty_packets ep JOIN brands b ON ep.brand_id = b.id WHERE ep.submission_id = s.id AND b.name = 'Express'), '') as remarks
    FROM daily_submissions s
    JOIN territories t ON s.territory_id = t.id
    JOIN regions r ON t.region_id = r.id
    ORDER BY t.sort_order;
  `);

  console.log('Query succeeded, rows returned:', res.rows.length);
  console.log('Sample Row (Kerani hat):', res.rows[0]);
  await client.end();
}

test().catch(console.error);
