import { describe, it, expect, afterEach } from 'bun:test';
import {
  checkPromptPayCharge,
  createPromptPayCharge,
  readPaymentConfig,
  toPublicConfig,
} from '../src/worker/payment';
import type { Env } from '../src/worker/types';

/** สร้าง Env ปลอมสำหรับเทสต์ (ไม่แตะ D1/Assets จริง) */
function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as Env['DB'],
    ASSETS: {} as Env['ASSETS'],
    ...overrides,
  };
}

const originalFetch = globalThis.fetch;

function mockFetch(impl: () => Promise<Response> | Response): void {
  globalThis.fetch = (async () => impl()) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('Payment: การอ่านค่าตั้งต้น', () => {
  it('ใช้ค่าเริ่มต้นเมื่อ env ว่าง', () => {
    const config = readPaymentConfig(makeEnv());
    expect(config.apiKey).toBe('');
    expect(config.baseUrl).toBe('https://api.inwcloud.shop');
    expect(config.chipsPerThb).toBe(10);
    expect(config.minTopupThb).toBe(20);
    expect(config.maxTopupThb).toBe(5000);
  });

  it('อ่านค่าที่กำหนดเองและตัดเครื่องหมาย /  trailing ออก', () => {
    const config = readPaymentConfig(
      makeEnv({
        INWCLOUD_API_KEY: '  secret-key  ',
        INWCLOUD_BASE_URL: 'https://api.inwcloud.shop///',
        CHIPS_PER_THB: '25',
        MIN_TOPUP_THB: '50',
        MAX_TOPUP_THB: '1000',
      })
    );
    expect(config.apiKey).toBe('secret-key');
    expect(config.baseUrl).toBe('https://api.inwcloud.shop');
    expect(config.chipsPerThb).toBe(25);
    expect(config.minTopupThb).toBe(50);
    expect(config.maxTopupThb).toBe(1000);
  });

  it('toPublicConfig ไม่รั่วคีย์ API และบอกสถานะเปิด/ปิดใช้งาน', () => {
    const disabled = toPublicConfig(readPaymentConfig(makeEnv()));
    expect(disabled.enabled).toBe(false);
    expect(JSON.stringify(disabled)).not.toContain('apiKey');

    const enabled = toPublicConfig(readPaymentConfig(makeEnv({ INWCLOUD_API_KEY: 'k' })));
    expect(enabled.enabled).toBe(true);
  });
});

describe('Payment: สร้าง QR พร้อมเพย์', () => {
  it('คืนข้อผิดพลาด 503 เมื่อยังไม่ได้ตั้งค่า API Key (ไม่ยิงเน็ต)', async () => {
    let called = false;
    mockFetch(() => {
      called = true;
      return new Response('{}');
    });

    const result = await createPromptPayCharge(makeEnv(), 100);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
      expect(result.error).toContain('INWCLOUD_API_KEY');
    }
    expect(called).toBe(false);
  });

  it('แยกข้อมูลจาก response สำเร็จ และแปลง expires_at จากวินาทีเป็นมิลลิวินาที', async () => {
    mockFetch(
      () =>
        new Response(
          JSON.stringify({
            status: 'success',
            data: {
              transactionId: 'Market-1-abc',
              qr_url: 'https://api.qrserver.com/v1/create-qr-code/?data=x',
              payload: '00020101021234',
              amount: '10.98',
              expires_at: 1764246956,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
    );

    const result = await createPromptPayCharge(makeEnv({ INWCLOUD_API_KEY: 'k' }), 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.transactionId).toBe('Market-1-abc');
      expect(result.data.payload).toBe('00020101021234');
      expect(result.data.amountThb).toBeCloseTo(10.98);
      expect(result.data.expiresAt).toBe(1764246956000);
      expect(result.data.qrUrl).toContain('qrserver.com');
    }
  });

  it('ส่ง error message จาก Gateway กลับเมื่อ HTTP ไม่ใช่ 2xx', async () => {
    mockFetch(
      () =>
        new Response(JSON.stringify({ status: 'error', message: 'amount ไม่ถูกต้อง' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
    );

    const result = await createPromptPayCharge(makeEnv({ INWCLOUD_API_KEY: 'k' }), 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toBe('amount ไม่ถูกต้อง');
    }
  });

  it('คืนข้อผิดพลาดเมื่อ response สำเร็จแต่ขาด payload', async () => {
    mockFetch(
      () =>
        new Response(JSON.stringify({ status: 'success', data: { transactionId: 'x' } }), {
          status: 200,
        })
    );

    const result = await createPromptPayCharge(makeEnv({ INWCLOUD_API_KEY: 'k' }), 10);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(502);
    }
  });
});

describe('Payment: ตรวจสอบการชำระเงิน', () => {
  it('ถือว่าชำระแล้วเมื่อ status = success', async () => {
    mockFetch(
      () =>
        new Response(
          JSON.stringify({ status: 'success', message: 'ชำระเงินสำเร็จ', amount: '10.95' }),
          { status: 200 }
        )
    );

    const result = await checkPromptPayCharge(makeEnv({ INWCLOUD_API_KEY: 'k' }), 'txn-1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.paid).toBe(true);
      expect(result.data.amountThb).toBeCloseTo(10.95);
    }
  });

  it('ถือว่ายังไม่ชำระเมื่อ status = pending', async () => {
    mockFetch(() => new Response(JSON.stringify({ status: 'pending' }), { status: 200 }));

    const result = await checkPromptPayCharge(makeEnv({ INWCLOUD_API_KEY: 'k' }), 'txn-2');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.paid).toBe(false);
    }
  });

  it('คืนข้อผิดพลาด 503 เมื่อยังไม่ได้ตั้งค่า API Key', async () => {
    const result = await checkPromptPayCharge(makeEnv(), 'txn-3');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
    }
  });
});
