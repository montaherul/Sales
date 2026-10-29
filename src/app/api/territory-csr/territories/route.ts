import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/shared/database/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    const sql = `
      SELECT t.id, t.name, r.name as region_name, COUNT(rt.id)::int as route_count
      FROM territories t
      JOIN regions r ON t.region_id = r.id
      JOIN wings w ON r.wing_id = w.id
      JOIN divisions d ON w.division_id = d.id
      LEFT JOIN routes rt ON rt.territory_id = t.id AND rt.is_active = TRUE
      WHERE ($1::uuid IS NULL OR d.company_id = $1)
      GROUP BY t.id, t.name, r.name, t.sort_order
      ORDER BY r.name, t.sort_order ASC, t.name ASC;
    `;

    const res = await dbQuery(sql, [companyId && companyId !== 'ALL' ? companyId : null]);

    return NextResponse.json({
      success: true,
      data: res.rows,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list territories' },
      { status: 500 }
    );
  }
}
