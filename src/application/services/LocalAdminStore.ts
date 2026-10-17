/**
 * ที่เก็บข้อมูลผู้ดูแลระบบบน LocalStorage (ของเดิม)
 * ใช้เป็นตัวสำรองเมื่อต่อ Cloudflare D1 ไม่ได้ เช่นรัน `vite dev` โดยไม่มี Worker
 */
import { ManagedUser } from '../../domain/entities/ManagedUser';
import { AuditRecord, AuditAction } from '../../domain/entities/AuditLog';
import { UserProfile } from '../../domain/entities/User';
import { resolveRole, resolveUserRole, setUserRoleOverride } from '../../domain/constants/AdminConfig';
import { LocalStorageWalletRepo } from '../../infrastructure/storage/LocalStorageWalletRepo';
import { LocalStorageHistoryRepo } from '../../infrastructure/storage/LocalStorageHistoryRepo';
import { VirtualWallet } from '../../domain/entities/VirtualWallet';

export class LocalAdminStore {
  private static readonly REGISTRY_KEY = 'high_low_user_registry_v1';
  private static readonly BANNED_KEY = 'high_low_banned_users_v1';
  private static readonly AUDIT_KEY = 'high_low_audit_logs_v2';

  private walletRepo = new LocalStorageWalletRepo();
  private historyRepo = new LocalStorageHistoryRepo();

  private getStorage(): Storage | null {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  }

  /**
   * บันทึกข้อมูลผู้ใช้ลง Registry เมื่อมีการล็อกอินหรือเข้าเล่น
   */
  public registerUser(user: UserProfile): void {
    const ls = this.getStorage();
    if (!ls) return;

    try {
      const raw = ls.getItem(LocalAdminStore.REGISTRY_KEY);
      const registry: Record<string, Partial<ManagedUser>> = raw ? JSON.parse(raw) : {};

      const existing = registry[user.id] || {};
      registry[user.id] = {
        ...existing,
        id: user.id,
        name: user.name,
        email: user.email,
        picture: user.picture,
        provider: user.provider,
        role: resolveUserRole(user.id, user.email, user.role),
        lastActiveAt: Date.now(),
        createdAt: existing.createdAt || Date.now(),
      };

      ls.setItem(LocalAdminStore.REGISTRY_KEY, JSON.stringify(registry));
    } catch (e) {
      console.error('Failed to register user:', e);
    }
  }

  /**
   * ตรวจสอบว่าผู้ใช้ถูกระงับสิทธิ์ (Banned) หรือไม่
   */
  public isUserBanned(userId?: string): boolean {
    if (!userId) return false;
    const ls = this.getStorage();
    if (!ls) return false;

    try {
      const raw = ls.getItem(LocalAdminStore.BANNED_KEY);
      if (!raw) return false;
      const bannedMap: Record<string, { bannedAt: number; reason?: string }> = JSON.parse(raw);
      return Boolean(bannedMap[userId]);
    } catch {
      return false;
    }
  }

