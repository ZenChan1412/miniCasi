import { VirtualWallet, WalletState } from '../../domain/entities/VirtualWallet';
import { IWalletRepository } from '../../domain/ports/IWalletRepository';

export class LocalStorageWalletRepo implements IWalletRepository {
  private static readonly STORAGE_KEY = 'high_low_wallet_v1';
  private static readonly CHECKSUM_SALT = 'salt_casino_mini_game_2026';

  private calculateChecksum(wallet: WalletState): string {
    const raw = `${wallet.walletId}:${wallet.balance}:${wallet.lastBailoutAt}:${wallet.lastDailyClaimAt}:${LocalStorageWalletRepo.CHECKSUM_SALT}`;
    // Simple fast hashing
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return hash.toString(16);
  }

  public async getWallet(): Promise<VirtualWallet> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return new VirtualWallet('memory_user');
    }

    try {
      const dataStr = window.localStorage.getItem(LocalStorageWalletRepo.STORAGE_KEY);
      if (!dataStr) {
        return await this.resetWallet();
      }

      const parsed = JSON.parse(dataStr);
      const expectedChecksum = this.calculateChecksum(parsed.data);

      if (parsed.checksum !== expectedChecksum) {
        console.warn('ตรวจพบการดัดแปลงข้อมูลชิปใน LocalStorage! ระบบจะรีเซ็ตยอดกลับสู่ค่าเริ่มต้น');
        return await this.resetWallet();
      }

      return VirtualWallet.fromJSON(parsed.data);
    } catch (err) {
      console.error('เกิดข้อผิดพลาดในการโหลด Wallet:', err);
      return await this.resetWallet();
    }
  }

  public async saveWallet(wallet: VirtualWallet): Promise<void> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    const state = wallet.toJSON();
    const checksum = this.calculateChecksum(state);
    const payload = {
      data: state,
      checksum,
      updatedAt: Date.now(),
    };

    window.localStorage.setItem(LocalStorageWalletRepo.STORAGE_KEY, JSON.stringify(payload));
  }

  public async resetWallet(): Promise<VirtualWallet> {
    const defaultWallet = new VirtualWallet(`guest_${Math.random().toString(36).substring(2, 9)}`);
    await this.saveWallet(defaultWallet);
    return defaultWallet;
  }
}
