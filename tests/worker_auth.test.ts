import { describe, it, expect, beforeAll, beforeEach } from 'bun:test';
import { authenticate, setJwksForTest, verifyGoogleIdToken } from '../src/worker/auth';
import { ADMIN_EMAILS, CREATOR_EMAILS } from '../src/domain/constants/AdminConfig';
import type { Env } from '../src/worker/types';

const CLIENT_ID = 'test-client.apps.googleusercontent.com';

const b64url = (data: ArrayBuffer | string): string => {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const rsaParams = {
  name: 'RSASSA-PKCS1-v1_5',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
} as const;

let goodKey: CryptoKeyPair;
let otherKey: CryptoKeyPair;

async function sign(
  priv: CryptoKey,
  claims: Record<string, unknown>,
  kid = 'k1'
): Promise<string> {
  const head = b64url(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }));
  const body = b64url(JSON.stringify(claims));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', priv, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(sig)}`;
}

const baseClaims = (over: Record<string, unknown> = {}) => ({
  iss: 'https://accounts.google.com',
  aud: CLIENT_ID,
  sub: '12345',
  email: 'someone@example.com',
  email_verified: true,
  exp: Math.floor(Date.now() / 1000) + 3600,
  ...over,
});

/** D1 จำลองขั้นต่ำ: คืน role จากตาราง overrides ตาม identifier */
function mockEnv(overrides: Record<string, string> = {}): Env {
  const db = {
    prepare: () => ({
      bind: (id: string) => ({
        first: async () => (overrides[id] ? { role: overrides[id] } : null),
      }),
    }),
  };
  return { DB: db as never, ASSETS: {} as never, GOOGLE_CLIENT_ID: CLIENT_ID };
}

const req = (token?: string) =>
  new Request('https://x/api/admin/users', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

beforeAll(async () => {
  goodKey = (await crypto.subtle.generateKey(rsaParams, true, ['sign', 'verify'])) as CryptoKeyPair;
  otherKey = (await crypto.subtle.generateKey(rsaParams, true, ['sign', 'verify'])) as CryptoKeyPair;
});

beforeEach(async () => {
  const jwk = (await crypto.subtle.exportKey('jwk', goodKey.publicKey)) as { n: string; e: string };
  setJwksForTest([{ kid: 'k1', kty: 'RSA', alg: 'RS256', n: jwk.n, e: jwk.e }]);
});

describe('verifyGoogleIdToken', () => {
  it('รับ token ที่ถูกต้อง', async () => {
    const t = await sign(goodKey.privateKey, baseClaims({ email: 'Someone@Example.com' }));
    expect(await verifyGoogleIdToken(t, CLIENT_ID)).toEqual({ sub: '12345', email: 'someone@example.com' });
  });

  it('ปฏิเสธ token หมดอายุ', async () => {
    const t = await sign(goodKey.privateKey, baseClaims({ exp: Math.floor(Date.now() / 1000) - 3600 }));
    expect(await verifyGoogleIdToken(t, CLIENT_ID)).toBeNull();
  });

  it('ปฏิเสธ aud ผิด', async () => {
    const t = await sign(goodKey.privateKey, baseClaims({ aud: 'other-client' }));
    expect(await verifyGoogleIdToken(t, CLIENT_ID)).toBeNull();
  });

  it('ปฏิเสธลายเซ็นผิด', async () => {
    const t = await sign(otherKey.privateKey, baseClaims());
    expect(await verifyGoogleIdToken(t, CLIENT_ID)).toBeNull();
  });

  it('ปฏิเสธ email_verified เป็น false', async () => {
    const t = await sign(goodKey.privateKey, baseClaims({ email_verified: false }));
    expect(await verifyGoogleIdToken(t, CLIENT_ID)).toBeNull();
  });

  it('ปฏิเสธ iss ผิดและ token รูปแบบเพี้ยน', async () => {
    const t = await sign(goodKey.privateKey, baseClaims({ iss: 'https://evil.example' }));
    expect(await verifyGoogleIdToken(t, CLIENT_ID)).toBeNull();
    expect(await verifyGoogleIdToken('abc', CLIENT_ID)).toBeNull();
  });
});

describe('authenticate', () => {
  it('401 เมื่อไม่มี Authorization', async () => {
    const r = await authenticate(req(), mockEnv(), 'admin');
    expect(r).toMatchObject({ ok: false, status: 401 });
  });

  it('401 เมื่อ token ไม่ถูกต้อง', async () => {
    const t = await sign(otherKey.privateKey, baseClaims());
    expect(await authenticate(req(t), mockEnv(), 'admin')).toMatchObject({ ok: false, status: 401 });
  });

  it('403 เมื่อเป็น player ธรรมดา', async () => {
    const t = await sign(goodKey.privateKey, baseClaims());
    expect(await authenticate(req(t), mockEnv(), 'admin')).toMatchObject({ ok: false, status: 403 });
  });

  it('ผ่านเมื่อ override เป็น admin แต่ 403 เมื่อต้องการ creator', async () => {
    const t = await sign(goodKey.privateKey, baseClaims());
    const env = mockEnv({ google_12345: 'admin' });
    const ok = await authenticate(req(t), env, 'admin');
    expect(ok).toMatchObject({ ok: true, actor: { role: 'admin', playerId: 'google_12345' } });
    expect(await authenticate(req(t), env, 'creator')).toMatchObject({ ok: false, status: 403 });
  });

  it('role จากรายชื่ออีเมลใน AdminConfig', async () => {
    const email = CREATOR_EMAILS[0] ?? ADMIN_EMAILS[0];
    const t = await sign(goodKey.privateKey, baseClaims({ email }));
    const r = await authenticate(req(t), mockEnv(), 'admin');
    expect(r.ok).toBe(true);
  });

  it('override เป็น player ลดสิทธิ์ได้แม้อีเมลอยู่ในรายชื่อ', async () => {
    const email = ADMIN_EMAILS[0] ?? CREATOR_EMAILS[0];
    const t = await sign(goodKey.privateKey, baseClaims({ email }));
    const r = await authenticate(req(t), mockEnv({ google_12345: 'player' }), 'admin');
    expect(r).toMatchObject({ ok: false, status: 403 });
  });

  it('503 เมื่อยังไม่ตั้ง GOOGLE_CLIENT_ID', async () => {
    const env = { ...mockEnv(), GOOGLE_CLIENT_ID: '' };
    expect(await authenticate(req('x.y.z'), env, 'admin')).toMatchObject({ ok: false, status: 503 });
  });
});
