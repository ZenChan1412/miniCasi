import { IWalletRepository } from '../../domain/ports/IWalletRepository';
import { DailyClaimOutput } from '../dtos/PlayRoundDTO';

export class ClaimDailyRewardUseCase {
  constructor(private readonly walletRepo: IWalletRepository) {}

  public async execute(): Promise<DailyClaimOutput> {
    const wallet = await this.walletRepo.getWallet();
    const check = wallet.canClaimDaily();

    if (!check.eligible) {
      throw new Error(`คุณรับรางวัลรายวันไปแล้ว กรุณารออีก ${Math.ceil(check.remainingSeconds / 3600)} ชั่วโมง`);
    }

    const claimed = wallet.claimDaily();
    await this.walletRepo.saveWallet(wallet);

    return {
      claimedAmount: claimed,
      newBalance: wallet.balance,
      cooldownRemainingSeconds: 24 * 3600,
    };
  }
}
