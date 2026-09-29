import { Bet } from '../../domain/entities/Bet';
import { DiceHand } from '../../domain/entities/DiceHand';
import { PayoutCalculator } from '../../domain/services/PayoutCalculator';
import { StreakTracker, RoadmapItem } from '../../domain/services/StreakTracker';
import { IRandomGenerator } from '../../domain/ports/IRandomGenerator';
import { IWalletRepository } from '../../domain/ports/IWalletRepository';
import { IHistoryRepository } from '../../domain/ports/IHistoryRepository';
import { PlayRoundInput, PlayRoundOutput } from '../dtos/PlayRoundDTO';

export class PlaceBetAndRollUseCase {
  constructor(
    private readonly walletRepo: IWalletRepository,
    private readonly historyRepo: IHistoryRepository,
    private readonly rng: IRandomGenerator
  ) {}

  public async execute(input: PlayRoundInput, userId?: string): Promise<PlayRoundOutput> {
    const wallet = await this.walletRepo.getWallet(userId);
    const stats = await this.historyRepo.getStats(userId);

    // 1. ตรวจสอบความถูกต้องของการแทง
    const bet = new Bet(input.option, input.amount);
    const validation = bet.validate(wallet.balance);
    if (!validation.isValid) {
      throw new Error(validation.error || 'การวางเดิมพันไม่ถูกต้อง');
    }

    // 2. หักชิปเดิมพันออกจากกระเป๋า
    const deducted = wallet.deduct(bet.amount);
    if (!deducted) {
      throw new Error('ยอดชิปคงเหลือไม่เพียงพอสำหรับเดิมพันนี้');
    }

    // 3. ทอยลูกเต๋า 3 ลูกด้วย True CSPRNG
    const dice = this.rng.rollDiceHand();
    const hand = new DiceHand(dice);

    // 4. ตัดสินผลและคำนวณเงินรางวัลจำลอง
    const evaluation = PayoutCalculator.evaluate(bet, hand);

    // 5. หากชนะ ให้เพิ่มชิปรางวัลคืนเข้ากระเป๋า
    if (evaluation.won && evaluation.payoutAmount > 0) {
      wallet.credit(evaluation.payoutAmount);
    }

    // 6. บันทึกกระเป๋าชิป
    await this.walletRepo.saveWallet(wallet, userId);

    // 7. บันทึกประวัติและอัปเดตสถิติ
    const roadmapItem: RoadmapItem = {
      id: `rnd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      dice,
      sum: hand.sum,
      category: hand.getCategory(),
      isTriple: hand.isTriple,
      playerWon: evaluation.won,
      timestamp: Date.now(),
    };

    const updatedStats = StreakTracker.updateStats(stats, roadmapItem, evaluation.netGain);
    await this.historyRepo.saveStats(updatedStats, userId);

    return {
      dice,
      sum: hand.sum,
      category: hand.getCategory(),
      isTriple: hand.isTriple,
      won: evaluation.won,
      multiplier: evaluation.multiplier,
      payoutAmount: evaluation.payoutAmount,
      netGain: evaluation.netGain,
      newBalance: wallet.balance,
      reason: evaluation.reason,
      stats: updatedStats,
      roadmapItem,
    };
  }
}
