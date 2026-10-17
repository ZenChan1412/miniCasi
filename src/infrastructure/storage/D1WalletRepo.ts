import { VirtualWallet, WalletState } from '../../domain/entities/VirtualWallet';
import { IWalletRepository } from '../../domain/ports/IWalletRepository';
import { api } from '../api/apiClient';

/**
 * กระเป๋าชิปที่เก็บบน Cloudflare D1 (ตาราง virtual_wallets) ผ่าน Worker API
 * แทน LocalStorageWalletRepo — ยอดชิปจึงผูกกับบัญชีจริง ไม่ผูกกับเบราว์เซอร์
 */
export class D1WalletRepo implements IWalletRepository {
  /** ผู้เล่นที่ไม่ล็อกอินถูกเก็บเป็น player id 'guest' บนฐานข้อมูล */
  private resolveUserId(userId?: string): string {
    return userId && userId.trim().length > 0 ? userId : 'guest';
  }

  public async getWallet(userId?: string): Promise<VirtualWallet> {
    const state = await api.get<WalletState>(
      `/wallet?userId=${encodeURIComponent(this.resolveUserId(userId))}`
    );
    return VirtualWallet.fromJSON(state);
  }

  public async saveWallet(wallet: VirtualWallet, userId?: string): Promise<void> {
    await api.put<WalletState>('/wallet', {
      userId: this.resolveUserId(userId),
      wallet: wallet.toJSON(),
    });
  }

  public async resetWallet(userId?: string): Promise<VirtualWallet> {
    const state = await api.post<WalletState>('/wallet/reset', {
      userId: this.resolveUserId(userId),
    });
    return VirtualWallet.fromJSON(state);
  }
}
