/**
 * ชนิดข้อมูลขั้นต่ำของ Cloudflare D1 และ Static Assets binding
 * ประกาศเองเพื่อไม่ต้องดึง @cloudflare/workers-types เข้ามาชนกับ lib DOM ของฝั่ง React
 */

export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta: {
    duration?: number;
    changes?: number;
    last_row_id?: number;
    rows_read?: number;
    rows_written?: number;
  };
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
  exec(query: string): Promise<{ count: number; duration: number }>;
}

export interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

export interface Env {
  DB: D1Database;
  ASSETS: AssetsBinding;
  /** AI หลัก (OpenAI-compatible) — ตั้งใน Cloudflare Dashboard; base URL ลงท้าย /v1 */
  AI_BASE_URL?: string;
  AI_API_KEY?: string;
  AI_MODEL?: string;
  /** Gemini = fallback; ตั้งใน .env / .dev.vars (local) หรือ `wrangler secret put` (production) */
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;

  /* ---- Payment Gateway (inwcloud.shop) หมวด PromptPay ---- */
  /** คีย์ลับของ Payment Gateway — ตั้งใน wrangler.jsonc (vars) หรือ `wrangler secret put INWCLOUD_API_KEY` */
  INWCLOUD_API_KEY?: string;
  /** ฐาน URL ของ Gateway (ค่าเริ่มต้น https://api.inwcloud.shop) */
  INWCLOUD_BASE_URL?: string;
  /** อัตราแลกชิป: กี่ชิปต่อ 1 บาท (ค่าเริ่มต้น 10) */
  CHIPS_PER_THB?: string;
  /** ยอดเติมขั้นต่ำหน่วยบาท (ค่าเริ่มต้น 20) */
  MIN_TOPUP_THB?: string;
  /** ยอดเติมสูงสุดหน่วยบาท (ค่าเริ่มต้น 5000) */
  MAX_TOPUP_THB?: string;
}
