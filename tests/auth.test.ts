import { describe, it, expect, beforeEach } from 'bun:test';
import { decodeGoogleJwt } from '../src/infrastructure/auth/jwtDecoder';
import { GoogleAuthService } from '../src/infrastructure/auth/GoogleAuthService';
import { LocalStorageWalletRepo } from '../src/infrastructure/storage/LocalStorageWalletRepo';
import { LocalStorageHistoryRepo } from '../src/infrastructure/storage/LocalStorageHistoryRepo';
import { VirtualWallet } from '../src/domain/entities/VirtualWallet';
import { StreakTracker } from '../src/domain/services/StreakTracker';

// Setup Mock In-Memory Storage for Bun CLI Environment
const memoryStore = new Map<string, string>();
const mockStorage = {
  getItem: (key: string) => memoryStore.get(key) ?? null,
  setItem: (key: string, val: string) => memoryStore.set(key, String(val)),
  removeItem: (key: string) => memoryStore.delete(key),
  clear: () => memoryStore.clear(),
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
