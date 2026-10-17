import { ManagedUser } from '../../domain/entities/ManagedUser';
import { AuditRecord } from '../../domain/entities/AuditLog';
import { UserProfile } from '../../domain/entities/User';
import { resolveUserRole } from '../../domain/constants/AdminConfig';
import { ensureStorageReady, getStorageStatus } from '../../infrastructure/storage/storageProvider';
import { LocalAdminStore } from './LocalAdminStore';
import { D1AdminStore, SystemMetrics } from './D1AdminStore';

/**
 * บริการจัดการผู้ใช้สำหรับ Admin / Creator
 *
 * ที่เก็บหลักคือ Cloudflare D1 (ผ่าน Worker API) และถอยไปใช้ LocalStorage
 * เมื่อต่อฐานข้อมูลไม่ได้ โดยสถานะที่ใช้จริงดูได้จาก getStorageStatus()
 *
 * isUserBanned() และ getAuditLogs() ยังเป็นแบบ synchronous ตามที่ชั้น UI เรียกใช้
 * จึงอ่านจากแคชที่ถูกรีเฟรชตอน getAllUsers() หรือ refreshCaches()
 */
export class AdminService {
  private local = new LocalAdminStore();
  private d1 = new D1AdminStore();

  private bannedCache = new Set<string>();
  private auditCache: AuditRecord[] = [];

  private usingD1(): boolean {
    return getStorageStatus().mode === 'd1';
  }

  /** เรียกตอนเริ่มแอป เพื่อให้แคชแบน/Audit พร้อมใช้ก่อนผู้เล่นกดเล่น */
  public async refreshCaches(): Promise<void> {
    await ensureStorageReady();
    if (!this.usingD1()) return;

    try {
      const [bans, logs] = await Promise.all([this.d1.listBans(), this.d1.getAuditLogs()]);
      this.bannedCache = new Set(bans.map((b) => b.playerId));
      this.auditCache = logs;
    } catch (err) {
      console.error('ไม่สามารถรีเฟรชข้อมูล Admin จาก D1:', err);
    }
  }

  /**
   * บันทึกผู้ใช้เข้าระบบ (เรียกจากขั้นตอนล็อกอิน ซึ่งเป็น synchronous)
   * โหมด D1 จึงยิงแบบ fire-and-forget และเขียน LocalStorage ควบไว้เป็นสำเนา
   */
  public registerUser(user: UserProfile): void {
    this.local.registerUser(user);

    void ensureStorageReady().then(() => {
      if (!this.usingD1()) return;
      this.d1.registerUser(user).catch((err) => {
        console.error('บันทึกผู้ใช้ลง D1 ไม่สำเร็จ:', err);
      });
    });
  }

  public isUserBanned(userId?: string): boolean {
    if (!userId) return false;
    if (this.usingD1()) {
      return this.bannedCache.has(userId);
    }
    return this.local.isUserBanned(userId);
  }

  public async getAllUsers(currentUser?: UserProfile | null): Promise<ManagedUser[]> {
    await ensureStorageReady();

    if (!this.usingD1()) {
      return await this.local.getAllUsers(currentUser);
    }

    if (currentUser) {
      // ให้ผู้ใช้ที่กำลังล็อกอินมีแถวใน D1 ก่อนดึงรายชื่อ
      await this.d1.registerUser(currentUser).catch(() => undefined);
    }

    const [users, bans, logs] = await Promise.all([
      this.d1.getAllUsers(),
      this.d1.listBans(),
      this.d1.getAuditLogs(),
    ]);

    this.bannedCache = new Set(bans.map((b) => b.playerId));
    this.auditCache = logs;

    // กันข้อมูลซ้ำซ้อนไว้อีกชั้น: ตารางบน Dashboard ใช้ user.id เป็น React key
    // ถ้ามี id ซ้ำเข้ามา แถวจะเรนเดอร์ผิดเพี้ยน
    const unique = new Map<string, ManagedUser>();
    for (const user of users) {
      if (!unique.has(user.id)) {
        unique.set(user.id, user);
      }
    }

    const resolved = Array.from(unique.values()).map((user) => {
      const isCurrent =
        Boolean(currentUser) &&
        (user.id === currentUser!.id ||
          (Boolean(currentUser!.email) && user.email === currentUser!.email));

      return {
        ...user,
        // สิทธิ์สุดท้ายตัดสินฝั่ง client เพื่อให้ตรงกับ AdminConfig (อีเมลผู้สร้าง/แอดมินที่ตั้งไว้)
        role: resolveUserRole(user.id, user.email, user.role),
        name: isCurrent ? currentUser!.name : user.name,
        email: isCurrent ? currentUser!.email : user.email,
        picture: isCurrent ? currentUser!.picture || user.picture : user.picture,
        isBanned: this.bannedCache.has(user.id),
      } satisfies ManagedUser;
    });

    return resolved.sort((a, b) => {
      if (a.role === 'creator') return -1;
      if (b.role === 'creator') return 1;
      if (a.role === 'admin' && b.role !== 'admin') return -1;
      if (b.role === 'admin' && a.role !== 'admin') return 1;
      return b.balance - a.balance;
    });
  }

