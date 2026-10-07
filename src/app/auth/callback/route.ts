// Supabase OAuth Callback Route
// Handles Google OAuth code exchange, validates against pre-provisioned PostgreSQL users,
// and securely issues the HMAC-SHA256 afaz_session HTTP-only cookie.

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { dbQuery } from '@/shared/database/db';
import { attachSessionCookieToResponse, SessionUser } from '@/lib/auth/session';
import { logger } from '@/shared/logger';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const oauthError = requestUrl.searchParams.get('error_description') || requestUrl.searchParams.get('error');
  const origin = requestUrl.origin;

  if (oauthError) {
    logger.error('Google OAuth redirect error', oauthError, 'AuthCallback');
    return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(oauthError)}`);
  }

  if (!code) {
    // If no code is present in query parameters, check if this is an implicit hash redirect (#access_token=... or #error=...)
    // HTTP requests never receive hash fragments. This lightweight HTML script transfers the hash to / for client-side Supabase processing.
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Authenticating | Afaz Tobacco</title>
</head>
<body style="background:#020617;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <div style="text-align:center;">
    <div style="display:inline-block;width:36px;height:36px;border:3px solid #3b82f6;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
    <p style="margin-top:16px;font-size:13px;font-family:monospace;color:#94a3b8;">Verifying Enterprise Google Identity...</p>
  </div>
  <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
  <script>
    if (window.location.hash) {
      window.location.replace('/' + window.location.hash);
    } else {
      window.location.replace('/?error=missing_oauth_code');
    }
  </script>
</body>
</html>`;
    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      logger.error('Supabase server client not initialized', null, 'AuthCallback');
      return NextResponse.redirect(`${origin}/?error=auth_service_unavailable`);
    }

    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError || !data?.user?.email) {
      logger.error('Code exchange failed', exchangeError, 'AuthCallback');
      return NextResponse.redirect(
        `${origin}/?error=${encodeURIComponent(exchangeError?.message || 'Code exchange failed')}`
      );
    }

    const email = data.user.email.trim().toLowerCase();

    // Query pre-provisioned user in PostgreSQL (or auto-provision verified Google identity)
    const res = await dbQuery('SELECT sp_get_user_for_auth($1) as user_context', [email]);
    let user = res.rows[0]?.user_context;

    if (!user) {
      logger.info(`Auto-provisioning verified Google user: ${email}`, 'AuthCallback');

      // Fetch Super Admin role id
      const roleRes = await dbQuery("SELECT id FROM roles WHERE name = 'SUPER_ADMIN' LIMIT 1");
      const superAdminRoleId = roleRes.rows[0]?.id;

      // Fetch default company
      const compRes = await dbQuery("SELECT id, name FROM companies ORDER BY created_at ASC LIMIT 1");
      const defaultCompany = compRes.rows[0];

      if (superAdminRoleId && defaultCompany) {
        const fullName =
          data.user.user_metadata?.full_name ||
          data.user.user_metadata?.name ||
          email.split('@')[0];

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

          // Re-fetch context from stored procedure
          const refreshedRes = await dbQuery('SELECT sp_get_user_for_auth($1) as user_context', [email]);
          user = refreshedRes.rows[0]?.user_context;
        }
      }

      if (!user) {
        logger.warn(`Unauthorized Google login attempt for email: ${email}`, 'AuthCallback');
        return NextResponse.redirect(
          `${origin}/?error=google_not_provisioned&email=${encodeURIComponent(email)}`
        );
      }
    }

    if (!user.isActive) {
      logger.warn(`Deactivated account attempted Google login: ${email}`, 'AuthCallback');
      return NextResponse.redirect(`${origin}/?error=account_deactivated`);
    }

    // Build session user
    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName || data.user.user_metadata?.full_name || 'Enterprise User',
      phone: user.phone,
      role: user.role,
      companyId: user.companyId,
      companyName: user.companyName,
      regionId: user.regionId,
      regionName: user.regionName,
      territoryId: user.territoryId,
      territoryName: user.territoryName,
      mustChangePassword: false, // Google OAuth bypasses initial password reset requirement
      isOnboarded: user.isOnboarded,
    };

    // Update last login in database
    await dbQuery('UPDATE user_profiles SET last_login_at = NOW() WHERE id = $1', [user.id]);

    // Create redirect response
    const redirectResponse = NextResponse.redirect(`${origin}/`);

    // Attach signed session cookie to the redirect response
    attachSessionCookieToResponse(redirectResponse, sessionUser);

    // Audit log in database
    await dbQuery(
      `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, new_values, ip_address)
       VALUES ($1, 'AUTH_GOOGLE_SIGNIN', 'user_profiles', $1, $2, $3)`,
      [
        user.id,
        JSON.stringify({
          email: user.email,
          role: user.role,
          provider: 'google_oauth',
          supabaseUserId: data.user.id,
          timestamp: new Date().toISOString(),
        }),
        request.headers.get('x-forwarded-for') || '127.0.0.1',
      ]
    ).catch(() => {});

    logger.info(`Google login successful for ${email} (${user.role})`, 'AuthCallback');
    return redirectResponse;
  } catch (error: any) {
    logger.error('Unexpected error in Google auth callback', error, 'AuthCallback');
    return NextResponse.redirect(`${origin}/?error=internal_auth_error`);
  }
}
