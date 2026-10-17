import { ManagedUser } from '../../domain/entities/ManagedUser';
import { AuditRecord } from '../../domain/entities/AuditLog';
import { UserProfile } from '../../domain/entities/User';
import { api } from '../../infrastructure/api/apiClient';
import { setUserRoleOverride } from '../../domain/constants/AdminConfig';

export interface BanEntry {
  playerId: string;
  reason: string;
  bannedAt: number;
}

export interface SystemMetrics {
  totalUsers: number;
  circulatingChips: number;
  totalRounds: number;
  totalBanned: number;
  adminCount: number;
}

/**
 * ที่เก็บข้อมูลผู้ดูแลระบบบน Cloudflare D1 (ผ่าน Worker API)
 *
 * แทน registry / banned / audit / role override ที่เคยอยู่ใน LocalStorage ด้วยตาราง
 * players, user_bans, audit_logs และ role_overrides — ข้อมูลจึงใช้ร่วมกันทุกเครื่อง
 */
export class D1AdminStore {
  public async registerUser(profile: UserProfile): Promise<void> {
    await api.post('/players/register', { profile });
  }

  public async getAllUsers(): Promise<ManagedUser[]> {
    return await api.get<ManagedUser[]>('/admin/users');
  }

  public async listBans(): Promise<BanEntry[]> {
    return await api.get<BanEntry[]>('/admin/bans');
  }

  public async getRoleOverrides(): Promise<Record<string, 'creator' | 'admin' | 'player'>> {
    return await api.get<Record<string, 'creator' | 'admin' | 'player'>>('/admin/role-overrides');
  }

  public async getAuditLogs(limit = 100): Promise<AuditRecord[]> {
    return await api.get<AuditRecord[]>(`/admin/audit?limit=${limit}`);
  }

  /** รายชื่อ id ที่ถูกแบน (public — ผู้เล่นทั่วไปเรียกได้) */
  public async listBannedIds(): Promise<string[]> {
    return await api.get<string[]>('/bans/ids');
  }

  // Worker เขียน audit log เองทุกครั้งที่มีการกระทำของแอดมิน ฝั่ง client ไม่ต้องบันทึกซ้ำ

  public async grantChips(
    targetUserId: string,
    amount: number,
    _actor: UserProfile
  ): Promise<{ newBalance: number }> {
    return await api.post<{ newBalance: number }>('/admin/chips/grant', { targetUserId, amount });
  }

  public async resetWallet(targetUserId: string, _actor: UserProfile): Promise<void> {
    await api.post('/admin/wallet/reset', { targetUserId });
  }

  public async resetCooldowns(targetUserId: string, _actor: UserProfile): Promise<void> {
    await api.post('/admin/cooldown/reset', { targetUserId });
  }

  public async banUser(targetUserId: string, reason: string, _actor: UserProfile): Promise<void> {
    await api.post('/admin/ban', { targetUserId, reason });
  }

  public async unbanUser(targetUserId: string, _actor: UserProfile): Promise<void> {
    await api.post('/admin/unban', { targetUserId });
  }

  public async changeUserRole(
    targetUserId: string,
    targetEmail: string | undefined,
    newRole: 'creator' | 'admin' | 'player',
    actor: UserProfile
  ): Promise<void> {
    if (actor.role !== 'creator') {
      throw new Error('เฉพาะผู้สร้าง (Creator / Admin++) เท่านั้นที่มีสิทธิ์เปลี่ยนระดับผู้ใช้');
    }

    await api.post('/admin/role-override', { identifier: targetUserId, role: newRole });
    if (targetEmail) {
      await api.post('/admin/role-override', { identifier: targetEmail, role: newRole });
    }

    // ซิงก์ลง LocalStorage ด้วย เพื่อให้การ resolve สิทธิ์ฝั่ง client เห็นผลทันทีโดยไม่ต้องรีเฟรช
    setUserRoleOverride(targetUserId, newRole);
    if (targetEmail) {
      setUserRoleOverride(targetEmail, newRole);
    }
  }

  public async getSystemMetrics(): Promise<SystemMetrics> {
    return await api.get<SystemMetrics>('/admin/metrics');
  }
}
