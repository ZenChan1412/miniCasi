import { IWalletRepository } from '../../domain/ports/IWalletRepository';
import { adminService } from '../services/AdminService';

export interface WalletSummary {
  id: string;
  balance: number;
  lastBailoutAt?: number;
  lastDailyClaimAt?: number;
}

/**
 * Creator-Only: ดึงรายการ wallet ทั้งหมดที่เก็บในระบบ
 * ใช้ตรวจสอบ activity ของผู้เล่นทั้งหมด (Creator exclusive)
 */
export class ViewAllWalletsUseCase {
  constructor(private readonly walletRepo: IWalletRepository) {}

  public async execute(): Promise<WalletSummary[]> {
    const users = await adminService.getAllUsers();
    return users.map((u) => ({
      id: u.id,
      balance: u.balance,
      lastBailoutAt: u.lastBailoutAt,
      lastDailyClaimAt: u.lastDailyClaimAt,
    }));
  }
}
