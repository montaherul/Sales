import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/shared/database/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const territoryId = searchParams.get('territoryId');

    if (!territoryId) {
      return NextResponse.json({ success: false, error: 'territoryId is required' }, { status: 400 });
    }

    const res = await dbQuery(`
      SELECT r.id, r.territory_id, r.name, r.code, r.csr_id, r.csr_name, r.outlet_count, r.sort_order, r.is_active,
             u.full_name as user_full_name, u.email as user_email
      FROM routes r
      LEFT JOIN user_profiles u ON r.csr_id = u.id
      WHERE r.territory_id = $1 AND r.is_active = TRUE
      ORDER BY r.sort_order ASC, r.name ASC;
    `, [territoryId]);

    return NextResponse.json({ success: true, data: res.rows });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to list routes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { territoryId, name, csrName, csrId, outletCount, sortOrder, companyId } = body;

    if (!territoryId || !name) {
      return NextResponse.json({ success: false, error: 'territoryId and name are required' }, { status: 400 });
    }

    // Auto-generate code
    const countRes = await dbQuery('SELECT COUNT(*)::int as cnt FROM routes WHERE territory_id = $1;', [territoryId]);
    const nextNum = (countRes.rows[0]?.cnt || 0) + 1;
    const code = `RT-${nextNum}`;

    const insRes = await dbQuery(`
      INSERT INTO routes (territory_id, name, code, csr_id, csr_name, outlet_count, sort_order, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
      RETURNING id, territory_id, name, code, csr_name, outlet_count, sort_order;
    `, [
      territoryId,
      name.trim(),
      code,
      csrId || null,
      csrName ? csrName.trim() : null,
      parseInt(String(outletCount || 0), 10),
      sortOrder ? parseInt(String(sortOrder), 10) : nextNum,
    ]);

    const createdRoute = insRes.rows[0];

    // Initialize default target
    const now = new Date();
    await dbQuery(`
      INSERT INTO route_targets (company_id, territory_id, route_id, year, month, target_cigarette, target_bidi)
      VALUES ($1, $2, $3, $4, $5, 0, 0)
      ON CONFLICT DO NOTHING;
    `, [companyId || null, territoryId, createdRoute.id, now.getFullYear(), now.getMonth() + 1]);

    return NextResponse.json({
      success: true,
      message: 'Route created successfully',
      data: createdRoute,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to create route' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, csrName, csrId, outletCount, sortOrder } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Route id is required' }, { status: 400 });
    }

    const updRes = await dbQuery(`
      UPDATE routes
      SET name = COALESCE($1, name),
          csr_name = COALESCE($2, csr_name),
          csr_id = $3,
          outlet_count = COALESCE($4, outlet_count),
          sort_order = COALESCE($5, sort_order)
      WHERE id = $6
      RETURNING id, name, csr_name, outlet_count, sort_order;
    `, [
      name ? name.trim() : null,
      csrName ? csrName.trim() : null,
      csrId || null,
      outletCount !== undefined ? parseInt(String(outletCount), 10) : null,
      sortOrder !== undefined ? parseInt(String(sortOrder), 10) : null,
      id,
    ]);

    if (updRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Route not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Route updated successfully',
      data: updRes.rows[0],
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to update route' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Route id is required' }, { status: 400 });
    }

    await dbQuery(`
      UPDATE routes
      SET is_active = FALSE
      WHERE id = $1;
    `, [id]);

    return NextResponse.json({
      success: true,
      message: 'Route deactivated successfully',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to delete route' }, { status: 500 });
  }
}
