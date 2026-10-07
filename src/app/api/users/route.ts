import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, getDbPool } from '@/lib/db';
import { SubmissionRepository } from '@/lib/repositories/submission.repository';

export async function GET() {
  try {
    if (getDbPool()) {
      const usersRes = await dbQuery(`
        SELECT 
          u.id, 
          u.email, 
          u.full_name, 
          u.phone, 
          r.name as role_name, 
          u.is_active, 
          u.created_at,
          t.name as territory_name,
          reg.name as region_name
        FROM user_profiles u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN user_scopes s ON s.user_id = u.id
        LEFT JOIN territories t ON s.territory_id = t.id
        LEFT JOIN regions reg ON s.region_id = reg.id
        ORDER BY u.created_at ASC;
      `);

      return NextResponse.json({
        success: true,
        data: usersRes.rows,
      });
    }

    return NextResponse.json({
      success: true,
      data: [
        { id: '1', email: 'admin@afaztobacco.com', full_name: 'System Administrator', role_name: 'SUPER_ADMIN', is_active: true },
        { id: '2', email: 'rso.satkania@afaztobacco.com', full_name: 'Satkania Regional Officer', role_name: 'RSO', region_name: 'Satkania', is_active: true },
        { id: '3', email: 'tso.keranihat@afaztobacco.com', full_name: 'Kerani Hat Territory Officer', role_name: 'TSO', territory_name: 'Kerani hat', is_active: true },
        { id: '4', email: 'csr.keranihat@afaztobacco.com', full_name: 'Kerani Hat Sales Representative', role_name: 'CSR', territory_name: 'Kerani hat', is_active: true },
      ],
    });
  } catch (error: any) {
    console.error('Users GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, fullName, phone, roleName, territoryId, regionId, modifiedBy } = body;

    if (!email || !fullName || !roleName) {
      return NextResponse.json({ success: false, error: 'Email, Full Name, and Role are required' }, { status: 400 });
    }

    if (getDbPool()) {
      // Find role
      const roleRes = await dbQuery('SELECT id FROM roles WHERE name = $1 LIMIT 1;', [roleName]);
      const roleId = roleRes.rows[0]?.id;
      if (!roleId) {
        return NextResponse.json({ success: false, error: `Invalid role: ${roleName}` }, { status: 400 });
      }

      // Upsert user_profile
      const userRes = await dbQuery(`
        INSERT INTO user_profiles (email, full_name, phone, role_id, is_active)
        VALUES ($1, $2, $3, $4, TRUE)
        ON CONFLICT (email) DO UPDATE
        SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone, role_id = EXCLUDED.role_id, updated_at = NOW()
        RETURNING id;
      `, [email, fullName, phone || null, roleId]);

      const userId = userRes.rows[0].id;

      // Assign user scope if territory or region specified
      if (territoryId || regionId) {
        await dbQuery(`
          DELETE FROM user_scopes WHERE user_id = $1;
          INSERT INTO user_scopes (user_id, territory_id, region_id)
          VALUES ($1, $2, $3);
        `, [userId, territoryId || null, regionId || null]);
      }

      // Audit log
      await SubmissionRepository.recordAuditLog(
        'USER_CREATE_OR_UPDATE',
        modifiedBy || 'admin@afaztobacco.com',
        'user_profiles',
        userId,
        undefined,
        { email, fullName, roleName, territoryId, regionId }
      );

      return NextResponse.json({
        success: true,
        message: `User ${email} created/updated successfully.`,
        data: { userId },
      });
    }

    return NextResponse.json({ success: true, message: 'Simulated user creation.' });
  } catch (error: any) {
    console.error('Users POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create user' },
      { status: 500 }
    );
  }
}
