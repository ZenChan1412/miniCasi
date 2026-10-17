import { ManagedUser } from '../../domain/entities/ManagedUser';
import { AuditRecord } from '../../domain/entities/AuditLog';
import { UserProfile } from '../../domain/entities/User';
import { api } from '../../infrastructure/api/apiClient';
import { D1WalletRepo } from '../../infrastructure/storage/D1WalletRepo';
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
  private walletRepo = new D1WalletRepo();

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

  public async addAuditLog(entry: Omit<AuditRecord, 'id' | 'timestamp'>): Promise<AuditRecord> {
    return await api.post<AuditRecord>('/admin/audit', { entry });
  }

  public async grantChips(
    targetUserId: string,
    amount: number,
    actor: UserProfile
  ): Promise<{ newBalance: number }> {
    const wallet = await this.walletRepo.getWallet(targetUserId);
    const before = wallet.balance;
    wallet.credit(amount);
    await this.walletRepo.saveWallet(wallet, targetUserId);

    await this.addAuditLog({
      actorEmail: actor.email,
      actorRole: actor.role || 'admin',
      action: 'CHIP_GRANT',
      targetUserId,
      targetName: targetUserId,
      amount,
      balanceBefore: before,
      balanceAfter: wallet.balance,
      detail: `เพิ่มชิป +${amount.toLocaleString()} ชิป (จาก ${before.toLocaleString()} เป็น ${wallet.balance.toLocaleString()}) โดย ${actor.email || actor.name}`,
    });

    return { newBalance: wallet.balance };
  }

  public async resetWallet(targetUserId: string, actor: UserProfile): Promise<void> {
    const wallet = await this.walletRepo.resetWallet(targetUserId);

    await this.addAuditLog({
      actorEmail: actor.email,
      actorRole: actor.role || 'admin',
      action: 'WALLET_RESET',
      targetUserId,
      targetName: targetUserId,
      balanceAfter: wallet.balance,
      detail: `รีเซ็ตยอดชิปของ ${targetUserId} กลับเป็น ${wallet.balance.toLocaleString()} ชิป โดย ${actor.email || actor.name}`,
    });
  }

  public async resetCooldowns(targetUserId: string, actor: UserProfile): Promise<void> {
    const wallet = await this.walletRepo.getWallet(targetUserId);
    wallet.resetCooldowns();
    await this.walletRepo.saveWallet(wallet, targetUserId);

    await this.addAuditLog({
      actorEmail: actor.email,
      actorRole: actor.role || 'admin',
      action: 'COOLDOWN_RESET',
      targetUserId,
      targetName: targetUserId,
      detail: `ล้าง Cooldown (Bailout & Daily) ของ ${targetUserId} โดย ${actor.email || actor.name}`,
    });
  }

  public async banUser(targetUserId: string, reason: string, actor: UserProfile): Promise<void> {
    await api.post('/admin/ban', { targetUserId, reason, actorEmail: actor.email });
    await this.addAuditLog({
      actorEmail: actor.email,
      actorRole: actor.role || 'creator',
      action: 'USER_BAN',
      targetUserId,
      detail: `ระงับบัญชี (Ban) ${targetUserId} ข้อหา: ${reason} โดย ${actor.email || actor.name}`,
    });
  }

  public async unbanUser(targetUserId: string, actor: UserProfile): Promise<void> {
    await api.post('/admin/unban', { targetUserId });
    await this.addAuditLog({
      actorEmail: actor.email,
      actorRole: actor.role || 'creator',
      action: 'USER_UNBAN',
      targetUserId,
      detail: `ปลดระงับบัญชี (Unban) ${targetUserId} สำเร็จ โดย ${actor.email || actor.name}`,
    });
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

    await api.post('/admin/role-override', {
      identifier: targetUserId,
      role: newRole,
      actorEmail: actor.email,
    });
    if (targetEmail) {
      await api.post('/admin/role-override', {
        identifier: targetEmail,
        role: newRole,
        actorEmail: actor.email,
      });
    }

    // ซิงก์ลง LocalStorage ด้วย เพื่อให้การ resolve สิทธิ์ฝั่ง client เห็นผลทันทีโดยไม่ต้องรีเฟรช
    setUserRoleOverride(targetUserId, newRole);
    if (targetEmail) {
      setUserRoleOverride(targetEmail, newRole);
    }

    await this.addAuditLog({
      actorEmail: actor.email,
      actorRole: actor.role || 'creator',
      action: newRole === 'player' ? 'ROLE_DEMOTE' : 'ROLE_PROMOTE',
      targetUserId,
      targetName: targetEmail || targetUserId,
      detail: `เปลี่ยนระดับสิทธิ์ของ ${targetEmail || targetUserId} เป็น ${newRole.toUpperCase()} โดย ${actor.email || actor.name}`,
    });
  }

  public async getSystemMetrics(): Promise<SystemMetrics> {
    return await api.get<SystemMetrics>('/admin/metrics');
  }
}
