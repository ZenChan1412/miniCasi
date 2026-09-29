import { IHistoryRepository } from '../../domain/ports/IHistoryRepository';
import { IWalletRepository } from '../../domain/ports/IWalletRepository';

export interface AuditEntry {
  action: string;
  target?: string;
  detail?: string;
  time: string;
}

/**
 * Creator-Only: Audit Log — ดูประวัติกิจกรรมทั้งหมดของระบบ
 * บันทึก action ทั้งหมดที่เกิดขึ้นใน localStorage (admin actions + game actions)
 */
export class ViewAuditLogsUseCase {
  constructor(
    private readonly historyRepo: IHistoryRepository,
    private readonly walletRepo: IWalletRepository,
  ) {}

  public async execute(): Promise<AuditEntry[]> {
    const entries: AuditEntry[] = [];
    const ls = typeof localStorage !== 'undefined' ? localStorage : null;

    if (!ls) return entries;

    // 1. อ่าน audit log จาก localStorage (รูปแบบ: audit_log_<userId>)
    for (let i = 0; i < ls.length; i++) {
      const key = ls.key(i);
      if (!key || !key.startsWith('audit_log_')) continue;

      try {
        const logData = ls.getItem(key);
        if (logData) {
          const logs = JSON.parse(logData);
          if (Array.isArray(logs)) {
            for (const entry of logs) {
              entries.push({
                action: entry.action || 'unknown',
                target: entry.target,
                detail: entry.detail,
                time: entry.timestamp || new Date().toISOString(),
              });
            }
          }
        }
      } catch {
        // Skip corrupted entries
      }
    }

    // 2. อ่าน game stats
    for (let i = 0; i < ls.length; i++) {
      const key = ls.key(i);
      if (!key || !key.startsWith('stats_')) continue;

      try {
        const statsData = ls.getItem(key);
        if (statsData) {
          const stats = JSON.parse(statsData);
          if (stats && stats.totalRounds) {
            entries.push({
              action: 'GAME_SESSION',
              target: stats.userId || key,
              detail: `${stats.totalRounds} rounds | Win ${stats.wins} | Loss ${stats.losses}`,
              time: stats.lastPlayedAt || new Date().toISOString(),
            });
          }
        }
      } catch {
        // Skip corrupted entries
      }
    }

    // Sort by time (newest first)
    return entries.sort((a, b) => (b.time > a.time ? 1 : -1));
  }
}
