import { IHistoryRepository } from '../../domain/ports/IHistoryRepository';
import { IWalletRepository } from '../../domain/ports/IWalletRepository';
import { adminService } from '../services/AdminService';

export interface AuditEntry {
  action: string;
  target?: string;
  detail?: string;
  time: string;
}

/**
 * Creator-Only: Audit Log — ดูประวัติกิจกรรมทั้งหมดของระบบ
 */
export class ViewAuditLogsUseCase {
  constructor(
    private readonly historyRepo: IHistoryRepository,
    private readonly walletRepo: IWalletRepository,
  ) {}

  public async execute(): Promise<AuditEntry[]> {
    const records = adminService.getAuditLogs();
    if (records.length > 0) {
      return records.map((r) => ({
        action: r.action,
        target: r.targetUserId,
        detail: r.detail,
        time: new Date(r.timestamp).toLocaleString('th-TH'),
      }));
    }

    return [
      {
        action: 'SYSTEM_INIT',
        target: 'System',
        detail: 'ระบบพร้อมทำงานและบันทึกประวัติการใช้งาน',
        time: new Date().toLocaleString('th-TH'),
      },
    ];
  }
}
