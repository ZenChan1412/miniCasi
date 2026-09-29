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

// รวมรายชื่่อทัง้หมด (ขจัดซ้ำ)
export const ADMIN_EMAILS: string[] = Array.from(
  new Set([...DEFAULT_ADMIN_EMAILS, ...ENV_ADMIN_EMAILS])
);

/**
 * ตรวจสอบว่่า Email นีเป็็นผ้ดู้แล้ระบบหรืือไม่
 * (Case-insensitive, ตัดช่องว่างทัง้ 2 ฝั่่ง)
 */
export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
