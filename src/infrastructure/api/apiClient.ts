/**
 * ตัวเรียก HTTP ไปยัง Worker API ที่ผูกกับ Cloudflare D1
 *
 * ฝั่งเบราว์เซอร์ต่อ D1 ตรงๆ ไม่ได้ ทุกการอ่าน/เขียนจึงผ่าน /api/* ของ Worker
 * เวลารัน `vite dev` เพียวๆ จะไม่มี Worker อยู่ ไฟล์นี้จึงตรวจสุขภาพ API ไว้
 * ให้ชั้นบนเลือกสำรองไปใช้ LocalStorage ได้อย่างชัดเจน
 */

export interface TableHealth {
  name: string;
  exists: boolean;
  rows: number;
}

export interface HealthReport {
  ok: boolean;
  database: string;
  latencyMs: number;
  checkedAt: number;
  tables: TableHealth[];
  error?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const API_BASE = '/api';

/** ฟังก์ชันคืน Google idToken ของผู้ใช้ปัจจุบัน (ลงทะเบียนโดย GoogleAuthService) */
let authTokenProvider: (() => string | null | undefined) | null = null;

export function setAuthTokenProvider(fn: (() => string | null | undefined) | null): void {
  authTokenProvider = fn;
}
const REQUEST_TIMEOUT_MS = 8000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(authTokenProvider?.() ? { Authorization: `Bearer ${authTokenProvider()}` } : {}),
        ...(init?.headers ?? {}),
      },
    });

    const text = await res.text();
    const body = text ? JSON.parse(text) : null;

    if (!res.ok) {
      const message =
        body && typeof body.error === 'string' ? body.error : `คำขอล้มเหลว (HTTP ${res.status})`;
      throw new ApiError(message, res.status);
    }

    return body as T;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
};

/**
 * ตรวจการเชื่อมต่อฐานข้อมูล D1 ผ่าน Worker
 * คืนรายงานเสมอ ไม่ throw เพื่อให้หน้า UI แสดงสาเหตุที่ต่อไม่ได้ได้
 */
export async function fetchDbHealth(): Promise<HealthReport> {
  const startedAt = Date.now();

  try {
    // /api/health ตอบ 503 เมื่อตารางไม่ครบ จึงอ่าน body เองแทนการพึ่ง res.ok
    const res = await fetch(`${API_BASE}/health`, { headers: { Accept: 'application/json' } });
    const body = (await res.json()) as HealthReport;
    return body;
  } catch (err) {
    return {
      ok: false,
      database: 'mini-casino-db',
      latencyMs: Date.now() - startedAt,
      checkedAt: Date.now(),
      tables: [],
      error:
        err instanceof Error
          ? `ติดต่อ Worker API ไม่ได้: ${err.message}`
          : 'ติดต่อ Worker API ไม่ได้',
    };
  }
}
