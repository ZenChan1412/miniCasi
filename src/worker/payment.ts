import { Env } from './types';

/**
 * ตัวเชื่อม Payment Gateway ของ inwcloud.shop (หมวด PromptPay)
 * เอกสาร: https://inwcloud.shop/payment-gateway/api-docs
 *
 * คีย์ API อ่านจาก env ฝั่ง Worker เท่านั้น (INWCLOUD_API_KEY) เบราว์เซอร์ไม่เคยเห็นคีย์นี้
 * ฝั่ง client เรียกผ่าน /api/payment/* ของเราต่อ เพื่อไม่ให้ความลับรั่วไปถึงผู้เล่น
 *
 * ตั้งค่าใน wrangler.jsonc (vars) หรือ `wrangler secret put INWCLOUD_API_KEY` (production)
 */

const DEFAULT_BASE_URL = 'https://api.inwcloud.shop';
const DEFAULT_CHIPS_PER_THB = 10;
const DEFAULT_MIN_TOPUP_THB = 20;
const DEFAULT_MAX_TOPUP_THB = 5000;
const REQUEST_TIMEOUT_MS = 15000;

export interface PaymentConfig {
  apiKey: string;
  baseUrl: string;
  chipsPerThb: number;
  minTopupThb: number;
  maxTopupThb: number;
}

/** ข้อมูลที่ส่งให้เบราว์เซอร์ได้ — ไม่มีคีย์ API */
export interface PublicPaymentConfig {
  enabled: boolean;
  chipsPerThb: number;
  minTopupThb: number;
  maxTopupThb: number;
}

export interface PromptPayCharge {
  transactionId: string;
  qrUrl: string;
  payload: string;
  amountThb: number;
  /** เวลาหมดอายุเป็น Unix timestamp หน่วยมิลลิวินาที (แปลงจากหน่วยวินาทีของ Gateway แล้ว) */
  expiresAt: number;
}

export interface PromptPayCheck {
  paid: boolean;
  amountThb?: number;
  message?: string;
}

export type PaymentResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

function positiveNumber(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function readPaymentConfig(env: Env): PaymentConfig {
  const baseUrl = (env.INWCLOUD_BASE_URL ?? DEFAULT_BASE_URL).trim().replace(/\/+$/, '');
  return {
    apiKey: (env.INWCLOUD_API_KEY ?? '').trim(),
    baseUrl: baseUrl || DEFAULT_BASE_URL,
    chipsPerThb: positiveNumber(env.CHIPS_PER_THB, DEFAULT_CHIPS_PER_THB),
    minTopupThb: positiveNumber(env.MIN_TOPUP_THB, DEFAULT_MIN_TOPUP_THB),
    maxTopupThb: positiveNumber(env.MAX_TOPUP_THB, DEFAULT_MAX_TOPUP_THB),
  };
}

export function toPublicConfig(config: PaymentConfig): PublicPaymentConfig {
  return {
    enabled: config.apiKey.length > 0,
    chipsPerThb: config.chipsPerThb,
    minTopupThb: config.minTopupThb,
    maxTopupThb: config.maxTopupThb,
  };
}

/* ------------------------------------------------------------------ */
/* Gateway calls                                                       */
/* ------------------------------------------------------------------ */

type GatewayResponse =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; status: number; error: string };

async function gatewayFetch(
  url: string,
  apiKey: string,
  payload: Record<string, unknown>
): Promise<GatewayResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const text = await response.text();
    let body: Record<string, unknown> = {};
    try {
      body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      body = {};
    }

    if (!response.ok) {
      const message =
        pickString(body.message) ??
        pickString(body.error) ??
        `Payment Gateway ตอบกลับผิดพลาด (HTTP ${response.status})`;
      const status = response.status >= 400 && response.status < 600 ? response.status : 502;
      return { ok: false, status, error: message };
    }

    return { ok: true, body };
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return {
      ok: false,
      status: 504,
      error: aborted
        ? 'Payment Gateway ตอบกลับช้าเกินไป กรุณาลองใหม่'
        : 'เชื่อมต่อ Payment Gateway ไม่ได้ กรุณาลองใหม่',
    };
  } finally {
    clearTimeout(timer);
  }
}

