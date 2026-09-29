import { IWalletRepository } from '../../domain/ports/IWalletRepository';

/**
 * Creator-Only: Ban User — ลบ wallet และบล็อกผู้ใช้
 * ใช้เมื่อพบการฉ้อโกง / อคติ / การใช้บอต
 */
export class BanUserUseCase {
  constructor(private readonly walletRepo: IWalletRepository) {}

  public async execute(userId: string): Promise<void> {
    // ลบ wallet ของผู้ใช้ทั้งหมด (bailout, daily, history)
    await this.walletRepo.resetWallet(userId);

    // ลบ session auth ถ้ามี (force logout)
    // Guard: localStorage ไม่อยู่ใน Workers runtime
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(`admin_${userId}`);
    }
  }
}
