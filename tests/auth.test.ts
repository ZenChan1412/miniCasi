import { describe, it, expect, beforeEach } from 'bun:test';
import { decodeGoogleJwt } from '../src/infrastructure/auth/jwtDecoder';
import { GoogleAuthService } from '../src/infrastructure/auth/GoogleAuthService';
import { LocalStorageWalletRepo } from '../src/infrastructure/storage/LocalStorageWalletRepo';
import { LocalStorageHistoryRepo } from '../src/infrastructure/storage/LocalStorageHistoryRepo';
import { VirtualWallet } from '../src/domain/entities/VirtualWallet';
import { StreakTracker } from '../src/domain/services/StreakTracker';
import { isAdminEmail, ADMIN_EMAILS, isCreatorEmail, CREATOR_EMAILS, resolveRole } from '../src/domain/constants/AdminConfig';
import { ClaimEmergencyBailoutUseCase } from '../src/application/usecases/ClaimEmergencyBailout';
import { ClaimDailyRewardUseCase } from '../src/application/usecases/ClaimDailyReward';

// Setup Mock In-Memory Storage for Bun CLI Environment
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

// Polyfill window & localStorage for headless test runner
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = { localStorage: mockStorage };
} else if (!(globalThis as any).window.localStorage) {
  (globalThis as any).window.localStorage = mockStorage;
}
(globalThis as any).localStorage = mockStorage;

// Helper to create synthetic JWT token for testing
function createTestJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const stringified = JSON.stringify(payload);
  const utf8Bytes = encodeURIComponent(stringified).replace(/%([0-9A-F]{2})/g, (_, p1) =>
    String.fromCharCode(parseInt(p1, 16))
  );
  const body = btoa(utf8Bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const signature = 'synthetic_signature';
  return `${header}.${body}.${signature}`;
}

describe('Authentication & JWT Decoder', () => {
  it('ควรคืนค่า null เมื่อ token เป็นค่าว่างหรือไม่ถูกต้อง', () => {
    expect(decodeGoogleJwt('')).toBeNull();
    expect(decodeGoogleJwt('invalid.token')).toBeNull();
    expect(decodeGoogleJwt('not-a-token')).toBeNull();
  });

  it('ควรถอดรหัส Google JWT payload ได้อย่างถูกต้อง', () => {
    const mockPayload = {
      sub: 'google_user_123456789',
      email: 'songpon.official@gmail.com',
      email_verified: true,
      name: 'Songpon Official',
      given_name: 'Songpon',
      picture: 'https://lh3.googleusercontent.com/a/test',
    };

    const token = createTestJwt(mockPayload);
    const decoded = decodeGoogleJwt(token);

    expect(decoded).not.toBeNull();
    expect(decoded?.sub).toBe('google_user_123456789');
    expect(decoded?.email).toBe('songpon.official@gmail.com');
    expect(decoded?.name).toBe('Songpon Official');
    expect(decoded?.given_name).toBe('Songpon');
  });

  it('ควรถอดรหัสภาษาไทยและอักขระพิเศษใน JWT ได้อย่างถูกต้อง', () => {
    const thaiPayload = {
      sub: 'google_user_thai_999',
      email: 'somchai@gmail.com',
      name: 'สมชาย สายบุญ',
      given_name: 'สมชาย',
    };

    const token = createTestJwt(thaiPayload);
    const decoded = decodeGoogleJwt(token);

    expect(decoded).not.toBeNull();
    expect(decoded?.name).toBe('สมชาย สายบุญ');
    expect(decoded?.given_name).toBe('สมชาย');
  });
});

describe('GoogleAuthService Lifecycle', () => {
  let authService: GoogleAuthService;

  beforeEach(() => {
    memoryStore.clear();
    authService = new GoogleAuthService();
  });

  it('ควรล็อกอินด้วยบัญชีจำลอง (Mock Login) ได้สำเร็จ', async () => {
    const user = await authService.loginWithMock({
      name: 'Tester User',
      email: 'tester@gmail.com',
    });

    expect(user).toBeDefined();
    expect(user.name).toBe('Tester User');
    expect(user.email).toBe('tester@gmail.com');
    expect(user.provider).toBe('mock');
    expect(authService.getCurrentUser()?.id).toBe(user.id);
  });

  it('ควรออกจากระบบ (Logout) และล้างข้อมูลผู้ใช้ได้สำเร็จ', async () => {
    await authService.loginWithMock({ name: 'Active User' });
    expect(authService.getCurrentUser()).not.toBeNull();

    await authService.logout();
    expect(authService.getCurrentUser()).toBeNull();
  });

  it('ควรแจ้งเตือน Subscribers เมื่อสถานะการล็อกอินเปลี่ยนแปลง', async () => {
    let notifiedUser: unknown = undefined;
    const unsubscribe = authService.subscribe((u) => {
      notifiedUser = u;
    });

    await authService.loginWithMock({ name: 'Observer Player' });
    expect(notifiedUser).not.toBeNull();

    await authService.logout();
    expect(notifiedUser).toBeNull();

    unsubscribe();
  });
});

