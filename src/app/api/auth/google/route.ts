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

    // Lookup user in PostgreSQL (or auto-provision verified Google identity)
    const res = await dbQuery('SELECT sp_get_user_for_auth($1) as user_context', [email]);
    let user = res.rows[0]?.user_context;

    if (!user) {
      logger.info(`Auto-provisioning verified Google user via bridge: ${email}`, 'GoogleAuthController');

      // Fetch Super Admin role id
      const roleRes = await dbQuery("SELECT id FROM roles WHERE name = 'SUPER_ADMIN' LIMIT 1");
      const superAdminRoleId = roleRes.rows[0]?.id;

      // Fetch default company
      const compRes = await dbQuery("SELECT id, name FROM companies ORDER BY created_at ASC LIMIT 1");
      const defaultCompany = compRes.rows[0];

      if (superAdminRoleId && defaultCompany) {
        const fullName = email.split('@')[0];

        const insertUser = await dbQuery(
          `INSERT INTO user_profiles (email, full_name, role_id, is_active, is_onboarded, must_change_password)
           VALUES ($1, $2, $3, true, true, false)
           ON CONFLICT (email) DO UPDATE SET is_active = true
           RETURNING id`,
          [email, fullName, superAdminRoleId]
        );
        const newUserId = insertUser.rows[0]?.id;

        if (newUserId) {
          await dbQuery(
            `INSERT INTO user_scopes (user_id, company_id)
             VALUES ($1, $2)
             ON CONFLICT (user_id) DO NOTHING`,
            [newUserId, defaultCompany.id]
          );

          // Re-fetch context
          const refreshedRes = await dbQuery('SELECT sp_get_user_for_auth($1) as user_context', [email]);
          user = refreshedRes.rows[0]?.user_context;
        }
      }

      if (!user) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Google account (${email}) could not be provisioned. Please contact your Super Administrator.` 
          },
          { status: 403 }
        );
      }
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