  /**
   * ดึงรายชื่อผู้ใช้ทั้งหมดในระบบ พร้อมยอดชิปสดและสถิติ
   */
  public async getAllUsers(currentUser?: UserProfile | null): Promise<ManagedUser[]> {
    const ls = this.getStorage();
    const usersMap = new Map<string, ManagedUser>();

    // 0. บันทึกและดึงข้อมูลของ currentUser ก่อนเสมอ
    if (currentUser) {
      this.registerUser(currentUser);
      usersMap.set(currentUser.id, {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        picture: currentUser.picture,
        provider: currentUser.provider,
        role: resolveUserRole(currentUser.id, currentUser.email, currentUser.role),
        isBanned: this.isUserBanned(currentUser.id),
        balance: 1000,
        totalRounds: 0,
        winRate: 0,
        biggestWin: 0,
        currentStreak: 0,
        lastActiveAt: Date.now(),
        createdAt: Date.now(),
      });
    }

    // 1. อ่านจาก User Registry ที่บันทึกไว้
    if (ls) {
      try {
        const raw = ls.getItem(LocalAdminStore.REGISTRY_KEY);
        if (raw) {
          const registry: Record<string, Partial<ManagedUser>> = JSON.parse(raw);
          for (const [id, u] of Object.entries(registry)) {
            // ไม่เขียนทับ currentUser ที่สดกว่า
            if (currentUser && id === currentUser.id) continue;

            // เทียบ id แบบตรงตัว: เดิมใช้ includes() ทำให้ id ที่มีคำว่า seree/songpon
            // ถูกจับคู่กับอีเมลผู้ดูแลระบบ แล้วได้สิทธิ์ admin/creator ติดมาด้วย
            const isSeree = id === 'google_admin_seree';
            const isSongpon = id === 'google_creator_songpon';

            usersMap.set(id, {
              id,
              name: u.name || (isSeree ? 'Seree (Admin)' : isSongpon ? 'Songpon (Creator)' : id),
              email: u.email || (isSeree ? 'seree999@gmail.com' : isSongpon ? 'songpon.official@gmail.com' : undefined),
              picture: u.picture,
              provider: u.provider || 'google',
              role: resolveUserRole(id, u.email, u.role),
              isBanned: this.isUserBanned(id),
              balance: 1000,
              totalRounds: 0,
              winRate: 0,
              biggestWin: 0,
              currentStreak: 0,
              lastActiveAt: u.lastActiveAt || Date.now(),
              createdAt: u.createdAt || Date.now(),
            });
          }
        }
      } catch (e) {
        console.error('Failed to parse registry:', e);
      }
    }

    // 2. ตรวจสอบค้นหา Wallets ใน LocalStorage เพื่อให้ครอบคลุมผู้เล่นทุกคน (รวม Guest และ Google users)
    if (ls) {
      for (let i = 0; i < ls.length; i++) {
        const key = ls.key(i);
        if (!key) continue;

        if (key.startsWith('high_low_wallet_v2')) {
          let uId = 'guest';
          if (key.includes('_user_')) {
            uId = key.replace('high_low_wallet_v2_user_', '');
          }

          if (usersMap.has(uId)) {
            continue;
          }

          const isGuest = uId === 'guest';
          const isSeree = uId === 'google_admin_seree';
          const isSongpon = uId === 'google_creator_songpon';
          const defaultEmail = isSeree ? 'seree999@gmail.com' : isSongpon ? 'songpon.official@gmail.com' : undefined;
          const defaultName = isGuest
            ? 'ผู้เล่นทั่วไป (Guest)'
            : isSeree
            ? 'Seree (Admin)'
            : isSongpon
            ? 'Songpon (Creator)'
            : `ผู้ใช้ ${uId.substring(0, 10)}`;

          usersMap.set(uId, {
            id: uId,
            name: defaultName,
            email: defaultEmail,
            role: resolveUserRole(uId, defaultEmail),
            isBanned: this.isUserBanned(uId),
            balance: 1000,
            totalRounds: 0,
            winRate: 0,
            biggestWin: 0,
            currentStreak: 0,
            lastActiveAt: Date.now(),
            createdAt: Date.now(),
            provider: isGuest ? 'guest' : 'google',
          });
        }
      }

      // ตรวจสอบค้นหา Banned Users ที่อาจยังไม่มีกระเป๋าหรือประวัติ
      try {
        const rawBanned = ls.getItem(LocalAdminStore.BANNED_KEY);
        if (rawBanned) {
          const bannedMap = JSON.parse(rawBanned);
          for (const bannedId of Object.keys(bannedMap)) {
            if (!usersMap.has(bannedId)) {
              usersMap.set(bannedId, {
                id: bannedId,
                name: `ผู้ใช้ ${bannedId}`,
                role: resolveUserRole(bannedId, null),
                isBanned: true,
                balance: 1000,
                totalRounds: 0,
                winRate: 0,
                biggestWin: 0,
                currentStreak: 0,
                lastActiveAt: Date.now(),
                createdAt: Date.now(),
                provider: 'google',
              });
            }
          }
        }
      } catch (e) {
        console.error('Failed to parse banned users:', e);
      }
    }

    // 3. เพิ่ม Default Super Users หากยังไม่มีในระบบ เพื่อให้เห็นบน Dashboard เสมอ
    if (!usersMap.has('google_creator_songpon')) {
      usersMap.set('google_creator_songpon', {
        id: 'google_creator_songpon',
        name: 'Songpon (Creator)',
        email: 'songpon.official@gmail.com',
        role: resolveUserRole('google_creator_songpon', 'songpon.official@gmail.com'),
        isBanned: false,
        balance: 999999,
        totalRounds: 150,
        winRate: 85.5,
        biggestWin: 30000,
        currentStreak: 12,
        lastActiveAt: Date.now(),
        createdAt: Date.now() - 86400000 * 7,
        provider: 'google',
      });
    }

    if (!usersMap.has('google_admin_seree')) {
      usersMap.set('google_admin_seree', {
        id: 'google_admin_seree',
        name: 'Seree (Admin)',
        email: 'seree999@gmail.com',
        role: resolveUserRole('google_admin_seree', 'seree999@gmail.com'),
        isBanned: false,
        balance: 50000,
        totalRounds: 80,
        winRate: 62.0,
        biggestWin: 12000,
        currentStreak: 5,
        lastActiveAt: Date.now() - 3600000,
        createdAt: Date.now() - 86400000 * 3,
        provider: 'google',
      });
    }

    // 4. ดึงข้อมูล Wallet และ Stats สดๆ ของแต่ละ User
    const userList: ManagedUser[] = [];
    for (const [id, user] of usersMap.entries()) {
      try {
        const targetId = id === 'guest' ? undefined : id;
        const wallet = await this.walletRepo.getWallet(targetId);
        const stats = await this.historyRepo.getStats(targetId);

        user.balance = wallet.balance;
        user.lastBailoutAt = wallet.lastBailoutAt;
        user.lastDailyClaimAt = wallet.lastDailyClaimAt;
        user.totalRounds = stats.totalRounds;
        user.winRate = stats.winRatePercentage;
        user.biggestWin = stats.biggestWin;
        user.currentStreak = stats.currentStreak;
        user.isBanned = this.isUserBanned(id);

        if (currentUser && (id === currentUser.id || (currentUser.email && user.email === currentUser.email))) {
          user.role = resolveUserRole(currentUser.id, currentUser.email, user.role);
          user.name = currentUser.name;
          user.email = currentUser.email;
          if (currentUser.picture) user.picture = currentUser.picture;
        } else {
          user.role = resolveUserRole(id, user.email, user.role);
        }
      } catch (err) {
        console.warn(`Could not sync live wallet for ${id}:`, err);
      }
      userList.push(user);
    }

    // จัดเรียง: ผู้สร้าง -> แอดมิน -> ชิปมากสุด
    return userList.sort((a, b) => {
      if (a.role === 'creator') return -1;
      if (b.role === 'creator') return 1;
      if (a.role === 'admin' && b.role !== 'admin') return -1;
      if (b.role === 'admin' && a.role !== 'admin') return 1;
      return b.balance - a.balance;
    });
  }

