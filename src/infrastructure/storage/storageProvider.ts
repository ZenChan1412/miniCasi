import { VirtualWallet } from '../../domain/entities/VirtualWallet';
import { IWalletRepository } from '../../domain/ports/IWalletRepository';
import { IHistoryRepository } from '../../domain/ports/IHistoryRepository';
import { PlayerStats } from '../../domain/services/StreakTracker';
import { fetchDbHealth, HealthReport } from '../api/apiClient';
import { D1WalletRepo } from './D1WalletRepo';
import { D1HistoryRepo } from './D1HistoryRepo';
import { LocalStorageWalletRepo } from './LocalStorageWalletRepo';
import { LocalStorageHistoryRepo } from './LocalStorageHistoryRepo';

export type StorageMode = 'd1' | 'local' | 'unknown';

export interface StorageStatus {
  mode: StorageMode;
  health: HealthReport | null;
  checkedAt: number;
}

/**
 * ตัวตัดสินว่าจะเก็บข้อมูลที่ Cloudflare D1 หรือสำรองไว้ที่ LocalStorage
 *
 * D1 คือที่เก็บหลัก ใช้เมื่อ /api/health ตอบว่าต่อฐานข้อมูลได้และตารางครบ
 * ถ้าต่อไม่ได้ (เช่นรัน `vite dev` โดยไม่มี Worker) จะถอยไปใช้ LocalStorage
 * เพื่อให้เกมยังเล่นได้ และสถานะที่ใช้จริงถูกแสดงบนหน้า Admin เสมอ
 */

const d1Wallet = new D1WalletRepo();
const d1History = new D1HistoryRepo();
const localWallet = new LocalStorageWalletRepo();
const localHistory = new LocalStorageHistoryRepo();

let status: StorageStatus = { mode: 'unknown', health: null, checkedAt: 0 };
let probe: Promise<StorageStatus> | null = null;
const listeners = new Set<(s: StorageStatus) => void>();

function publish(next: StorageStatus): StorageStatus {
  status = next;
  for (const listener of listeners) {
    listener(next);
  }
  return next;
}

async function runProbe(): Promise<StorageStatus> {
  const health = await fetchDbHealth();
  return publish({
    mode: health.ok ? 'd1' : 'local',
    health,
    checkedAt: Date.now(),
  });
}

/** ตรวจครั้งแรกครั้งเดียว แล้วใช้ผลที่แคชไว้ */
export function ensureStorageReady(): Promise<StorageStatus> {
  if (!probe) {
    probe = runProbe();
  }
  return probe;
}

/** ตรวจซ้ำตามคำสั่งผู้ใช้ (ปุ่ม "ตรวจการเชื่อมต่อใหม่") */
export function refreshStorageStatus(): Promise<StorageStatus> {
  probe = runProbe();
  return probe;
}

export function getStorageStatus(): StorageStatus {
  return status;
}

export function subscribeStorageStatus(listener: (s: StorageStatus) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isD1Active(): boolean {
  return status.mode === 'd1';
}

async function activeWalletRepo(): Promise<IWalletRepository> {
  const current = await ensureStorageReady();
  return current.mode === 'd1' ? d1Wallet : localWallet;
}

async function activeHistoryRepo(): Promise<IHistoryRepository> {
  const current = await ensureStorageReady();
  return current.mode === 'd1' ? d1History : localHistory;
}

/**
 * Repository ที่ส่งต่อไปยังที่เก็บที่ใช้งานอยู่จริง
 * สัญญา (port) เป็น async อยู่แล้ว ชั้นบนจึงไม่ต้องรู้ว่าปลายทางเป็น D1 หรือ LocalStorage
 */
export class ResolvedWalletRepository implements IWalletRepository {
  public async getWallet(userId?: string): Promise<VirtualWallet> {
    const repo = await activeWalletRepo();
    try {
      return await repo.getWallet(userId);
    } catch (err) {
      return await this.fallback(err, (r) => r.getWallet(userId));
    }
  }

  public async saveWallet(wallet: VirtualWallet, userId?: string): Promise<void> {
    const repo = await activeWalletRepo();
    try {
      await repo.saveWallet(wallet, userId);
    } catch (err) {
      await this.fallback(err, (r) => r.saveWallet(wallet, userId));
    }
  }

  public async resetWallet(userId?: string): Promise<VirtualWallet> {
    const repo = await activeWalletRepo();
    try {
      return await repo.resetWallet(userId);
    } catch (err) {
      return await this.fallback(err, (r) => r.resetWallet(userId));
    }
  }

  /** D1 ล้มระหว่างใช้งาน: สลับโหมดเป็น local แล้วทำงานต่อ เพื่อไม่ให้เกมค้าง */
  private async fallback<T>(err: unknown, run: (repo: IWalletRepository) => Promise<T>): Promise<T> {
    if (status.mode !== 'd1') throw err;
    console.error('D1 wallet ใช้งานไม่ได้ สลับไปใช้ LocalStorage ชั่วคราว:', err);
    publish({ ...status, mode: 'local' });
    return await run(localWallet);
  }
}

export class ResolvedHistoryRepository implements IHistoryRepository {
  public async getStats(userId?: string): Promise<PlayerStats> {
    const repo = await activeHistoryRepo();
    try {
      return await repo.getStats(userId);
    } catch (err) {
      return await this.fallback(err, (r) => r.getStats(userId));
    }
  }

  public async saveStats(stats: PlayerStats, userId?: string): Promise<void> {
    const repo = await activeHistoryRepo();
    try {
      await repo.saveStats(stats, userId);
    } catch (err) {
      await this.fallback(err, (r) => r.saveStats(stats, userId));
    }
  }

  public async resetStats(userId?: string): Promise<PlayerStats> {
    const repo = await activeHistoryRepo();
    try {
      return await repo.resetStats(userId);
    } catch (err) {
      return await this.fallback(err, (r) => r.resetStats(userId));
    }
  }

  private async fallback<T>(
    err: unknown,
    run: (repo: IHistoryRepository) => Promise<T>
  ): Promise<T> {
    if (status.mode !== 'd1') throw err;
    console.error('D1 stats ใช้งานไม่ได้ สลับไปใช้ LocalStorage ชั่วคราว:', err);
    publish({ ...status, mode: 'local' });
    return await run(localHistory);
  }
}

export const walletRepository = new ResolvedWalletRepository();
export const historyRepository = new ResolvedHistoryRepository();
