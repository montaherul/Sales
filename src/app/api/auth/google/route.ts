// Tier 2 Presentation Controller: Google Sign-In & Supabase OAuth Bridge
// Enforces: No public self-registration. Pre-authorized identity handling via IdentityService.
// AGENTS1.md Rule 4 & Rule 5 (Presentation Layer / Thin Controllers)

import { NextRequest, NextResponse } from 'next/server';
import { IdentityService } from '@/modules/identity';
import { setSessionCookie } from '@/lib/auth/session';
import { logger } from '@/shared/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = body.email || '';
    const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1';

    const { sessionUser, user } = await IdentityService.authenticateGoogle(email, ipAddress);

    // Issue session cookie
    await setSessionCookie(sessionUser);

    return NextResponse.json({
      success: true,
      user: sessionUser,
      mustChangePassword: user.mustChangePassword,
      isOnboarded: user.isOnboarded,
    });
  } catch (error: any) {
    logger.error('Google Auth Failed', error, 'GoogleAuthController.POST');
    return NextResponse.json(
      { success: false, error: error.message || 'Google authentication failed' },
      { status: error.statusCode || 403 }
    );
  }
}
