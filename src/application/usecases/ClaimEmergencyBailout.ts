import { IWalletRepository } from '../../domain/ports/IWalletRepository';
import { BailoutOutput } from '../dtos/PlayRoundDTO';

export class ClaimEmergencyBailoutUseCase {
  constructor(private readonly walletRepo: IWalletRepository) {}

  public async execute(userId?: string, isAdmin = false): Promise<BailoutOutput> {
    const wallet = await this.walletRepo.getWallet(userId);
    const check = wallet.canClaimBailout();

    if (!check.eligible) {
      if (!isAdmin) {
        if (wallet.balance >= 10) {
          throw new Error('คุณยังมีชิปเหลืออยู่ จะขอชิปฉุกเฉินได้เมื่อชิปเหลือน้อยกว่า 10');
        }
        throw new Error(`กรุณารออีก ${check.remainingSeconds} วินาทีก่อนขอรับชิปฉุกเฉินใหม่`);
      }
      // สิทธิ์ผู้ดูแลระบบ: ข้ามทั้ง Cooldown 60 วินาทีและ threshold 10 ชิป ได้อีก
      const claimed = wallet.forceClaimBailout();
      await this.walletRepo.saveWallet(wallet, userId);
      return {
        claimedAmount: claimed,
        newBalance: wallet.balance,
        cooldownRemainingSeconds: 60,
      };
    }

    const claimed = wallet.claimBailout();
    await this.walletRepo.saveWallet(wallet, userId);

    return {
      claimedAmount: claimed,
      newBalance: wallet.balance,
      cooldownRemainingSeconds: 60,
    };
  }
}
