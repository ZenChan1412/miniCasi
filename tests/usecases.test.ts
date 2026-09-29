import { describe, it, expect } from 'bun:test';
import { PlaceBetAndRollUseCase } from '../src/application/usecases/PlaceBetAndRoll';
import { ClaimEmergencyBailoutUseCase } from '../src/application/usecases/ClaimEmergencyBailout';
import { ClaimDailyRewardUseCase } from '../src/application/usecases/ClaimDailyReward';
import { VirtualWallet } from '../src/domain/entities/VirtualWallet';
import { IWalletRepository } from '../src/domain/ports/IWalletRepository';
import { IHistoryRepository } from '../src/domain/ports/IHistoryRepository';
import { IRandomGenerator } from '../src/domain/ports/IRandomGenerator';
import { PlayerStats, StreakTracker } from '../src/domain/services/StreakTracker';

// Mock Wallet Repository for In-memory Testing
class InMemoryWalletRepo implements IWalletRepository {
  private wallet: VirtualWallet;

  constructor(initialBalance: number = 1000, lastBailoutAt: number = 0, lastDailyClaimAt: number = 0) {
    this.wallet = new VirtualWallet('test_user', initialBalance, lastBailoutAt, lastDailyClaimAt);
  }

  async getWallet(): Promise<VirtualWallet> {
    return this.wallet;
  }

  async saveWallet(wallet: VirtualWallet): Promise<void> {
    this.wallet = wallet;
  }

  async resetWallet(): Promise<VirtualWallet> {
    this.wallet = new VirtualWallet('test_user', 1000);
    return this.wallet;
  }
}

// Mock History Repository for In-memory Testing
class InMemoryHistoryRepo implements IHistoryRepository {
  private stats: PlayerStats = StreakTracker.createDefaultStats();

  async getStats(): Promise<PlayerStats> {
    return this.stats;
  }

  async saveStats(stats: PlayerStats): Promise<void> {
    this.stats = stats;
  }

  async resetStats(): Promise<PlayerStats> {
    this.stats = StreakTracker.createDefaultStats();
    return this.stats;
  }
}

// Predictable Deterministic RNG Mock for Testing
class FixedRNG implements IRandomGenerator {
  constructor(private readonly fixedDice: [number, number, number]) {}

  rollSingleDie(): number {
    return this.fixedDice[0];
  }

  rollDiceHand(): [number, number, number] {
    return this.fixedDice;
  }
}

describe('Use Case: PlaceBetAndRollUseCase', () => {
  it('ควรชนะและได้ชิปเพิ่มเมื่อแทง LOW แล้วเต๋าออกแต้มต่ำ (1-2-3 = 6)', async () => {
    const walletRepo = new InMemoryWalletRepo(1000);
    const historyRepo = new InMemoryHistoryRepo();
    const rng = new FixedRNG([1, 2, 3]); // Sum = 6 (LOW)

    const useCase = new PlaceBetAndRollUseCase(walletRepo, historyRepo, rng);
    const result = await useCase.execute({ option: 'LOW', amount: 100 });

    expect(result.won).toBe(true);
    expect(result.multiplier).toBe(1);
    expect(result.netGain).toBe(100);
    expect(result.payoutAmount).toBe(200);
    expect(result.newBalance).toBe(1100); // 1000 - 100 + 200 = 1100
    expect(result.stats.totalRounds).toBe(1);
    expect(result.stats.wins).toBe(1);
    expect(result.stats.currentStreak).toBe(1);
  });

  it('ควรหักชิปและบันทึกสถิติเมื่อแทง HIGH แต่เต๋าออกแต้มต่ำ (1-2-3 = 6)', async () => {
    const walletRepo = new InMemoryWalletRepo(1000);
    const historyRepo = new InMemoryHistoryRepo();
    const rng = new FixedRNG([1, 2, 3]); // Sum = 6 (LOW)

    const useCase = new PlaceBetAndRollUseCase(walletRepo, historyRepo, rng);
    const result = await useCase.execute({ option: 'HIGH', amount: 100 });

    expect(result.won).toBe(false);
    expect(result.netGain).toBe(-100);
    expect(result.payoutAmount).toBe(0);
    expect(result.newBalance).toBe(900); // 1000 - 100 = 900
    expect(result.stats.totalRounds).toBe(1);
    expect(result.stats.losses).toBe(1);
    expect(result.stats.currentStreak).toBe(0);
  });

  it('ควรปฏิเสธการเดิมพันเมื่อชิปไม่เพียงพอ', async () => {
    const walletRepo = new InMemoryWalletRepo(50);
    const historyRepo = new InMemoryHistoryRepo();
    const rng = new FixedRNG([1, 2, 3]);

    const useCase = new PlaceBetAndRollUseCase(walletRepo, historyRepo, rng);
    
    expect(async () => {
      await useCase.execute({ option: 'HIGH', amount: 100 });
    }).toThrow('ยอดชิปคงเหลือของคุณไม่เพียงพอ');
  });

  it('ควรให้เจ้ามือชนะเมื่อแทง LOW แต่ออกลูกเต๋าตอง (2-2-2)', async () => {
    const walletRepo = new InMemoryWalletRepo(500);
    const historyRepo = new InMemoryHistoryRepo();
    const rng = new FixedRNG([2, 2, 2]); // Sum = 6 แต่เป็นตอง

    const useCase = new PlaceBetAndRollUseCase(walletRepo, historyRepo, rng);
    const result = await useCase.execute({ option: 'LOW', amount: 50 });

    expect(result.won).toBe(false);
    expect(result.isTriple).toBe(true);
    expect(result.newBalance).toBe(450);
  });
});

describe('Use Case: ClaimEmergencyBailoutUseCase', () => {
  it('ควรเคลมชิป 200 สำเร็จเมื่อยอดชิป < 10', async () => {
    const walletRepo = new InMemoryWalletRepo(5); // ต่ำกว่า 10
    const useCase = new ClaimEmergencyBailoutUseCase(walletRepo);

    const result = await useCase.execute();
    expect(result.claimedAmount).toBe(200);
    expect(result.newBalance).toBe(205);
  });

  it('ควรล้มเหลวเมื่อมียอดชิป >= 10', async () => {
    const walletRepo = new InMemoryWalletRepo(100);
    const useCase = new ClaimEmergencyBailoutUseCase(walletRepo);

    expect(async () => {
      await useCase.execute();
    }).toThrow('คุณยังมีชิปเหลืออยู่ จะขอชิปฉุกเฉินได้เมื่อชิปเหลือน้อยกว่า 10');
  });
});

describe('Use Case: ClaimDailyRewardUseCase', () => {
  it('ควรเคลมโบนัสประจำวัน 500 ชิปสำเร็จในการเคลมครั้งแรก', async () => {
    const walletRepo = new InMemoryWalletRepo(1000);
    const useCase = new ClaimDailyRewardUseCase(walletRepo);

    const result = await useCase.execute();
    expect(result.claimedAmount).toBe(500);
    expect(result.newBalance).toBe(1500);
  });

  it('ควรปฏิเสธการเคลมซ้ำในวันเดียวกัน', async () => {
    const walletRepo = new InMemoryWalletRepo(1000, 0, Date.now()); // เพิ่งเคลมไป
    const useCase = new ClaimDailyRewardUseCase(walletRepo);

    expect(async () => {
      await useCase.execute();
    }).toThrow('คุณรับรางวัลรายวันไปแล้ว');
  });
});
