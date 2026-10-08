// Supabase OAuth Callback Route
// Handles Google OAuth code exchange, validates against pre-provisioned PostgreSQL users via IdentityService,
// and securely issues the HMAC-SHA256 afaz_session HTTP-only cookie.
// AGENTS1.md Rule 4 & Rule 5 (Thin Controllers)

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { attachSessionCookieToResponse } from '@/lib/auth/session';
import { IdentityService } from '@/modules/identity';
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
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Authenticating | Tobacco SaaS</title>
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
    const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1';

    const { sessionUser, user } = await IdentityService.authenticateGoogle(email, ipAddress);

    // If metadata has a full name that is better than the fallback, update it
    if (data.user.user_metadata?.full_name && !sessionUser.fullName) {
      sessionUser.fullName = data.user.user_metadata.full_name;
    }

    // Create redirect response
    const redirectResponse = NextResponse.redirect(`${origin}/`);

    // Attach signed session cookie to the redirect response
    attachSessionCookieToResponse(redirectResponse, sessionUser);

    logger.info(`Google login successful for ${email} (${user.role})`, 'AuthCallback');
    return redirectResponse;
  } catch (error: any) {
    logger.error('Unexpected error in Google auth callback', error, 'AuthCallback');
    const msg = error.message || 'internal_auth_error';
    return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(msg)}`);
  }
}
