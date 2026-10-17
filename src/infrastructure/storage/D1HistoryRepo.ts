import { IHistoryRepository } from '../../domain/ports/IHistoryRepository';
import { PlayerStats } from '../../domain/services/StreakTracker';
import { api } from '../api/apiClient';

/**
 * สถิติผู้เล่นที่เก็บบน Cloudflare D1 (ตาราง player_stats) ผ่าน Worker API
 * roadmap 15 ตาล่าสุดถูกเก็บเป็น JSON ในคอลัมน์ roadmap_json
 */
export class D1HistoryRepo implements IHistoryRepository {
  private resolveUserId(userId?: string): string {
    return userId && userId.trim().length > 0 ? userId : 'guest';
  }

  public async getStats(userId?: string): Promise<PlayerStats> {
    return await api.get<PlayerStats>(
      `/stats?userId=${encodeURIComponent(this.resolveUserId(userId))}`
    );
  }

  public async saveStats(stats: PlayerStats, userId?: string): Promise<void> {
    await api.put<PlayerStats>('/stats', {
      userId: this.resolveUserId(userId),
      stats,
    });
  }

  public async resetStats(userId?: string): Promise<PlayerStats> {
    return await api.post<PlayerStats>('/stats/reset', {
      userId: this.resolveUserId(userId),
    });
  }
}
