import { PlayerStats } from '../services/StreakTracker';

export interface IHistoryRepository {
  getStats(): Promise<PlayerStats>;
  saveStats(stats: PlayerStats): Promise<void>;
  resetStats(): Promise<PlayerStats>;
}
