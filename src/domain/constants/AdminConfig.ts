/**
 * การตั้งค่าผู้ดูแลระบบ (System Administrator & Creator)
 * สิทธิ์ Admin++ (Creator) = ผู้สร้างระบบ มีอำนาจสูงสุด จัดการผู้ใช้ทั้งหมด
 * สิทธิ์ Admin = ผู้ดูแลระบบ จัดการยอดชิป และล้างคูลดาวน์ได้
 */

// รายชื่อผู้ดูแลระบบหลัก (Hardcoded)
const DEFAULT_ADMIN_EMAILS = ['seree999@gmail.com', 'seree@gmail.com'];

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

/** ดึงรายชื่อ Creator ที่ถูกเพิ่มผ่าน Dashboard แบบไดนามิก */
export function getDynamicCreatorEmails(): string[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem('high_low_dynamic_creator_emails');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** เพิ่ม Creator ไดนามิก */
export function addDynamicCreatorEmail(email: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const current = getDynamicCreatorEmails();
  const normalized = normalizeEmail(email);
  if (normalized && !current.includes(normalized)) {
    current.push(normalized);
    window.localStorage.setItem('high_low_dynamic_creator_emails', JSON.stringify(current));
  }
}

/** ลบ Creator ไดนามิก */
export function removeDynamicCreatorEmail(email: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const current = getDynamicCreatorEmails();
  const normalized = normalizeEmail(email);
  const updated = current.filter((e) => e !== normalized);
  window.localStorage.setItem('high_low_dynamic_creator_emails', JSON.stringify(updated));
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

const ROLE_OVERRIDES_KEY = 'high_low_user_role_overrides_v1';

export function getAllRoleOverrides(): Record<string, 'creator' | 'admin' | 'player'> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(ROLE_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getUserRoleOverride(identifier?: string | null): 'creator' | 'admin' | 'player' | null {
  if (!identifier) return null;
  const key = identifier.trim().toLowerCase();
  const overrides = getAllRoleOverrides();
  return overrides[key] || null;
}

/** กำหนดสิทธิ์ของผู้ใช้แบบเจาะจง ทั้งอีเมลหรือ User ID (Creator / Admin / Player) */
export function setUserRoleOverride(identifier: string, role: 'creator' | 'admin' | 'player'): void {
  const normalized = normalizeEmail(identifier);
  if (!normalized) return;

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const overrides = getAllRoleOverrides();
      overrides[normalized] = role;
      window.localStorage.setItem(ROLE_OVERRIDES_KEY, JSON.stringify(overrides));
    } catch (e) {
      console.error('Failed to save role override:', e);
    }
  }

  if (role === 'creator') {
    addDynamicCreatorEmail(normalized);
    removeDynamicAdminEmail(normalized);
  } else if (role === 'admin') {
    addDynamicAdminEmail(normalized);
    removeDynamicCreatorEmail(normalized);
  } else {
    removeDynamicCreatorEmail(normalized);
    removeDynamicAdminEmail(normalized);
  }
}

/**
 * ตรวจสอบว่าบุคคลนี้เป็นผู้สร้าง (Creator / Admin++) หรือไม่
 */
export function isCreatorEmail(email?: string | null): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return (
    CREATOR_EMAILS.includes(normalized) ||
    getDynamicCreatorEmails().includes(normalized) ||
    normalized === 'songpon.official' ||
    normalized.startsWith('songpon.official@') ||
    normalized.includes('songpon.official') ||
    normalized.includes('songpon')
  );
}

/**
 * หา role สูงสุดของ email ตามลำดับชั้น: creator (Admin++) > admin > player
 * - songpon.official@gmail.com -> creator
 * - seree999@gmail.com / seree@gmail.com -> admin
 */
export function resolveRole(email?: string | null): 'creator' | 'admin' | 'player' {
  const normalized = normalizeEmail(email);
  if (!normalized) return 'player';
  const override = getUserRoleOverride(normalized);
  if (override) return override;
  if (isCreatorEmail(normalized)) return 'creator';
  if (
    ADMIN_EMAILS.includes(normalized) ||
    getDynamicAdminEmails().includes(normalized) ||
    normalized === 'seree' ||
    normalized === 'seree999' ||
    normalized.startsWith('seree999@') ||
    normalized.startsWith('seree@') ||
    normalized.includes('seree')
  ) {
    return 'admin';
  }
  return 'player';
}

/**
 * หา role ของผู้ใช้ โดยพิจารณาจาก:
 * 1. Role Override ที่ตั้งไว้เจาะจง (ผ่าน email หรือ userId)
 * 2. ตรวจสอบเงื่อนไข Creator (Email หรือ ID ที่ระบุว่าเป็น Songpon / Creator)
 * 3. ตรวจสอบเงื่อนไข Admin (Email หรือ ID ที่ระบุว่าเป็น Seree / Admin)
 * 4. Stored role ที่บันทึกไว้ใน User Registry
 * 5. Player
 */
export function resolveUserRole(
  userId?: string | null,
  email?: string | null,
  storedRole?: 'creator' | 'admin' | 'player' | null
): 'creator' | 'admin' | 'player' {
  // 1. ตรวจสอบ Explicit Override ก่อนเสมอ
  if (email) {
    const override = getUserRoleOverride(email);
    if (override) return override;
  }
  if (userId) {
    const override = getUserRoleOverride(userId);
    if (override) return override;
  }

  // 2. Creator checks
  if (isCreatorEmail(email)) return 'creator';
  if (userId) {
    const normId = userId.toLowerCase();
    if (
      normId === 'google_creator_songpon' ||
      normId === 'creator_demo' ||
      normId.includes('creator') ||
      normId.includes('songpon')
    ) {
      return 'creator';
    }
  }

  // 3. Admin checks
  if (isAdminEmail(email)) return 'admin';
  if (userId) {
    const normId = userId.toLowerCase();
    if (
      normId === 'google_admin_seree' ||
      normId === 'admin_demo' ||
      normId.includes('admin') ||
      normId.includes('seree')
    ) {
      return 'admin';
    }
  }

  // 4. Stored role
  if (storedRole && (storedRole === 'creator' || storedRole === 'admin' || storedRole === 'player')) {
    return storedRole;
  }

  // 5. Default by email
  return resolveRole(email);
}

/**
 * ตรวจสอบว่าเป็นผู้ดูแลระบบหรือไม่ (รวม Creator ด้วย)
 */
export function isAdminEmail(email?: string | null): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return (
    isCreatorEmail(normalized) ||
    ADMIN_EMAILS.includes(normalized) ||
    getDynamicAdminEmails().includes(normalized) ||
    normalized === 'seree' ||
    normalized === 'seree999' ||
    normalized.startsWith('seree999@') ||
    normalized.startsWith('seree@') ||
    normalized.includes('seree')
  );
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
