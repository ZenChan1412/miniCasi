import { VirtualWallet } from '../entities/VirtualWallet';

export interface IWalletRepository {
  getWallet(userId?: string): Promise<VirtualWallet>;
  saveWallet(wallet: VirtualWallet, userId?: string): Promise<void>;
  resetWallet(userId?: string): Promise<VirtualWallet>;
}
