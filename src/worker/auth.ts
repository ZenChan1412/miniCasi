/**
 * ยืนยันตัวตนผู้เรียก /api/admin/* ฝั่งเซิร์ฟเวอร์
 *
 * ตรวจ Google ID token (RS256) กับ JWKS ของ Google ด้วย WebCrypto แล้วหา role จาก
 * role_overrides ใน D1 และรายชื่ออีเมลใน AdminConfig เท่านั้น — ไม่เชื่อ role ที่ client ส่งมา
 */
import { ADMIN_EMAILS, CREATOR_EMAILS, normalizeEmail } from '../domain/constants/AdminConfig';
import type { D1Database, Env } from './types';

export type Role = 'creator' | 'admin' | 'player';

export interface Actor {
  sub: string;
  playerId: string;
  email: string;
  role: Role;
}

const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const CLOCK_SKEW_SEC = 60;
const JWKS_TTL_MS = 60 * 60 * 1000;

interface Jwk {
  kid: string;
  kty: string;
  alg?: string;
  n: string;
  e: string;
}

let jwksCache: { keys: Jwk[]; fetchedAt: number } | null = null;

async function loadJwks(force = false): Promise<Jwk[]> {
  if (!force && jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys;
  }
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error(`โหลด JWKS ของ Google ไม่สำเร็จ (HTTP ${res.status})`);
  const body = (await res.json()) as { keys?: Jwk[] };
  jwksCache = { keys: body.keys ?? [], fetchedAt: Date.now() };
  return jwksCache.keys;
}

/** ใช้ใน test เพื่อฉีด JWKS โดยไม่ต้องเรียกเครือข่าย */
export function setJwksForTest(keys: Jwk[] | null): void {
  jwksCache = keys ? { keys, fetchedAt: Date.now() } : null;
}

function b64urlToBytes(input: string): Uint8Array<ArrayBuffer> {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function parseJson<T>(bytes: Uint8Array): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return null;
  }
}

interface VerifiedToken {
  sub: string;
  email: string;
}

/** คืน null เมื่อ token ไม่ถูกต้อง/หมดอายุ/aud ไม่ตรง */
export async function verifyGoogleIdToken(
  token: string,
  clientId: string
): Promise<VerifiedToken | null> {
  const parts = token.split('.');
  if (parts.length !== 3 || !clientId) return null;

  const header = parseJson<{ alg?: string; kid?: string }>(b64urlToBytes(parts[0]));
  const payload = parseJson<{
    iss?: string;
    aud?: string;
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
    exp?: number;
  }>(b64urlToBytes(parts[1]));
  if (!header || !payload || header.alg !== 'RS256' || !header.kid) return null;

  let keys = await loadJwks();
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    // Google หมุนคีย์เป็นระยะ — ลองโหลดใหม่หนึ่งครั้งก่อนปฏิเสธ
    keys = await loadJwks(true);
    jwk = keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) return null;

  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64urlToBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!valid) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  if (!payload.iss || !ISSUERS.includes(payload.iss)) return null;
  if (payload.aud !== clientId) return null;
  if (typeof payload.exp !== 'number' || payload.exp + CLOCK_SKEW_SEC < nowSec) return null;
  if (!payload.sub || !payload.email) return null;
  if (payload.email_verified !== true && payload.email_verified !== 'true') return null;

  return { sub: payload.sub, email: normalizeEmail(payload.email) };
}

/**
 * role ของอีเมล/ไอดีหนึ่งๆ: override ใน D1 (ตาม id แล้วอีเมล) > รายชื่อใน AdminConfig > player
 * ใช้ลำดับเดียวกับ listManagedUsers เพื่อให้ Dashboard กับสิทธิ์จริงตรงกัน
 */
export async function resolveServerRole(
  db: D1Database,
  playerId: string | null,
  email: string | null
): Promise<Role> {
  const normalized = normalizeEmail(email);

  if (playerId) {
    const byId = await db
      .prepare('SELECT role FROM role_overrides WHERE identifier = ?')
      .bind(playerId.toLowerCase())
      .first<{ role: Role }>();
    if (byId) return byId.role;
  }
  if (normalized) {
    const byEmail = await db
      .prepare('SELECT role FROM role_overrides WHERE identifier = ?')
      .bind(normalized)
      .first<{ role: Role }>();
    if (byEmail) return byEmail.role;
    if (CREATOR_EMAILS.includes(normalized)) return 'creator';
    if (ADMIN_EMAILS.includes(normalized)) return 'admin';
  }
  return 'player';
}

export type AuthResult = { ok: true; actor: Actor } | { ok: false; status: number; error: string };

/** อ่าน Bearer token แล้วหา role ฝั่งเซิร์ฟเวอร์; ต้องมี role อย่างน้อย `minRole` */
export async function authenticate(
  request: Request,
  env: Env,
  minRole: 'admin' | 'creator'
): Promise<AuthResult> {
  const clientId = (env.GOOGLE_CLIENT_ID ?? '').trim();
  if (!clientId) {
    return { ok: false, status: 503, error: 'เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า GOOGLE_CLIENT_ID' };
  }

  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    return { ok: false, status: 401, error: 'ต้องล็อกอินด้วย Google ก่อนใช้งานส่วนผู้ดูแลระบบ' };
  }

  let verified: VerifiedToken | null;
  try {
    verified = await verifyGoogleIdToken(token, clientId);
  } catch (err) {
    console.error('verify token error:', err);
    return { ok: false, status: 503, error: 'ตรวจสอบโทเค็นกับ Google ไม่สำเร็จ ลองใหม่อีกครั้ง' };
  }
  if (!verified) {
    return {
      ok: false,
      status: 401,
      error: 'เซสชันหมดอายุหรือโทเค็นไม่ถูกต้อง กรุณาล็อกอินด้วย Google ใหม่',
    };
  }

  const playerId = `google_${verified.sub}`;
  const role = await resolveServerRole(env.DB, playerId, verified.email);
  const allowed = minRole === 'creator' ? role === 'creator' : role === 'admin' || role === 'creator';
  if (!allowed) {
    return {
      ok: false,
      status: 403,
      error: minRole === 'creator' ? 'เฉพาะผู้สร้าง (Creator) เท่านั้น' : 'ต้องเป็นผู้ดูแลระบบ (Admin)',
    };
  }

  return { ok: true, actor: { sub: verified.sub, playerId, email: verified.email, role } };
}

/** role ของผู้เรียกจาก token ที่ยืนยันแล้ว (ไม่ต้องเป็นแอดมิน) — ให้ client ซิงก์สิทธิ์ที่ได้รับแต่งตั้ง */
export async function whoAmI(request: Request, env: Env): Promise<AuthResult> {
  const clientId = (env.GOOGLE_CLIENT_ID ?? '').trim();
  if (!clientId) return { ok: false, status: 503, error: 'เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า GOOGLE_CLIENT_ID' };
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const verified = token ? await verifyGoogleIdToken(token, clientId).catch(() => null) : null;
  if (!verified) return { ok: false, status: 401, error: 'โทเค็นไม่ถูกต้องหรือหมดอายุ' };
  const playerId = `google_${verified.sub}`;
  const role = await resolveServerRole(env.DB, playerId, verified.email);
  return { ok: true, actor: { sub: verified.sub, playerId, email: verified.email, role } };
}
