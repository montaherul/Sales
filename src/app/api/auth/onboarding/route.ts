// Tier 2 Presentation Controller: User Onboarding & Password Setup Route Handler
// Completes new user registration setup and updates password hash via IdentityService
// AGENTS1.md Rule 4 & Rule 5 (Presentation Layer / Thin Controllers)

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, setSessionCookie } from '@/lib/auth/session';
import { IdentityService } from '@/modules/identity';

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Please log in first.' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const newPassword = body.newPassword || '';
    const fullName = body.fullName;
    const phone = body.phone;

    const updatedUser = await IdentityService.completeOnboarding(sessionUser, newPassword, fullName, phone);

    // Update session cookie
    await setSessionCookie(updatedUser);

    return NextResponse.json({
      success: true,
      message: 'Onboarding complete! Your credentials are now active.',
      user: updatedUser,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Onboarding update failed' },
      { status: error.statusCode || 500 }
    );
  }
}
