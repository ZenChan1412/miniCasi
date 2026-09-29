import { describe, it, expect, beforeEach } from 'bun:test';
import { AdminService } from '../src/application/services/AdminService';
import { UserProfile } from '../src/domain/entities/User';
import { addDynamicAdminEmail, getDynamicAdminEmails, removeDynamicAdminEmail } from '../src/domain/constants/AdminConfig';

// Setup Mock In-Memory Storage for Bun CLI
const memoryStore = new Map<string, string>();
const mockStorage = {
  getItem: (key: string) => memoryStore.get(key) ?? null,
  setItem: (key: string, val: string) => memoryStore.set(key, String(val)),
  removeItem: (key: string) => memoryStore.delete(key),
  clear: () => memoryStore.clear(),
  key: (i: number) => Array.from(memoryStore.keys())[i] ?? null,
  get length() {
    return memoryStore.size;
  },
};

if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = { localStorage: mockStorage };
} else if (!(globalThis as any).window.localStorage) {
  (globalThis as any).window.localStorage = mockStorage;
}
(globalThis as any).localStorage = mockStorage;

describe('AdminService & User Management System (Admin++)', () => {
  let adminService: AdminService;
  const creatorActor: UserProfile = {
    id: 'google_creator_songpon',
    name: 'Songpon Creator',
    email: 'songpon.official@gmail.com',
    role: 'creator',
    provider: 'google',
    loggedInAt: Date.now(),
  };

  beforeEach(() => {
    memoryStore.clear();
    adminService = new AdminService();
  });

  it('ควรบันทึกผู้ใช้ลงในระบบและค้นหาเจอใน getAllUsers()', async () => {
    const testUser: UserProfile = {
      id: 'google_player_101',
      name: 'Player One',
      email: 'player1@gmail.com',
      provider: 'google',
      role: 'player',
      loggedInAt: Date.now(),
    };

    adminService.registerUser(testUser);
    const users = await adminService.getAllUsers();
    const found = users.find((u) => u.id === testUser.id);

    expect(found).toBeDefined();
    expect(found?.name).toBe('Player One');
    expect(found?.email).toBe('player1@gmail.com');
  });

  it('ควรเพิ่มชิปให้ผู้เล่นและบันทึกประวัติลงใน Audit Logs', async () => {
    const targetUserId = 'target_user_555';
    await adminService.grantChips(targetUserId, 5000, creatorActor);

    const users = await adminService.getAllUsers();
    const user = users.find((u) => u.id === targetUserId);
    expect(user?.balance).toBe(6000); // 1,000 default + 5,000

    const logs = adminService.getAuditLogs();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].action).toBe('CHIP_GRANT');
    expect(logs[0].amount).toBe(5000);
  });

  it('Admin++ ควรระงับสิทธิ์ (Ban) และปลดการระงับ (Unban) ผู้ใช้ได้', async () => {
    const targetId = 'bad_actor_999';
    expect(adminService.isUserBanned(targetId)).toBe(false);

    // Ban
    await adminService.banUser(targetId, 'พบบอทปั๊มชิป', creatorActor);
    expect(adminService.isUserBanned(targetId)).toBe(true);

    const logsAfterBan = adminService.getAuditLogs();
    expect(logsAfterBan[0].action).toBe('USER_BAN');

    // Unban
    await adminService.unbanUser(targetId, creatorActor);
    expect(adminService.isUserBanned(targetId)).toBe(false);

    const logsAfterUnban = adminService.getAuditLogs();
    expect(logsAfterUnban[0].action).toBe('USER_UNBAN');
  });

  it('ควรคำนวณ System Metrics ภาพรวมได้อย่างถูกต้อง', async () => {
    await adminService.grantChips('player_a', 2000, creatorActor);
    await adminService.banUser('player_b', 'Spam', creatorActor);

    const metrics = await adminService.getSystemMetrics();
    expect(metrics.totalUsers).toBeGreaterThanOrEqual(2);
    expect(metrics.circulatingChips).toBeGreaterThan(0);
    expect(metrics.totalBanned).toBe(1);
  });

  it('ควรแต่งตั้งและถอดสิทธิ์ Admin ไดนามิกได้อย่างถูกต้อง', () => {
    const testAdmin = 'newadmin@gmail.com';
    addDynamicAdminEmail(testAdmin);
    expect(getDynamicAdminEmails()).toContain(testAdmin);

    removeDynamicAdminEmail(testAdmin);
    expect(getDynamicAdminEmails()).not.toContain(testAdmin);
  });

  it('ควรระบุสิทธิ์ของ currentUser ได้อย่างถูกต้องใน getAllUsers แม้มีเฉพาะ wallet key ใน storage', async () => {
    // จำลองกรณีที่ผู้ใช้ล็อกอินด้วย Google OAuth ID จริง
    const realCreatorUser: UserProfile = {
      id: 'google_111352458428135836838',
      name: 'Songpon Real',
      email: 'songpon.official@gmail.com',
      provider: 'google',
      role: 'creator',
      loggedInAt: Date.now(),
    };

    // เติมชิปผ่านระบบจริง เพื่อให้มี checksum ถูกต้อง
    await adminService.grantChips(realCreatorUser.id, 4000, creatorActor);

    const users = await adminService.getAllUsers(realCreatorUser);
    const found = users.find((u) => u.id === realCreatorUser.id);

    expect(found).toBeDefined();
    expect(found?.email).toBe('songpon.official@gmail.com');
    expect(found?.role).toBe('creator'); // ต้องไม่เป็น 'player'
    expect(found?.balance).toBe(5000);
  });

  it('ควรเปลี่ยนระดับสิทธิ์ของผู้ใช้ผ่าน changeUserRole ได้สำเร็จ', async () => {
    const targetUserId = 'target_player_1';
    const targetEmail = 'target@gmail.com';

    await adminService.changeUserRole(targetUserId, targetEmail, 'admin', creatorActor);

    const users = await adminService.getAllUsers();
    const target = users.find((u) => u.id === targetUserId || u.email === targetEmail);
    expect(target?.role).toBe('admin');
  });

  it('ควรระบุและอัปเดตสิทธิ์ของ google_admin_seree ได้ถูกต้องและไม่หลุดเป็น player แม้ไม่มี email', async () => {
    // ตรวจสอบว่าเริ่มต้นต้องเป็น admin
    let users = await adminService.getAllUsers();
    let seree = users.find((u) => u.id === 'google_admin_seree');
    expect(seree).toBeDefined();
    expect(seree?.role).toBe('admin');

    // ปรับสิทธิ์เป็น creator
    await adminService.changeUserRole('google_admin_seree', undefined, 'creator', creatorActor);
    users = await adminService.getAllUsers();
    seree = users.find((u) => u.id === 'google_admin_seree');
    expect(seree?.role).toBe('creator');

    // ปรับกลับเป็น admin
    await adminService.changeUserRole('google_admin_seree', undefined, 'admin', creatorActor);
    users = await adminService.getAllUsers();
    seree = users.find((u) => u.id === 'google_admin_seree');
    expect(seree?.role).toBe('admin');
  });
});


