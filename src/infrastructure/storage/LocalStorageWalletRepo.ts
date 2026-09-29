import { VirtualWallet, WalletState } from '../../domain/entities/VirtualWallet';
import { IWalletRepository } from '../../domain/ports/IWalletRepository';

export class LocalStorageWalletRepo implements IWalletRepository {
  private static readonly STORAGE_KEY = 'high_low_wallet_v2';
  private static readonly LEGACY_KEY = 'high_low_wallet_v1';
  private static readonly CHECKSUM_SALT = 'salt_casino_mini_game_crypto_2026';

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

  public async getWallet(): Promise<VirtualWallet> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return new VirtualWallet('memory_user');
    }

    try {
      let dataStr = window.localStorage.getItem(LocalStorageWalletRepo.STORAGE_KEY);
      
      // ตรวจสอบ migration จาก legacy v1
      if (!dataStr) {
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
        return await this.resetWallet();
      }

      const parsed = JSON.parse(dataStr);
      const expectedChecksum = await this.calculateChecksum(parsed.data);

      if (parsed.checksum !== expectedChecksum) {
        console.warn('ตรวจพบการดัดแปลงข้อมูลชิปใน LocalStorage! ระบบจะรีเซ็ตยอดกลับสู่ค่าเริ่มต้นเพื่อความยุติธรรม');
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
    const checksum = await this.calculateChecksum(state);
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