  public async grantChips(
    targetUserId: string,
    amount: number,
    actor: UserProfile
  ): Promise<{ newBalance: number }> {
    await ensureStorageReady();
    return this.usingD1()
      ? await this.d1.grantChips(targetUserId, amount, actor)
      : await this.local.grantChips(targetUserId, amount, actor);
  }

  public async resetWallet(targetUserId: string, actor: UserProfile): Promise<void> {
    await ensureStorageReady();
    if (this.usingD1()) {
      await this.d1.resetWallet(targetUserId, actor);
      return;
    }
    await this.local.resetWallet(targetUserId, actor);
  }

  public async resetCooldowns(targetUserId: string, actor: UserProfile): Promise<void> {
    await ensureStorageReady();
    if (this.usingD1()) {
      await this.d1.resetCooldowns(targetUserId, actor);
      return;
    }
    await this.local.resetCooldowns(targetUserId, actor);
  }

  public async banUser(
    targetUserId: string,
    reason: string = 'ละเมิดข้อกำหนดการใช้งาน',
    actor: UserProfile
  ): Promise<void> {
    await ensureStorageReady();

    if (this.usingD1()) {
      await this.d1.banUser(targetUserId, reason, actor);
      this.bannedCache.add(targetUserId);
      return;
    }
    await this.local.banUser(targetUserId, reason, actor);
  }

  public async unbanUser(targetUserId: string, actor: UserProfile): Promise<void> {
    await ensureStorageReady();

    if (this.usingD1()) {
      await this.d1.unbanUser(targetUserId, actor);
      this.bannedCache.delete(targetUserId);
      return;
    }
    await this.local.unbanUser(targetUserId, actor);
  }

  public async changeUserRole(
    targetUserId: string,
    targetEmail: string | undefined,
    newRole: 'creator' | 'admin' | 'player',
    actor: UserProfile
  ): Promise<void> {
    await ensureStorageReady();

    if (this.usingD1()) {
      await this.d1.changeUserRole(targetUserId, targetEmail, newRole, actor);
      return;
    }
    await this.local.changeUserRole(targetUserId, targetEmail, newRole, actor);
  }

  public addAuditLog(entry: Omit<AuditRecord, 'id' | 'timestamp'>): void {
    if (this.usingD1()) {
      this.d1
        .addAuditLog(entry)
        .then((record) => {
          this.auditCache = [record, ...this.auditCache].slice(0, 100);
        })
        .catch((err) => console.error('บันทึก Audit Log ลง D1 ไม่สำเร็จ:', err));
      return;
    }
    this.local.addAuditLog(entry);
  }

  public getAuditLogs(): AuditRecord[] {
    if (this.usingD1()) {
      return [...this.auditCache].sort((a, b) => b.timestamp - a.timestamp);
    }
    return this.local.getAuditLogs();
  }

  public async getSystemMetrics(): Promise<SystemMetrics> {
    await ensureStorageReady();
    return this.usingD1() ? await this.d1.getSystemMetrics() : await this.local.getSystemMetrics();
  }
}

export const adminService = new AdminService();
