/**
 * การตังคาผ้ดู้แล้ระบบ (System Administrator)
 * หลังจาก Login ด้วย Google ระบบจะตรวจสอบ Email ตา่กั้บรายชื่อด้านล่าง
 * ถ้ามัดพ้องกััน ผู้ใช้จะได้รบัสิทธผ์ีู้ดู้แล้ระบบ (Admin)
 *
 * หมายเหตุ: รายชื่่อ Admin นี้อยู่ในโค้ดฝั่่ง Client (Public) อย่่างเจตนา
 * เพื่อกำหนดสิทธผ์ีู้ดู้แล้ระบบของแอปชิปจำลอง (ไมม่ีเงิินจรงิ)
 */

// รายชื่่อผ้ดู้แล้ระบบหลัก (Hardcoded)
const DEFAULT_ADMIN_EMAILS = ['seree999@gmail.com'];

// ผู้สร้า้ง (Creator) — เหนือกว่า Admin ทุกประการ (เจ้าของเกม)
const DEFAULT_CREATOR_EMAILS = ['songpon.official@gmail.com'];

// รองรบัการเพิ่่มผ้ดู้แล้ระบบเพิ่่มเติ่มนผ่าน .env
// วิธีใช้: VITE_ADMIN_EMAILS="a@gmail.com,b@gmail.com"
const ENV_ADMIN_EMAILS: string[] = (
  (typeof import.meta !== 'undefined' &&
    (import.meta.env as Record<string, string | undefined>)?.VITE_ADMIN_EMAILS) ||
  ''
)
  .split(',')
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);

// ผู้สร้าง (Creator) — เหนือกว่า Admin
const ENV_CREATOR_EMAILS: string[] = (
  (typeof import.meta !== 'undefined' &&
    (import.meta.env as Record<string, string | undefined>)?.VITE_CREATOR_EMAILS) ||
  ''
)
  .split(',')
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);

// รวมรายชื่่อทัง้หมด (ขจัดซ้ำ)
export const ADMIN_EMAILS: string[] = Array.from(
  new Set([...DEFAULT_ADMIN_EMAILS, ...ENV_ADMIN_EMAILS])
);

// รายชื่่อผู้สร้าง (ผู้เป็นเจ้าของเกม — เหนือกว่า admin)
export const CREATOR_EMAILS: string[] = Array.from(
  new Set([...DEFAULT_CREATOR_EMAILS, ...ENV_CREATOR_EMAILS])
);

/** ทำให้ email เป็นมาตรฐาน (trim + lowercase) */
function normalizeEmail(email?: string | null): string {
  return (email ?? '').trim().toLowerCase();
}

/**
 * หา role สูงสุดของ email ตามลำดับชั้น: creator > admin > player
 */
export function resolveRole(email?: string | null): 'creator' | 'admin' | 'player' {
  const normalized = normalizeEmail(email);
  if (!normalized) return 'player';
  if (CREATOR_EMAILS.includes(normalized)) return 'creator';
  if (ADMIN_EMAILS.includes(normalized)) return 'admin';
  return 'player';
}

/**
 * ตรวจสอบว่่า Email นีเป็็นผ้ดู้แล้ระบบหรืือไม่ (รวม Creator ด้วย)
 * (Case-insensitive, ตัดช่องว่างทัง้ 2 ฝั่่ง)
 */
export function isAdminEmail(email?: string | null): boolean {
  const normalized = normalizeEmail(email);
  return ADMIN_EMAILS.includes(normalized) || CREATOR_EMAILS.includes(normalized);
}

/**
 * ตรวจสอบว่าบุคคลนี้เป็นผู้สร้าง (Creator — เหนือกว่า admin) หรือไม่
 */
export function isCreatorEmail(email?: string | null): boolean {
  return CREATOR_EMAILS.includes(normalizeEmail(email));
}

/**
 * role ที่กำหนดมีสิทธิ์ระดับ admin หรือไม่ (admin และ creator ผ่านหมด)
 */
export function hasAdminAccess(role?: string | null): boolean {
  return role === 'admin' || role === 'creator';
}
