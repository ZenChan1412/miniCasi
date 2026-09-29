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
});
