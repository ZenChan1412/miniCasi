/**
 * การตั้งค่าผู้ดูแลระบบ (System Administrator & Creator)
 * สิทธิ์ Admin++ (Creator) = ผู้สร้างระบบ มีอำนาจสูงสุด จัดการผู้ใช้ทั้งหมด
 * สิทธิ์ Admin = ผู้ดูแลระบบ จัดการยอดชิป และล้างคูลดาวน์ได้
 */

// รายชื่อผู้ดูแลระบบหลัก (Hardcoded)
const DEFAULT_ADMIN_EMAILS = ['seree999@gmail.com'];

// ผู้สร้าง (Creator / Admin++) — เหนือกว่า Admin ทุกประการ (เจ้าของเกม)
const DEFAULT_CREATOR_EMAILS = ['songpon.official@gmail.com'];

// รองรับการเพิ่มผู้ดูแลระบบเพิ่มเติมผ่าน .env
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

// รวมรายชื่อทั้งหมด (ขจัดซ้ำ)
export const ADMIN_EMAILS: string[] = Array.from(
  new Set([...DEFAULT_ADMIN_EMAILS, ...ENV_ADMIN_EMAILS])
);

// รายชื่อผู้สร้าง (Admin++ ผู้เป็นเจ้าของเกม)
export const CREATOR_EMAILS: string[] = Array.from(
  new Set([...DEFAULT_CREATOR_EMAILS, ...ENV_CREATOR_EMAILS])
);

/** ทำให้ email เป็นมาตรฐาน (trim + lowercase) */
export function normalizeEmail(email?: string | null): string {
  return (email ?? '').trim().toLowerCase();
}

/** ดึงรายชื่อ Admin ที่ถูกเพิ่มผ่าน Dashboard แบบไดนามิก */
export function getDynamicAdminEmails(): string[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem('high_low_dynamic_admin_emails');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** เพิ่ม Admin ไดนามิก (เฉพาะ Creator สั่งได้) */
export function addDynamicAdminEmail(email: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const current = getDynamicAdminEmails();
  const normalized = normalizeEmail(email);
  if (normalized && !current.includes(normalized)) {
    current.push(normalized);
    window.localStorage.setItem('high_low_dynamic_admin_emails', JSON.stringify(current));
  }
}

/** ลบ Admin ไดนามิก */
export function removeDynamicAdminEmail(email: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const current = getDynamicAdminEmails();
  const normalized = normalizeEmail(email);
  const updated = current.filter((e) => e !== normalized);
  window.localStorage.setItem('high_low_dynamic_admin_emails', JSON.stringify(updated));
}

/**
 * หา role สูงสุดของ email ตามลำดับชั้น: creator (Admin++) > admin > player
 */
export function resolveRole(email?: string | null): 'creator' | 'admin' | 'player' {
  const normalized = normalizeEmail(email);
  if (!normalized) return 'player';
  if (CREATOR_EMAILS.includes(normalized)) return 'creator';
  if (ADMIN_EMAILS.includes(normalized) || getDynamicAdminEmails().includes(normalized)) return 'admin';
  return 'player';
}

/**
 * ตรวจสอบว่าเป็นผู้ดูแลระบบหรือไม่ (รวม Creator ด้วย)
 */
export function isAdminEmail(email?: string | null): boolean {
  const normalized = normalizeEmail(email);
  return (
    ADMIN_EMAILS.includes(normalized) ||
    CREATOR_EMAILS.includes(normalized) ||
    getDynamicAdminEmails().includes(normalized)
  );
}

/**
 * ตรวจสอบว่าบุคคลนี้เป็นผู้สร้าง (Creator / Admin++) หรือไม่
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

/**
 * role ที่กำหนดเป็นระดับ Creator (Admin++) หรือไม่
 */
export function isCreatorAccess(role?: string | null): boolean {
  return role === 'creator';
}
