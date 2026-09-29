import { IWalletRepository } from '../../domain/ports/IWalletRepository';
import { BailoutOutput } from '../dtos/PlayRoundDTO';

export class ClaimEmergencyBailoutUseCase {
  constructor(private readonly walletRepo: IWalletRepository) {}

  public async execute(): Promise<BailoutOutput> {
    const wallet = await this.walletRepo.getWallet();
    const check = wallet.canClaimBailout();

    if (!check.eligible) {
      if (wallet.balance >= 10) {
        throw new Error('คุณยังมีชิปเหลืออยู่ จะขอชิปฉุกเฉินได้เมื่อชิปเหลือน้อยกว่า 10');
      }
      throw new Error(`กรุณารออีก ${check.remainingSeconds} วินาทีก่อนขอรับชิปฉุกเฉินใหม่`);
    }

    const claimed = wallet.claimBailout();
    await this.walletRepo.saveWallet(wallet);

    return {
      claimedAmount: claimed,
      newBalance: wallet.balance,
      cooldownRemainingSeconds: 60,
    };
  }
}
