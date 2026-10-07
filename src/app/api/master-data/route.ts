import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, getDbPool } from '@/lib/db';
import { getAuthenticatedUser } from '@/shared/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reqCompanyId = searchParams.get('companyId');
    const actor = await getAuthenticatedUser(request);

    // Determine effective company scope
    let filterCompanyId: string | null = null;
    if (actor.role !== 'SUPER_ADMIN') {
      filterCompanyId = actor.companyId || null;
    } else if (reqCompanyId && reqCompanyId !== 'ALL') {
      filterCompanyId = reqCompanyId;
    }

    if (getDbPool()) {
      // 1. Fetch Companies (Non-super admin only gets their assigned company)
      const compSql = actor.role !== 'SUPER_ADMIN' && filterCompanyId
        ? `SELECT id, name, code FROM companies WHERE id = $1 ORDER BY name;`
        : `SELECT id, name, code FROM companies ORDER BY name;`;
      const compParams = actor.role !== 'SUPER_ADMIN' && filterCompanyId ? [filterCompanyId] : [];
      const compRes = await dbQuery(compSql, compParams);

      // 2. Fetch Regions with Company Scoping
      const regSql = filterCompanyId
        ? `SELECT 
            r.id, 
            r.name, 
            d.company_id, 
            c.name as company_name 
          FROM regions r 
          JOIN wings w ON r.wing_id = w.id 
          JOIN divisions d ON w.division_id = d.id 
          JOIN companies c ON d.company_id = c.id 
          WHERE d.company_id = $1
          ORDER BY r.name;`
        : `SELECT 
            r.id, 
            r.name, 
            d.company_id, 
            c.name as company_name 
          FROM regions r 
          JOIN wings w ON r.wing_id = w.id 
          JOIN divisions d ON w.division_id = d.id 
          JOIN companies c ON d.company_id = c.id 
          ORDER BY r.name;`;
      const regParams = filterCompanyId ? [filterCompanyId] : [];
      const regRes = await dbQuery(regSql, regParams);

      // 3. Fetch Territories with Company & Region Scoping
      const terrSql = filterCompanyId
        ? `SELECT 
            t.id, 
            t.name, 
            t.region_id, 
            r.name as region_name, 
            d.company_id, 
            c.name as company_name, 
            t.sort_order 
          FROM territories t 
          JOIN regions r ON t.region_id = r.id 
          JOIN wings w ON r.wing_id = w.id 
          JOIN divisions d ON w.division_id = d.id 
          JOIN companies c ON d.company_id = c.id 
          WHERE d.company_id = $1
          ORDER BY t.sort_order;`
        : `SELECT 
            t.id, 
            t.name, 
            t.region_id, 
            r.name as region_name, 
            d.company_id, 
            c.name as company_name, 
            t.sort_order 
          FROM territories t 
          JOIN regions r ON t.region_id = r.id 
          JOIN wings w ON r.wing_id = w.id 
          JOIN divisions d ON w.division_id = d.id 
          JOIN companies c ON d.company_id = c.id 
          ORDER BY t.sort_order;`;
      const terrParams = filterCompanyId ? [filterCompanyId] : [];
      const terrRes = await dbQuery(terrSql, terrParams);

      // 4. Fetch Brands (shared or company-scoped)
      const brandRes = await dbQuery(`
        SELECT id, name, type, sort_order 
        FROM brands 
        ORDER BY sort_order;
      `);

      // 5. Fetch Users & Roles
      const userSql = filterCompanyId
        ? `SELECT u.id, u.email, u.full_name, r.name as role, us.company_id
           FROM user_profiles u 
           JOIN roles r ON u.role_id = r.id
           LEFT JOIN user_scopes us ON u.id = us.user_id
           WHERE us.company_id = $1;`
        : `SELECT u.id, u.email, u.full_name, r.name as role, us.company_id
           FROM user_profiles u 
           JOIN roles r ON u.role_id = r.id
           LEFT JOIN user_scopes us ON u.id = us.user_id;`;
      const userParams = filterCompanyId ? [filterCompanyId] : [];
      const userRes = await dbQuery(userSql, userParams);

      // 6. Fetch Targets
      const targetSql = filterCompanyId
        ? `SELECT tg.territory_id, tg.brand_id, tg.target_quantity, tg.route_count, tg.outlet_count
           FROM targets tg
           JOIN territories t ON tg.territory_id = t.id
           JOIN regions r ON t.region_id = r.id
           JOIN wings w ON r.wing_id = w.id
           JOIN divisions d ON w.division_id = d.id
           WHERE tg.year = 2026 AND tg.month = 10 AND d.company_id = $1;`
        : `SELECT tg.territory_id, tg.brand_id, tg.target_quantity, tg.route_count, tg.outlet_count
           FROM targets tg
           WHERE tg.year = 2026 AND tg.month = 10;`;
      const targetParams = filterCompanyId ? [filterCompanyId] : [];
      const targetRes = await dbQuery(targetSql, targetParams);

      return NextResponse.json({
        success: true,
        data: {
          companies: compRes.rows,
          regions: regRes.rows,
          territories: terrRes.rows,
          brands: brandRes.rows,
          users: userRes.rows,
          targets: targetRes.rows,
          activeScopeCompanyId: filterCompanyId,
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
        activeScopeCompanyId: filterCompanyId,
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
