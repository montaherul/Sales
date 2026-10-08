// Tier 2 Presentation Controller: Authentication Login Route Handler
// Validates HTTP request, delegates authentication to IdentityService, and sets session cookie
// AGENTS1.md Rule 4 & Rule 5 (Presentation Layer / Thin Controllers)

import { NextRequest, NextResponse } from 'next/server';
import { IdentityService } from '@/modules/identity';
import { setSessionCookie } from '@/lib/auth/session';
import { logger } from '@/shared/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = body.email || '';
    const password = body.password || '';
    const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1';

    const { sessionUser, user } = await IdentityService.authenticateCredentials(email, password, ipAddress);

    // Set secure HTTP-only cookie
    await setSessionCookie(sessionUser);

    return NextResponse.json({
      success: true,
      user: sessionUser,
      mustChangePassword: user.mustChangePassword,
      isOnboarded: user.isOnboarded,
    });
  } catch (error: any) {
    logger.error('Login failed', error, 'AuthController.POST');
    return NextResponse.json(
      { success: false, error: error.message || 'Authentication error' },
      { status: error.statusCode || 401 }
    );
  }
}
