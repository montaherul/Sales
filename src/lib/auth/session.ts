// Enterprise Session Management Layer
// Cryptographically signed HTTP-only cookies with HMAC-SHA256

import crypto from 'crypto';
import { cookies } from 'next/headers';
import { RoleType } from '@/lib/types';

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  role: RoleType;
  companyId?: string | null;
  companyName?: string | null;
  regionId?: string | null;
  regionName?: string | null;
  territoryId?: string | null;
  territoryName?: string | null;
  mustChangePassword?: boolean;
  isOnboarded?: boolean;
}

const SESSION_COOKIE_NAME = 'afaz_session';
const SESSION_SECRET = process.env.SUPABASE_SECRET_KEY || process.env.DATABASE_URL || 'afaz-tobacco-platform-secret-key-2026';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export function signPayload(payload: any): string {
  const jsonStr = JSON.stringify(payload);
  const base64Data = Buffer.from(jsonStr).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(base64Data)
    .digest('base64url');
  return `${base64Data}.${signature}`;
}

export function verifyToken<T = any>(token: string): T | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [base64Data, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(base64Data)
      .digest('base64url');

    if (
      signature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
    ) {
      return null;
    }

    const jsonStr = Buffer.from(base64Data, 'base64url').toString('utf-8');
    return JSON.parse(jsonStr) as T;
  } catch {
    return null;
  }
}

export async function setSessionCookie(user: SessionUser): Promise<void> {
  const token = signPayload({
    user,
    createdAt: Date.now(),
    expiresAt: Date.now() + MAX_AGE_SECONDS * 1000,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE_SECONDS,
    path: '/',
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export function attachSessionCookieToResponse(response: any, user: SessionUser): void {
  const token = signPayload({
    user,
    createdAt: Date.now(),
    expiresAt: Date.now() + MAX_AGE_SECONDS * 1000,
  });

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE_SECONDS,
    path: '/',
  });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(SESSION_COOKIE_NAME);
    if (!cookie?.value) return null;

    const data = verifyToken<{ user: SessionUser; expiresAt: number }>(cookie.value);
    if (!data || !data.user || Date.now() > data.expiresAt) {
      return null;
    }
    return data.user;
  } catch {
    return null;
  }
}
