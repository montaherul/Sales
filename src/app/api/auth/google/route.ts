// Tier 2: Google Sign-In & Supabase OAuth Bridge
// Enforces: No public self-registration. Google account must be pre-provisioned by Super Admin.

import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/shared/database/db';
import { setSessionCookie, SessionUser } from '@/lib/auth/session';
import { logger } from '@/shared/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = (body.email || '').trim().toLowerCase();

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Google authentication email is required.' },
        { status: 400 }
      );
    }

    // Lookup user in PostgreSQL
    const res = await dbQuery('SELECT sp_get_user_for_auth($1) as user_context', [email]);
    const user = res.rows[0]?.user_context;

    // Strict rule: Registration is controlled exclusively by Super Admin
    if (!user) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Google account (${email}) is not authorized. Self-registration is disabled. Please contact your Super Administrator to provision your enterprise account.` 
        },
        { status: 403 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: 'Your account is deactivated. Please contact your Super Administrator.' },
        { status: 403 }
      );
    }

    // Build session user
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

    // Update last login
    await dbQuery('UPDATE user_profiles SET last_login_at = NOW() WHERE id = $1', [user.id]);

    // Issue session cookie
    await setSessionCookie(sessionUser);

    // Audit log
    await dbQuery(
      `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, new_values, ip_address)
       VALUES ($1, 'AUTH_GOOGLE_SIGNIN', 'user_profiles', $1, $2, $3)`,
      [
        user.id,
        JSON.stringify({ email: user.email, role: user.role, provider: 'google', timestamp: new Date().toISOString() }),
        request.headers.get('x-forwarded-for') || '127.0.0.1',
      ]
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      user: sessionUser,
      mustChangePassword: user.mustChangePassword,
      isOnboarded: user.isOnboarded,
    });
  } catch (error: any) {
    logger.error('Google Auth Failed', error, 'GoogleAuthController');
    return NextResponse.json(
      { success: false, error: error.message || 'Google authentication failed' },
      { status: 500 }
    );
  }
}
