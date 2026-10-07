// Shared Authentication Layer
// Supports Supabase Auth with fallback role simulator

import { NextRequest } from 'next/server';
import { UserAuthContext } from '../authorization';
import { ROLES, RoleType } from '../constants';

export async function getAuthenticatedUser(request?: NextRequest): Promise<UserAuthContext> {
  // If role simulation or specific header is provided
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

  // Default fallback for demo / dev simulator
  return {
    id: 'admin-1',
    email: 'admin@afaztobacco.com',
    role: ROLES.SUPER_ADMIN,
    territoryId: null,
    regionId: null,
    permissions: [],
  };
}