describe('Creator & Admin Role Assignment (Email-Checked After Google Login)', () => {
  it('songpon.official@gmail.com ต้องอยู่ในรายชื่อผู้สร้าง (Creator)', () => {
    expect(CREATOR_EMAILS).toContain('songpon.official@gmail.com');
    expect(isCreatorEmail('songpon.official@gmail.com')).toBe(true);
    expect(resolveRole('songpon.official@gmail.com')).toBe('creator');
  });

  it('seree999@gmail.com ต้องอยู่ในรายชื่อผู้ดูแลระบบ (Admin)', () => {
    expect(ADMIN_EMAILS).toContain('seree999@gmail.com');
    expect(isAdminEmail('seree999@gmail.com')).toBe(true);
    expect(resolveRole('seree999@gmail.com')).toBe('admin');
  });

  it('ตรวจสอบ Email แบบ Case-insensitive และตัดช่องว่าง', () => {
    expect(isAdminEmail('  Seree999@Gmail.COM ')).toBe(true);
    expect(isCreatorEmail('  Songpon.Official@gmail.com  ')).toBe(true);
    expect(isAdminEmail('other@gmail.com')).toBe(false);
    expect(isAdminEmail('')).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
  });

  it('Login ด้วย email ผู้สร้าง ต้องได้ role = creator', async () => {
    const authService = new GoogleAuthService();
    const token = createTestJwt({
      sub: 'google_creator_001',
      email: 'songpon.official@gmail.com',
      email_verified: true,
      name: 'Songpon Creator',
    });

    const user = await authService.loginWithCredential(token);
    expect(user.role).toBe('creator');
    expect(authService.getCurrentUser()?.role).toBe('creator');
    await authService.logout();
  });

  it('Login ด้วย email ผู้ดูแลระบบ ต้องได้ role = admin', async () => {
    const authService = new GoogleAuthService();
    const token = createTestJwt({
      sub: 'google_admin_001',
      email: 'seree999@gmail.com',
      email_verified: true,
      name: 'Seree Admin',
    });

    const user = await authService.loginWithCredential(token);
    expect(user.role).toBe('admin');
    expect(authService.getCurrentUser()?.role).toBe('admin');
    await authService.logout();
  });

  it('Login ด้วย email ธรรมดา ต้องได้ role = player', async () => {
    const authService = new GoogleAuthService();
    const token = createTestJwt({
      sub: 'google_player_777',
      email: 'randomplayer@gmail.com',
      email_verified: true,
      name: 'Random Player',
    });

    const user = await authService.loginWithCredential(token);
    expect(user.role).toBe('player');
    await authService.logout();
  });

  it('Admin ข้าม Cooldown Bailout 60 วิได้อกัีร (forceClaim)', async () => {
    const walletRepo = new LocalStorageWalletRepo();
    const useCase = new ClaimEmergencyBailoutUseCase(walletRepo);
    const adminId = 'google_admin_test_bailout';

    // ให้อกัีร 5 ชิป (ต่ำกว่า threshold 10)
    const w = new VirtualWallet(adminId, 5);
    await walletRepo.saveWallet(w, adminId);

    // กด Bailout ครั้่งแรก สำเร็จ
    const first = await useCase.execute(adminId, true);
    expect(first.newBalance).toBe(205);

    // กดอึกครั้่งในทันที — ผ้ใช้ปกติต้องถูกปัด (balance ≥ 10 ยังถูกปัดก่อน cooldown), Admin ผ่าน
    const playerErr = await useCase.execute(adminId, false).catch((e: Error) => e.message);
    expect(playerErr).toContain('ชิป');

    const adminSecond = await useCase.execute(adminId, true);
    expect(adminSecond.newBalance).toBe(405);
  });

  it('Admin ข้าม Cooldown Daily 24 ชม.ได้อกัีร (forceClaim)', async () => {
    const walletRepo = new LocalStorageWalletRepo();
    const useCase = new ClaimDailyRewardUseCase(walletRepo);
    const adminId = 'google_admin_test_daily';

    const w = new VirtualWallet(adminId, 100);
    await walletRepo.saveWallet(w, adminId);

    const first = await useCase.execute(adminId, true);
    expect(first.newBalance).toBe(600);

    const playerErr = await useCase.execute(adminId, false).catch((e: Error) => e.message);
    expect(playerErr).toContain('ชั่วโมง');

    const adminSecond = await useCase.execute(adminId, true);
    expect(adminSecond.newBalance).toBe(1100);
  });
});

describe('User-Scoped Storage Isolation (Multi-User Wallets)', () => {
  beforeEach(() => {
    memoryStore.clear();
  });

  it('ควรแยกกระเป๋าชิปของผู้ใช้ Google ออกจาก Guest ได้อย่างอิสระ', async () => {
    const walletRepo = new LocalStorageWalletRepo();
    const googleUserId = 'google_user_unique_9988';

    // บันทึกชิปให้ guest 800 ชิป
    const gWallet = new VirtualWallet('guest', 800);
    await walletRepo.saveWallet(gWallet);

    // บันทึกชิปให้ Google User 5,000 ชิป
    const userWallet = new VirtualWallet(googleUserId, 5000);
    await walletRepo.saveWallet(userWallet, googleUserId);

    // ดึงกลับมาตรวจสอบ
    const loadedGuest = await walletRepo.getWallet();
    const loadedUser = await walletRepo.getWallet(googleUserId);

    expect(loadedGuest.balance).toBe(800);
    expect(loadedUser.balance).toBe(5000);
    expect(loadedUser.walletId).toBe(googleUserId);
  });

  it('ควรแยกสถิติการเล่นระหว่าง Guest กับ User ได้อย่างอิสระ', async () => {
    const historyRepo = new LocalStorageHistoryRepo();
    const googleUserId = 'google_user_stats_1122';

    const guestStats = StreakTracker.createDefaultStats();
    guestStats.totalRounds = 5;
    await historyRepo.saveStats(guestStats);

    const userStats = StreakTracker.createDefaultStats();
    userStats.totalRounds = 42;
    userStats.currentStreak = 7;
    await historyRepo.saveStats(userStats, googleUserId);

    const loadedGuest = await historyRepo.getStats();
    const loadedUser = await historyRepo.getStats(googleUserId);

    expect(loadedGuest.totalRounds).toBe(5);
    expect(loadedUser.totalRounds).toBe(42);
    expect(loadedUser.currentStreak).toBe(7);
  });
});
