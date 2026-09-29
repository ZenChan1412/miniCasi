import { IWalletRepository } from '../../domain/ports/IWalletRepository';

export interface GrantChipsOutput {
  grantedAmount: number;
  newBalance: number;
}

/**
 * สิทธผ์ีู้ดู้แล้ระบบ (Admin): เพิ่่มชิปให้อกัีร
 * - เพิ่่มยอดชิปได้อกัีร โดยไมเ่่ริ่ยกฏ Bailout / Daily
 * - ล้าง Cooldown ทัง้หมด (Bailout + Daily) เพื่อกู้ชีพผ้้ใช้ทัง้หมด
 *
 * หมายเหตุ: สิทธินี้ถกู่เรียกใช้ได้อกัีรจาก AdminPanel ท่ีตรวจสอบ
 * user.role === 'admin' แล้ว (เพิ่่ดเฉพาะผ้้ดู้แล้ระบบ)
 */
export class AdminGrantChipsUseCase {
  constructor(private readonly walletRepo: IWalletRepository) {}

  public async execute(userId: string, amount: number): Promise<GrantChipsOutput> {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('จำนวนชิปท่ีเพิ่่มไม่ถ่ีกต้ง่ (ต้ง้แต้ 1 ชิปข้ึ้นไป)');
    }

    const wallet = await this.walletRepo.getWallet(userId);
    wallet.credit(amount);

    // ล้าง Cooldown ทัง้หมด เพื่อกู้ชีพผ้้ใช้
    wallet.resetCooldowns();

    await this.walletRepo.saveWallet(wallet, userId);

    return {
      grantedAmount: amount,
      newBalance: wallet.balance,
    };
  }
}
