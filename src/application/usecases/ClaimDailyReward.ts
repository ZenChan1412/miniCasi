import { IWalletRepository } from '../../domain/ports/IWalletRepository';
import { DailyClaimOutput } from '../dtos/PlayRoundDTO';

export class ClaimDailyRewardUseCase {
  constructor(private readonly walletRepo: IWalletRepository) {}

  public async execute(userId?: string, isAdmin = false): Promise<DailyClaimOutput> {
    const wallet = await this.walletRepo.getWallet(userId);
    const check = wallet.canClaimDaily();

    if (!check.eligible) {
      if (!isAdmin) {
        throw new Error(`คุณรับรางวัลรายวันไปแล้ว กรุณารออีก ${Math.ceil(check.remainingSeconds / 3600)} ชั่วโมง`);
      }
      // สิทธิ์ผู้ดูแลระบบ: ข้าม Cooldown 24 ชั่วโมงได้อีก
      const claimed = wallet.forceClaimDaily();
      await this.walletRepo.saveWallet(wallet, userId);
      return {
        claimedAmount: claimed,
        newBalance: wallet.balance,
        cooldownRemainingSeconds: 24 * 3600,
      };
    }

    const claimed = wallet.claimDaily();
    await this.walletRepo.saveWallet(wallet, userId);

    return {
      claimedAmount: claimed,
      newBalance: wallet.balance,
      cooldownRemainingSeconds: 24 * 3600,
    };
  }
}