  /**
   * เพิ่มชิปให้ผู้เล่น (Admin & Creator)
   */
  public async grantChips(
    targetUserId: string,
    amount: number,
    actor: UserProfile
  ): Promise<{ newBalance: number }> {
    const targetId = targetUserId === 'guest' ? undefined : targetUserId;
    const wallet = await this.walletRepo.getWallet(targetId);
    const before = wallet.balance;
    wallet.credit(amount);
    await this.walletRepo.saveWallet(wallet, targetId);

    this.addAuditLog({
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

  /**
   * รีเซ็ตยอดกระเป๋าชิปของผู้ใช้กลับเป็น 1,000 ชิป
   */
  public async resetWallet(targetUserId: string, actor: UserProfile): Promise<void> {
    const targetId = targetUserId === 'guest' ? undefined : targetUserId;
    const wallet = await this.walletRepo.resetWallet(targetId);

    this.addAuditLog({
      actorEmail: actor.email,
      actorRole: actor.role || 'admin',
      action: 'WALLET_RESET',
      targetUserId,
      targetName: targetUserId,
      balanceAfter: wallet.balance,
      detail: `รีเซ็ตยอดชิปของ ${targetUserId} กลับเป็น 1,000 ชิป โดย ${actor.email || actor.name}`,
    });
  }

  /**
   * ล้าง Cooldown ทั้ง Bailout และ Daily
   */
  public async resetCooldowns(targetUserId: string, actor: UserProfile): Promise<void> {
    const targetId = targetUserId === 'guest' ? undefined : targetUserId;
    const wallet = await this.walletRepo.getWallet(targetId);
    wallet.resetCooldowns();
    await this.walletRepo.saveWallet(wallet, targetId);

    this.addAuditLog({
      actorEmail: actor.email,
      actorRole: actor.role || 'admin',
      action: 'COOLDOWN_RESET',
      targetUserId,
      targetName: targetUserId,
      detail: `ล้าง Cooldown (Bailout & Daily) ของ ${targetUserId} โดย ${actor.email || actor.name}`,
    });
  }

  /**
   * ระงับผู้ใช้ (Ban User) — สิทธิ์เฉพาะ Creator / Admin++
   */
  public async banUser(
    targetUserId: string,
    reason: string = 'ละเมิดข้อกำหนดการใช้งาน',
    actor: UserProfile
  ): Promise<void> {
    const ls = this.getStorage();
    if (!ls) return;

    try {
      const raw = ls.getItem(LocalAdminStore.BANNED_KEY);
      const bannedMap: Record<string, { bannedAt: number; reason: string }> = raw ? JSON.parse(raw) : {};
      bannedMap[targetUserId] = {
        bannedAt: Date.now(),
        reason,
      };
      ls.setItem(LocalAdminStore.BANNED_KEY, JSON.stringify(bannedMap));

      this.addAuditLog({
        actorEmail: actor.email,
        actorRole: actor.role || 'creator',
        action: 'USER_BAN',
        targetUserId,
        detail: `ระงับบัญชี (Ban) ${targetUserId} ข้อหา: ${reason} โดย ${actor.email || actor.name}`,
      });
    } catch (e) {
      console.error('Failed to ban user:', e);
    }
  }

  /**
   * ปลดแบนผู้ใช้ (Unban User) — สิทธิ์เฉพาะ Creator / Admin++
   */
  public async unbanUser(targetUserId: string, actor: UserProfile): Promise<void> {
    const ls = this.getStorage();
    if (!ls) return;

    try {
      const raw = ls.getItem(LocalAdminStore.BANNED_KEY);
      if (raw) {
        const bannedMap = JSON.parse(raw);
        delete bannedMap[targetUserId];
        ls.setItem(LocalAdminStore.BANNED_KEY, JSON.stringify(bannedMap));
      }

      this.addAuditLog({
        actorEmail: actor.email,
        actorRole: actor.role || 'creator',
        action: 'USER_UNBAN',
        targetUserId,
        detail: `ปลดระงับบัญชี (Unban) ${targetUserId} สำเร็จ โดย ${actor.email || actor.name}`,
      });
    } catch (e) {
      console.error('Failed to unban user:', e);
    }
  }

  /**
   * เปลี่ยนระดับสิทธิ์ของผู้ใช้ (Creator / Admin / Player) — สิทธิ์เฉพาะ Creator (Admin++)
   */
  public async changeUserRole(
    targetUserId: string,
    targetEmail: string | undefined,
    newRole: 'creator' | 'admin' | 'player',
    actor: UserProfile
  ): Promise<void> {
    if (actor.role !== 'creator') {
      throw new Error('เฉพาะผู้สร้าง (Creator / Admin++) เท่านั้นที่มีสิทธิ์เปลี่ยนระดับผู้ใช้');
    }

    const effectiveEmail =
      targetEmail ||
      (targetUserId === 'google_admin_seree'
        ? 'seree999@gmail.com'
        : targetUserId === 'google_creator_songpon'
        ? 'songpon.official@gmail.com'
        : undefined);

    // บันทึก override ทั้ง ID และ Email
    setUserRoleOverride(targetUserId, newRole);
    if (effectiveEmail) {
      setUserRoleOverride(effectiveEmail, newRole);
    }

    const ls = this.getStorage();
    if (ls) {
      try {
        const raw = ls.getItem(LocalAdminStore.REGISTRY_KEY);
        const registry: Record<string, Partial<ManagedUser>> = raw ? JSON.parse(raw) : {};
        const existing = registry[targetUserId] || {};
        registry[targetUserId] = {
          ...existing,
          id: targetUserId,
          name:
            existing.name ||
            (targetUserId === 'google_admin_seree'
              ? 'Seree (Admin)'
              : targetUserId === 'google_creator_songpon'
              ? 'Songpon (Creator)'
              : effectiveEmail || targetUserId),
          email: effectiveEmail || existing.email,
          role: newRole,
          lastActiveAt: Date.now(),
          createdAt: existing.createdAt || Date.now(),
        };
        ls.setItem(LocalAdminStore.REGISTRY_KEY, JSON.stringify(registry));
      } catch (e) {
        console.error('Failed to update user role in registry:', e);
      }
    }

    this.addAuditLog({
      actorEmail: actor.email,
      actorRole: actor.role || 'creator',
      action: newRole === 'player' ? 'ROLE_DEMOTE' : 'ROLE_PROMOTE',
      targetUserId,
      targetName: effectiveEmail || targetUserId,
      detail: `เปลี่ยนระดับสิทธิ์ของ ${effectiveEmail || targetUserId} เป็น ${newRole.toUpperCase()} โดย ${actor.email || actor.name}`,
    });
  }

  /**
   * บันทึก Audit Log ลงระบบ
   */
  public addAuditLog(entry: Omit<AuditRecord, 'id' | 'timestamp'>): void {
    const ls = this.getStorage();
    if (!ls) return;

    try {
      const raw = ls.getItem(LocalAdminStore.AUDIT_KEY);
      const logs: AuditRecord[] = raw ? JSON.parse(raw) : [];

      const record: AuditRecord = {
        ...entry,
        id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: Date.now(),
      };

      logs.unshift(record); // ใส่หน้าสุด
      // เก็บสูงสุด 100 รายการ
      if (logs.length > 100) logs.length = 100;

      ls.setItem(LocalAdminStore.AUDIT_KEY, JSON.stringify(logs));
    } catch (e) {
      console.error('Failed to add audit log:', e);
    }
  }

  /**
   * อ่านรายการ Audit Logs ทั้งหมด
   */
  public getAuditLogs(): AuditRecord[] {
    const ls = this.getStorage();
    if (!ls) return [];

    try {
      const raw = ls.getItem(LocalAdminStore.AUDIT_KEY);
      if (!raw) return [];
      const logs: AuditRecord[] = JSON.parse(raw);
      return logs.sort((a, b) => b.timestamp - a.timestamp);
    } catch {
      return [];
    }
  }

  /**
   * สรุปสถิติภาพรวมของทั้งระบบสำหรับ Dashboard Header
   */
  public async getSystemMetrics(): Promise<{
    totalUsers: number;
    circulatingChips: number;
    totalRounds: number;
    totalBanned: number;
    adminCount: number;
  }> {
    const users = await this.getAllUsers();
    const circulatingChips = users.reduce((acc, u) => acc + (u.balance || 0), 0);
    const totalRounds = users.reduce((acc, u) => acc + (u.totalRounds || 0), 0);
    const totalBanned = users.filter((u) => u.isBanned).length;
    const adminCount = users.filter((u) => u.role === 'admin' || u.role === 'creator').length;

    return {
      totalUsers: users.length,
      circulatingChips,
      totalRounds,
      totalBanned,
      adminCount,
    };
  }
}

