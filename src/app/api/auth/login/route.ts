// Tier 2: Authentication Login Route Handler
// Validates credentials, verifies bcrypt hash, and issues HTTP-only session

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { dbQuery } from '@/shared/database/db';
import { setSessionCookie, SessionUser } from '@/lib/auth/session';
import { logger } from '@/shared/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Call PostgreSQL stored procedure to retrieve user auth context
    const res = await dbQuery('SELECT sp_get_user_for_auth($1) as user_context', [email]);
    const user = res.rows[0]?.user_context;

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: 'Your account is deactivated. Please contact your Super Administrator.' },
        { status: 403 }
      );
    }

    // Verify hashed password
    const isPasswordValid = bcrypt.compareSync(password, user.passwordHash || '');
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Update last login timestamp
    await dbQuery('UPDATE user_profiles SET last_login_at = NOW() WHERE id = $1', [user.id]);

    // Build session user payload
    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      companyId: user.companyId,
      companyName: user.companyName,
      regionId: user.regionId,
      regionName: user.regionName,
      territoryId: user.territoryId,
      territoryName: user.territoryName,
      mustChangePassword: user.mustChangePassword,
      isOnboarded: user.isOnboarded,
    };

    // Set secure HTTP-only cookie
    await setSessionCookie(sessionUser);

    // Audit log
    await dbQuery(
      `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, new_values, ip_address)
       VALUES ($1, 'AUTH_LOGIN', 'user_profiles', $1, $2, $3)`,
      [
        user.id,
        JSON.stringify({ email: user.email, role: user.role, timestamp: new Date().toISOString() }),
        request.headers.get('x-forwarded-for') || '127.0.0.1',
      ]
    ).catch((err) => logger.error('Audit log failed for login', err));

    return NextResponse.json({
      success: true,
      user: sessionUser,
      mustChangePassword: user.mustChangePassword,
      isOnboarded: user.isOnboarded,
    });
  } catch (error: any) {
    logger.error('Login failed', error, 'AuthController');
    return NextResponse.json(
      { success: false, error: error.message || 'Authentication error' },
      { status: 500 }
    );
  }
}
