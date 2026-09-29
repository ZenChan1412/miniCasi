import { IHistoryRepository } from '../../domain/ports/IHistoryRepository';
import { PlayerStats, StreakTracker } from '../../domain/services/StreakTracker';

export class LocalStorageHistoryRepo implements IHistoryRepository {
  private static readonly STORAGE_KEY = 'high_low_stats_v1';

  private getStorageKey(userId?: string): string {
    return userId ? `${LocalStorageHistoryRepo.STORAGE_KEY}_user_${userId}` : LocalStorageHistoryRepo.STORAGE_KEY;
  }

  public async getStats(userId?: string): Promise<PlayerStats> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return StreakTracker.createDefaultStats();
    }

    const key = this.getStorageKey(userId);

    try {
      const dataStr = window.localStorage.getItem(key);
      if (!dataStr) {
        return StreakTracker.createDefaultStats();
      }
      return JSON.parse(dataStr) as PlayerStats;
    } catch {
      return StreakTracker.createDefaultStats();
    }
  }

  public async saveStats(stats: PlayerStats, userId?: string): Promise<void> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    const key = this.getStorageKey(userId);
    window.localStorage.setItem(key, JSON.stringify(stats));
  }

  public async resetStats(userId?: string): Promise<PlayerStats> {
    const defaultStats = StreakTracker.createDefaultStats();
    await this.saveStats(defaultStats, userId);
    return defaultStats;
  }
}
