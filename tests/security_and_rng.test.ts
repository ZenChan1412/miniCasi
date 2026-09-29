import { describe, it, expect } from 'bun:test';
import { WebCryptoRNG } from '../src/infrastructure/rng/WebCryptoRNG';
import { LocalStorageWalletRepo } from '../src/infrastructure/storage/LocalStorageWalletRepo';
import { VirtualWallet } from '../src/domain/entities/VirtualWallet';

describe('Security & RNG: WebCryptoRNG Fair Randomness', () => {
  it('ควรสุ่มแต้มลูกเต๋าอยู่ในช่วง 1 ถึง 6 เท่านั้น (1,000 การทดลอง)', () => {
    const rng = new WebCryptoRNG();
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

    for (let i = 0; i < 1000; i++) {
      const die = rng.rollSingleDie();
      expect(die).toBeGreaterThanOrEqual(1);
      expect(die).toBeLessThanOrEqual(6);
      expect(Number.isInteger(die)).toBe(true);
      counts[die]++;
    }

    // ทุกหน้าเต๋าต้องถูกสุ่มได้อย่างน้อย 1 ครั้ง
    for (let side = 1; side <= 6; side++) {
      expect(counts[side]).toBeGreaterThan(50);
    }
  });

  it('ควรทอยลูกเต๋าเป็นชุด 3 ลูกได้อย่างถูกต้อง', () => {
    const rng = new WebCryptoRNG();
    const hand = rng.rollDiceHand();
    expect(hand.length).toBe(3);
    expect(hand[0]).toBeGreaterThanOrEqual(1);
    expect(hand[1]).toBeGreaterThanOrEqual(1);
    expect(hand[2]).toBeGreaterThanOrEqual(1);
  });
});

describe('Security & Integrity: Checksum & Anti-Tampering', () => {
  it('ควรสร้าง Checksum ที่คงเส้นคงวาสำหรับสถานะกระเป๋าเดียวกัน', async () => {
    const repo = new LocalStorageWalletRepo();
    const state = {
      walletId: 'user_123',
      balance: 1000,
      lastBailoutAt: 0,
      lastDailyClaimAt: 0,
    };

    const hash1 = await repo.calculateChecksum(state);
    const hash2 = await repo.calculateChecksum(state);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBeGreaterThan(0);
  });

  it('ควรสร้าง Checksum ที่ต่างกันเมื่อยอดเงินเปลี่ยนไป', async () => {
    const repo = new LocalStorageWalletRepo();
    const state1 = {
      walletId: 'user_123',
      balance: 1000,
      lastBailoutAt: 0,
      lastDailyClaimAt: 0,
    };
    const state2 = {
      walletId: 'user_123',
      balance: 999999, // ดัดแปลงยอดเงิน
      lastBailoutAt: 0,
      lastDailyClaimAt: 0,
    };

    const hash1 = await repo.calculateChecksum(state1);
    const hash2 = await repo.calculateChecksum(state2);
    expect(hash1).not.toBe(hash2);
  });
});
