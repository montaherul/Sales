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
      const defaultRoleUuids: Record<string, { id: string; email: string; territoryId?: string | null; regionId?: string | null }> = {
        SUPER_ADMIN: { id: '499f6b9f-4f74-4000-b131-9dd283b283fe', email: 'admin@afaztobacco.com' },
        COMPANY_ADMIN: { id: 'dd69f088-d4c6-41e5-aa8d-84f4f79e5824', email: 'admin.atc@afaztobacco.com' },
        RSO: { id: '5b1bb602-4441-4850-95f2-93be62575f95', email: 'rso.satkania@afaztobacco.com', regionId: 'b050e2e2-beb6-4729-a490-9c596efc5218' },
        TSO: { id: '9a65da00-0f66-4059-bda5-fa9bc31eeaab', email: 'tso.keranihat@afaztobacco.com', territoryId: 'c53d8d6b-94e5-4124-8a6e-152798ad415c', regionId: 'b050e2e2-beb6-4729-a490-9c596efc5218' },
        CSR: { id: '304e284f-21d8-40b5-8350-2d9883b4fc7d', email: 'csr.keranihat@afaztobacco.com', territoryId: 'c53d8d6b-94e5-4124-8a6e-152798ad415c', regionId: 'b050e2e2-beb6-4729-a490-9c596efc5218' },
      };
      const defaults = defaultRoleUuids[roleHeader] || { id: '499f6b9f-4f74-4000-b131-9dd283b283fe', email: `${roleHeader.toLowerCase()}@afaztobacco.com` };

      return {
        id: defaults.id,
        email: emailHeader || defaults.email,
        role: roleHeader,
        companyId: companyHeader || '53ea4edf-b686-45cb-816e-b29581847213',
        companyName: 'Afaz Tobacco Company',
        territoryId: territoryHeader || defaults.territoryId || null,
        regionId: defaults.regionId || 'b050e2e2-beb6-4729-a490-9c596efc5218',
        permissions: [],
      };
    }
  }

  // 3. Default fallback for dev simulator
  return {
    id: '499f6b9f-4f74-4000-b131-9dd283b283fe',
    email: 'admin@afaztobacco.com',
    role: ROLES.SUPER_ADMIN,
    companyId: '53ea4edf-b686-45cb-816e-b29581847213',
    companyName: 'Afaz Tobacco Company',
    territoryId: null,
    regionId: null,
    permissions: [],
  };
}
