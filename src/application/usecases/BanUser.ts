import { IWalletRepository } from '../../domain/ports/IWalletRepository';
import { adminService } from '../services/AdminService';

/**
 * Creator-Only: Ban User — ลบ wallet และบล็อกผู้ใช้
 * ใช้เมื่อพบการฉ้อโกง / อคติ / การใช้บอต
 */
export class BanUserUseCase {
  constructor(private readonly walletRepo: IWalletRepository) {}

  public async execute(userId: string): Promise<void> {
    await this.walletRepo.resetWallet(userId);
    await adminService.banUser(userId, 'ถูกระงับสิทธิ์โดยผู้ดูแลระบบสูงสุด (Admin++)', {
      id: 'system_creator',
      name: 'System Admin++',
      email: 'songpon.official@gmail.com',
      provider: 'google',
      role: 'creator',
      loggedInAt: Date.now(),
    });
  }
}
