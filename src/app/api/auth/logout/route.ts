// Tier 2 Presentation Controller: Authentication Logout Route Handler
// Clears session cookie and delegates audit trail to IdentityService
// AGENTS1.md Rule 4 & Rule 5 (Presentation Layer / Thin Controllers)

import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie, getSessionUser } from '@/lib/auth/session';
import { IdentityService } from '@/modules/identity';

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (user) {
      const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1';
      await IdentityService.recordLogout(user, ipAddress);
    }

    await clearSessionCookie();

    return NextResponse.json({ success: true, message: 'Logged out successfully' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Logout failed' },
      { status: 500 }
    );
  }
}
