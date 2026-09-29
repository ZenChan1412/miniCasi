import { VirtualWallet } from '../entities/VirtualWallet';

export interface IWalletRepository {
  getWallet(): Promise<VirtualWallet>;
  saveWallet(wallet: VirtualWallet): Promise<void>;
  resetWallet(): Promise<VirtualWallet>;
}
