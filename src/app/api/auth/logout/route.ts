// Tier 2: Authentication Logout Route Handler
// Clears session cookie and writes audit trail

import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie, getSessionUser } from '@/lib/auth/session';
import { dbQuery } from '@/shared/database/db';

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (user) {
      await dbQuery(
        `INSERT INTO audit_logs (user_id, event_type, entity_name, entity_id, new_values, ip_address)
         VALUES ($1, 'AUTH_LOGOUT', 'user_profiles', $1, $2, $3)`,
        [
          user.id,
          JSON.stringify({ email: user.email, role: user.role }),
          request.headers.get('x-forwarded-for') || '127.0.0.1',
        ]
      ).catch(() => {});
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
