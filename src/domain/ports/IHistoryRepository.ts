import { PlayerStats } from '../services/StreakTracker';

export interface IHistoryRepository {
  getStats(userId?: string): Promise<PlayerStats>;
  saveStats(stats: PlayerStats, userId?: string): Promise<void>;
  resetStats(userId?: string): Promise<PlayerStats>;
}