/** สร้าง QR พร้อมเพย์แบบระบุจำนวนเงิน: POST /v1/promptpay/generate */
export async function createPromptPayCharge(
  env: Env,
  amountThb: number
): Promise<PaymentResult<PromptPayCharge>> {
  const config = readPaymentConfig(env);
  if (!config.apiKey) {
    return {
      ok: false,
      status: 503,
      error: 'ระบบเติมชิปด้วยเงินจริงยังไม่เปิดใช้งาน (ยังไม่ได้ตั้งค่า INWCLOUD_API_KEY)',
    };
  }

  const response = await gatewayFetch(`${config.baseUrl}/v1/promptpay/generate`, config.apiKey, {
    amount: amountThb,
  });
  if (!response.ok) return response;

  const body = response.body;
  if (pickString(body.status)?.toLowerCase() === 'error') {
    return {
      ok: false,
      status: 502,
      error: pickString(body.message) ?? 'Payment Gateway ปฏิเสธคำขอสร้าง QR',
    };
  }

  const data = isRecord(body.data) ? body.data : body;
  const transactionId = pickString(data.transactionId) ?? pickString(body.transactionId);
  const payload = pickString(data.payload);

  if (!transactionId || !payload) {
    return {
      ok: false,
      status: 502,
      error: 'Payment Gateway ตอบกลับไม่ครบถ้วน (ไม่พบ transactionId หรือ payload)',
    };
  }

  const requestAmount = Number(data.amount);

  return {
    ok: true,
    data: {
      transactionId,
      qrUrl: pickString(data.qr_url) ?? pickString(data.qrUrl) ?? '',
      payload,
      amountThb: Number.isFinite(requestAmount) && requestAmount > 0 ? requestAmount : amountThb,
      expiresAt: toMillis(data.expires_at ?? data.expiresAt),
    },
  };
}

/** ตรวจสอบการชำระเงิน: POST /v1/promptpay/check */
export async function checkPromptPayCharge(
  env: Env,
  transactionId: string
): Promise<PaymentResult<PromptPayCheck>> {
  const config = readPaymentConfig(env);
  if (!config.apiKey) {
    return {
      ok: false,
      status: 503,
      error: 'ระบบเติมชิปด้วยเงินจริงยังไม่เปิดใช้งาน (ยังไม่ได้ตั้งค่า INWCLOUD_API_KEY)',
    };
  }

  const response = await gatewayFetch(`${config.baseUrl}/v1/promptpay/check`, config.apiKey, {
    transactionId,
  });
  if (!response.ok) return response;

  const body = response.body;
  const data = isRecord(body.data) ? body.data : {};
  const status = pickString(body.status)?.toLowerCase() ?? '';
  const paidFlag =
    typeof body.paid === 'boolean'
      ? body.paid
      : typeof data.paid === 'boolean'
        ? (data.paid as boolean)
        : undefined;

  // Gateway ตอบ "success" เมื่อชำระสำเร็จ ส่วนสถานะรอชำระมักเป็น "pending"
  const paid = paidFlag === true || status === 'success' || status === 'paid';

  return {
    ok: true,
    data: {
      paid,
      amountThb: numericOrUndefined(body.amount ?? data.amount),
      message: pickString(body.message),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function numericOrUndefined(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Gateway ส่ง expires_at เป็นวินาที (เช่น 1764246956) — แปลงเป็นมิลลิวินาทีให้ฝั่ง UI ใช้ง่าย */
function toMillis(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed < 1_000_000_000_000 ? Math.round(parsed * 1000) : Math.round(parsed);
}
