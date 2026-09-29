import { VirtualWallet, WalletState } from '../../domain/entities/VirtualWallet';
import { IWalletRepository } from '../../domain/ports/IWalletRepository';

export class LocalStorageWalletRepo implements IWalletRepository {
  private static readonly STORAGE_KEY = 'high_low_wallet_v2';
  private static readonly LEGACY_KEY = 'high_low_wallet_v1';
  private static readonly CHECKSUM_SALT = 'salt_casino_mini_game_crypto_2026';

  private getStorageKey(userId?: string): string {
    return userId ? `${LocalStorageWalletRepo.STORAGE_KEY}_user_${userId}` : LocalStorageWalletRepo.STORAGE_KEY;
  }

  /**
   * คำนวณ Cryptographic Checksum ด้วย SHA-256 เพื่อป้องกันการโกงคะแนนผ่าน DevTools
   */
  public async calculateChecksum(wallet: WalletState): Promise<string> {
    const raw = `${wallet.walletId}:${wallet.balance}:${wallet.lastBailoutAt}:${wallet.lastDailyClaimAt}:${LocalStorageWalletRepo.CHECKSUM_SALT}`;
    const cryptoObj = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;

    if (cryptoObj && cryptoObj.subtle) {
      const msgBuffer = new TextEncoder().encode(raw);
      const hashBuffer = await cryptoObj.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    // Fallback เมื่อรันในสภาพแวดล้อมที่ไม่มี subtle
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `fb_${hash.toString(16)}`;
  }

  public async getWallet(userId?: string): Promise<VirtualWallet> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return new VirtualWallet(userId || 'memory_user');
    }

    const key = this.getStorageKey(userId);

    try {
      let dataStr = window.localStorage.getItem(key);

      // ตรวจสอบ migration จาก legacy v1 สำหรับ guest
      if (!dataStr && !userId) {
        const legacyStr = window.localStorage.getItem(LocalStorageWalletRepo.LEGACY_KEY);
        if (legacyStr) {
          try {
            const legacyParsed = JSON.parse(legacyStr);
            if (legacyParsed && legacyParsed.data) {
              const legacyWallet = VirtualWallet.fromJSON(legacyParsed.data);
              await this.saveWallet(legacyWallet);
              window.localStorage.removeItem(LocalStorageWalletRepo.LEGACY_KEY);
              return legacyWallet;
            }
          } catch {
            // ละเว้นหาก legacy เสียหาย
          }
        }
        return await this.resetWallet(userId);
      }

      if (!dataStr) {
        return await this.resetWallet(userId);
      }

      const parsed = JSON.parse(dataStr);
      const expectedChecksum = await this.calculateChecksum(parsed.data);

      if (parsed.checksum !== expectedChecksum) {
        console.warn('ตรวจพบการดัดแปลงข้อมูลชิปใน LocalStorage! ระบบจะรีเซ็ตยอดกลับสู่ค่าเริ่มต้นเพื่อความยุติธรรม');
        return await this.resetWallet(userId);
      }

      return VirtualWallet.fromJSON(parsed.data);
    } catch (err) {
      console.error('เกิดข้อผิดพลาดในการโหลด Wallet:', err);
      return await this.resetWallet(userId);
    }
  }

  public async saveWallet(wallet: VirtualWallet, userId?: string): Promise<void> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    const key = this.getStorageKey(userId);
    const state = wallet.toJSON();
    const checksum = await this.calculateChecksum(state);
    const payload = {
      data: state,
      checksum,
      updatedAt: Date.now(),
    };

    window.localStorage.setItem(key, JSON.stringify(payload));
  }

  public async resetWallet(userId?: string): Promise<VirtualWallet> {
    const id = userId || `guest_${Math.random().toString(36).substring(2, 9)}`;
    const defaultWallet = new VirtualWallet(id);
    await this.saveWallet(defaultWallet, userId);
    return defaultWallet;
  }
}
