// Shared Authentication Layer
// Supports Supabase Auth with fallback role simulator

import { NextRequest } from 'next/server';
import { UserAuthContext } from '../authorization';
import { ROLES, RoleType } from '../constants';

import { getSessionUser } from '@/lib/auth/session';

export async function getAuthenticatedUser(request?: NextRequest): Promise<UserAuthContext> {
  // 1. Check real cryptographically verified session cookie
  const sessionUser = await getSessionUser();
  if (sessionUser) {
    return {
      id: sessionUser.id,
      email: sessionUser.email,
      role: sessionUser.role,
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

    if (roleHeader && Object.values(ROLES).includes(roleHeader)) {
      return {
        id: `sim-${roleHeader.toLowerCase()}`,
        email: emailHeader || `${roleHeader.toLowerCase()}@afaztobacco.com`,
        role: roleHeader,
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
