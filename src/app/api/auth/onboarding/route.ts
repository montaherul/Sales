// Tier 2: User Onboarding & Password Setup Route Handler
// Completes new user registration setup and updates password hash

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { dbQuery } from '@/shared/database/db';
import { getSessionUser, setSessionCookie } from '@/lib/auth/session';

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
    const fullName = (body.fullName || sessionUser.fullName || '').trim();
    const phone = (body.phone || sessionUser.phone || '').trim();

    if (!newPassword || newPassword.length < 3) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 3 characters long.' },
        { status: 400 }
      );
    }

    // Hash new password
    const newHash = bcrypt.hashSync(newPassword, 10);

    // Update database
    await dbQuery(
      `UPDATE user_profiles
       SET password_hash = $1,
           full_name = $2,
           phone = $3,
           must_change_password = FALSE,
           is_onboarded = TRUE,
           updated_at = NOW()
       WHERE id = $4`,
      [newHash, fullName, phone, sessionUser.id]
    );

    // Update session
    const updatedUser = {
      ...sessionUser,
      fullName,
      phone,
      mustChangePassword: false,
      isOnboarded: true,
    };
    await setSessionCookie(updatedUser);

    // Audit log
    await dbQuery(
      `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, new_values)
       VALUES ($1, 'AUTH_ONBOARDING_COMPLETE', 'user_profiles', $1, $2)`,
      [
        sessionUser.id,
        JSON.stringify({ fullName, phone, email: sessionUser.email, timestamp: new Date().toISOString() }),
      ]
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'Onboarding complete! Your credentials are now active.',
      user: updatedUser,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Onboarding update failed' },
      { status: 500 }
    );
  }
}
