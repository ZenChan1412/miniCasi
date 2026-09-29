import { IHistoryRepository } from '../../domain/ports/IHistoryRepository';
import { PlayerStats, StreakTracker } from '../../domain/services/StreakTracker';

export class LocalStorageHistoryRepo implements IHistoryRepository {
  private static readonly STORAGE_KEY = 'high_low_stats_v1';

  public async getStats(): Promise<PlayerStats> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return StreakTracker.createDefaultStats();
    }

    try {
      const dataStr = window.localStorage.getItem(LocalStorageHistoryRepo.STORAGE_KEY);
      if (!dataStr) {
        return StreakTracker.createDefaultStats();
      }
      return JSON.parse(dataStr) as PlayerStats;
    } catch {
      return StreakTracker.createDefaultStats();
    }
  }

  public async saveStats(stats: PlayerStats): Promise<void> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.setItem(LocalStorageHistoryRepo.STORAGE_KEY, JSON.stringify(stats));
  }

  public async resetStats(): Promise<PlayerStats> {
    const defaultStats = StreakTracker.createDefaultStats();
    await this.saveStats(defaultStats);
    return defaultStats;
  }
}
