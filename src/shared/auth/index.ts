// Shared Authentication Layer
// Supports Supabase Auth with fallback role simulator

import { NextRequest } from 'next/server';
import { UserAuthContext } from '../authorization';
export type { UserAuthContext };
import { ROLES, RoleType } from '../constants';

import { getSessionUser, verifyToken, SessionUser } from '@/lib/auth/session';

export async function getAuthenticatedUser(request?: NextRequest): Promise<UserAuthContext> {
  // 1. Check direct cookie from request object if present
  if (request) {
    const cookieHeader = request.headers.get('cookie');
    let rawCookie = request.cookies?.get('afaz_session')?.value;
    if (!rawCookie && cookieHeader) {
      const match = cookieHeader.match(/afaz_session=([^;]+)/);
      if (match) {
        rawCookie = match[1];
      }
    }

    if (rawCookie) {
      const decoded = decodeURIComponent(rawCookie);
      const data = verifyToken<{ user: SessionUser; expiresAt: number }>(decoded);
      if (data?.user && (!data.expiresAt || Date.now() <= data.expiresAt)) {
        return {
          id: data.user.id,
          email: data.user.email,
          role: data.user.role,
          companyId: data.user.companyId || null,
          companyName: data.user.companyName || null,
          territoryId: data.user.territoryId || null,
          regionId: data.user.regionId || null,
          permissions: [],
        };
      }
    }
  }

  // 2. Check next/headers cookie store
  const sessionUser = await getSessionUser();
  if (sessionUser) {
    return {
      id: sessionUser.id,
      email: sessionUser.email,
      role: sessionUser.role,
      companyId: sessionUser.companyId || null,
      companyName: sessionUser.companyName || null,
      territoryId: sessionUser.territoryId || null,
      regionId: sessionUser.regionId || null,
      permissions: [],
    };
  }

  // 2. Check role simulation header if provided
  if (request) {
    const roleHeader = request.headers.get('x-user-role') as RoleType | null;
    const emailHeader = request.headers.get('x-user-email');
    const territoryHeader = request.headers.get('x-user-territory');
    const companyHeader = request.headers.get('x-user-company');

    if (roleHeader && (Object.values(ROLES) as string[]).includes(roleHeader)) {
      return {
        id: `sim-${roleHeader.toLowerCase()}`,
        email: emailHeader || `${roleHeader.toLowerCase()}@afaztobacco.com`,
        role: roleHeader,
        companyId: companyHeader || '53ea4edf-b686-45cb-816e-b29581847213',
        companyName: 'Afaz Tobacco Company',
        territoryId: territoryHeader || (roleHeader === 'TSO' || roleHeader === 'CSR' ? 'satkania-keranihat' : null),
        regionId: 'satkania-region',
        permissions: [],
      };
    }
  }

  // 3. Default fallback for dev simulator
  return {
    id: 'admin-1',
    email: 'admin@afaztobacco.com',
    role: ROLES.SUPER_ADMIN,
    territoryId: null,
    regionId: null,
    permissions: [],
  };
}
