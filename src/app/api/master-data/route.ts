import { NextResponse } from 'next/server';
import { dbQuery, getDbPool } from '@/lib/db';

export async function GET() {
  try {
    if (getDbPool()) {
      // Fetch Territories
      const terrRes = await dbQuery(`
        SELECT t.id, t.name, r.name as region_name, t.sort_order 
        FROM territories t 
        JOIN regions r ON t.region_id = r.id 
        ORDER BY t.sort_order;
      `);

      // Fetch Brands
      const brandRes = await dbQuery(`
        SELECT id, name, type, sort_order 
        FROM brands 
        ORDER BY sort_order;
      `);

      // Fetch Users & Roles
      const userRes = await dbQuery(`
        SELECT u.id, u.email, u.full_name, r.name as role 
        FROM user_profiles u 
        JOIN roles r ON u.role_id = r.id;
      `);

      // Fetch Targets
      const targetRes = await dbQuery(`
        SELECT tg.territory_id, tg.brand_id, tg.target_quantity, tg.route_count, tg.outlet_count
        FROM targets tg
        WHERE tg.year = 2026 AND tg.month = 10;
      `);

      return NextResponse.json({
        success: true,
        data: {
          territories: terrRes.rows,
          brands: brandRes.rows,
          users: userRes.rows,
          targets: targetRes.rows,
        },
      });
    }

    // Static fallback if DB connection string not present
    return NextResponse.json({
      success: true,
      data: {
        territories: [
          { id: 'satkania-1', name: 'Kerani hat', region_name: 'Satkania', sort_order: 1 },
          { id: 'satkania-2', name: 'Satkania', region_name: 'Satkania', sort_order: 2 },
          { id: 'satkania-3', name: 'Bandarban', region_name: 'Satkania', sort_order: 3 },
          { id: 'satkania-4', name: 'Rajasthali', region_name: 'Satkania', sort_order: 4 },
          { id: 'satkania-5', name: 'Dohazari', region_name: 'Satkania', sort_order: 5 },
        ],
        brands: [
          { id: 'b1', name: 'Wilson', type: 'CIGARETTE' },
          { id: 'b2', name: 'Shahara', type: 'CIGARETTE' },
          { id: 'b3', name: 'Express', type: 'CIGARETTE' },
          { id: 'b4', name: 'Nexus', type: 'CIGARETTE' },
          { id: 'b5', name: 'SB', type: 'CIGARETTE' },
          { id: 'b6', name: 'SM', type: 'CIGARETTE' },
          { id: 'b7', name: 'SLB', type: 'ZARDA' },
          { id: 'b8', name: '22/25', type: 'ZARDA' },
          { id: 'b9', name: '99/14', type: 'ZARDA' },
          { id: 'b10', name: '33/15', type: 'ZARDA' },
        ],
        users: [],
        targets: [],
      },
    });
  } catch (error: any) {
    console.error('Master data query error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load master data' },
      { status: 500 }
    );
  }
}
