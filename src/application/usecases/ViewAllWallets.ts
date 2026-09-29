import { IWalletRepository } from '../../domain/ports/IWalletRepository';

export interface WalletSummary {
  id: string;
  balance: number;
  lastBailoutAt?: number;
  lastDailyClaimAt?: number;
}

/**
 * Creator-Only: ดึงรายการ wallet ทั้งหมดที่เก็�์ใน LocalStorage
 * ใช้ตรวจสอบ activity ของผู้เล่นทั้งหมด (Creator exclusive)
 */
export class ViewAllWalletsUseCase {
  constructor(private readonly walletRepo: IWalletRepository) {}

  public async execute(): Promise<WalletSummary[]> {
    // ดึง wallet ทั้งหมดจาก localStorage (key pattern: wallet_<userId>)
    // Guard: localStorage ไม่อยู่ใน Workers runtime
    const ls: Storage | null =
      typeof localStorage !== 'undefined' ? localStorage : null;

    const entries: WalletSummary[] = [];

    if (!ls) return entries;

    for (let i = 0; i < ls.length; i++) {
      const key = ls.key(i);
      if (!key) continue;

      try {
        const walletData = ls.getItem(key);
        if (walletData) {
          const data = JSON.parse(walletData);
          if (data && typeof data.balance === 'number') {
            entries.push({
              id: data.id || key,
              balance: data.balance,
              lastBailoutAt: data.lastBailoutAt,
              lastDailyClaimAt: data.lastDailyClaimAt,
            });
          }
        }
      } catch {
        // Skip corrupted entries
      }
    }

    return entries.sort((a, b) => b.balance - a.balance);
  }
}
