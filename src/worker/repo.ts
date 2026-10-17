import { GAME_RULES } from '../domain/constants/GameRules';
import { WalletState } from '../domain/entities/VirtualWallet';
import { PlayerStats, RoadmapItem } from '../domain/services/StreakTracker';
import { ManagedUser } from '../domain/entities/ManagedUser';
import { AuditRecord } from '../domain/entities/AuditLog';
import { UserProfile } from '../domain/entities/User';
import { D1Database } from './types';

export const GUEST_ID = 'guest';

/** ชื่อตารางทั้งหมดที่ระบบใช้ ใช้ทั้งใน health check และหน้าแสดงสถานะฐานข้อมูล */
export const APP_TABLES = [
  'players',
  'virtual_wallets',
  'player_stats',
  'game_rounds',
  'wallet_transactions',
  'user_bans',
  'role_overrides',
  'audit_logs',
  'payment_orders',
] as const;

function now(): number {
  return Date.now();
}

function walletIdFor(playerId: string): string {
  return `w_${playerId}`;
}

function newId(prefix: string): string {
  return `${prefix}_${now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/* ------------------------------------------------------------------ */
/* Players                                                             */
/* ------------------------------------------------------------------ */

/**
 * สร้างแถวผู้เล่นหากยังไม่มี (upsert) — ทุก endpoint ที่แตะ wallet/stats ต้องเรียกก่อน
 * เพราะ virtual_wallets และ player_stats มี FOREIGN KEY ชี้มาที่ players.id
 */
export async function ensurePlayer(
  db: D1Database,
  playerId: string,
  profile?: Partial<UserProfile>
): Promise<void> {
  const ts = now();
  const nickname = profile?.name || (playerId === GUEST_ID ? 'ผู้เล่นทั่วไป (Guest)' : playerId);
  const provider = profile?.provider || (playerId === GUEST_ID ? 'guest' : 'google');

  // เมื่อเรียกแบบไม่มี profile (เช่นจาก getWallet) ห้ามเขียนทับโปรไฟล์ที่ล็อกอินบันทึกไว้แล้ว
  const hasProfile = profile?.name ? 1 : 0;

  await db
    .prepare(
      `INSERT INTO players (id, nickname, email, picture, provider, role, is_active, created_at, last_active_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         nickname       = CASE WHEN ? = 1 THEN excluded.nickname ELSE players.nickname END,
         email          = COALESCE(excluded.email, players.email),
         picture        = COALESCE(excluded.picture, players.picture),
         provider       = CASE WHEN ? = 1 THEN excluded.provider ELSE players.provider END,
         last_active_at = excluded.last_active_at`
    )
    .bind(
      playerId,
      nickname,
      profile?.email ?? null,
      profile?.picture ?? null,
      provider,
      // ห้ามเชื่อ role จาก client — ผู้เล่นใหม่เป็น 'player' เสมอ (สิทธิ์จริงมาจาก role_overrides/AdminConfig)
      'player',
      ts,
      ts,
      hasProfile,
      hasProfile
    )
    .run();
}

export async function registerUser(db: D1Database, profile: UserProfile): Promise<void> {
  await ensurePlayer(db, profile.id, profile);
  // สร้างกระเป๋าและสถิติรอไว้ เพื่อให้ผู้ใช้ปรากฏบน Dashboard ทันทีที่ล็อกอิน
  await getWallet(db, profile.id);
  await getStats(db, profile.id);
}

/* ------------------------------------------------------------------ */
/* Wallet                                                              */
/* ------------------------------------------------------------------ */

interface WalletRow {
  wallet_id: string;
  balance: number;
  last_bailout_at: number;
  last_daily_claim_at: number;
}

function rowToWallet(row: WalletRow): WalletState {
  return {
    walletId: row.wallet_id,
    balance: row.balance,
    lastBailoutAt: row.last_bailout_at,
    lastDailyClaimAt: row.last_daily_claim_at,
  };
}

export async function getWallet(db: D1Database, playerId: string): Promise<WalletState> {
  await ensurePlayer(db, playerId);

  const row = await db
    .prepare(
      `SELECT wallet_id, balance, last_bailout_at, last_daily_claim_at
         FROM virtual_wallets WHERE player_id = ?`
    )
    .bind(playerId)
    .first<WalletRow>();

  if (row) {
    return rowToWallet(row);
  }

  return await createWallet(db, playerId);
}

async function createWallet(db: D1Database, playerId: string): Promise<WalletState> {
  const ts = now();
  const walletId = walletIdFor(playerId);

  await db
    .prepare(
      `INSERT INTO virtual_wallets
         (wallet_id, player_id, balance, last_bailout_at, last_daily_claim_at, version, updated_at)
       VALUES (?, ?, ?, 0, 0, 1, ?)
       ON CONFLICT (player_id) DO NOTHING`
    )
    .bind(walletId, playerId, GAME_RULES.INITIAL_BALANCE, ts)
    .run();

  await recordTransaction(db, {
    walletId,
    txnType: 'INITIAL_GRANT',
    amount: GAME_RULES.INITIAL_BALANCE,
    balanceBefore: 0,
    balanceAfter: GAME_RULES.INITIAL_BALANCE,
    notes: 'แจกชิปเริ่มต้นเมื่อสร้างกระเป๋าใหม่',
  });

  return {
    walletId,
    balance: GAME_RULES.INITIAL_BALANCE,
    lastBailoutAt: 0,
    lastDailyClaimAt: 0,
  };
}

export async function saveWallet(
  db: D1Database,
  playerId: string,
  state: WalletState
): Promise<WalletState> {
  const existing = await getWallet(db, playerId);
  const ts = now();

  await db
    .prepare(
      `UPDATE virtual_wallets
          SET balance = ?, last_bailout_at = ?, last_daily_claim_at = ?,
              version = version + 1, updated_at = ?
        WHERE player_id = ?`
    )
    .bind(
      Math.max(0, Math.floor(state.balance)),
      state.lastBailoutAt,
      state.lastDailyClaimAt,
      ts,
      playerId
    )
    .run();

  await db
    .prepare('UPDATE players SET last_active_at = ? WHERE id = ?')
    .bind(ts, playerId)
    .run();

  // บันทึก ledger เฉพาะเมื่อยอดเปลี่ยน เพื่อให้ wallet_transactions ตรวจสอบย้อนหลังได้
  const delta = Math.floor(state.balance) - existing.balance;
  if (delta !== 0) {
    await recordTransaction(db, {
      walletId: existing.walletId,
      txnType: delta > 0 ? 'BET_PAYOUT' : 'BET_DEDUCT',
      amount: delta,
      balanceBefore: existing.balance,
      balanceAfter: Math.max(0, Math.floor(state.balance)),
      notes: 'ปรับยอดจากการบันทึกกระเป๋า',
    });
  }

  return await getWallet(db, playerId);
}

export async function resetWallet(db: D1Database, playerId: string): Promise<WalletState> {
  const existing = await getWallet(db, playerId);
  const ts = now();

  await db
    .prepare(
      `UPDATE virtual_wallets
          SET balance = ?, last_bailout_at = 0, last_daily_claim_at = 0,
              version = version + 1, updated_at = ?
        WHERE player_id = ?`
    )
    .bind(GAME_RULES.INITIAL_BALANCE, ts, playerId)
    .run();

  await recordTransaction(db, {
    walletId: existing.walletId,
    txnType: 'RESET',
    amount: GAME_RULES.INITIAL_BALANCE - existing.balance,
    balanceBefore: existing.balance,
    balanceAfter: GAME_RULES.INITIAL_BALANCE,
    notes: 'รีเซ็ตกระเป๋ากลับค่าเริ่มต้น',
  });

  return await getWallet(db, playerId);
}

interface TransactionInput {
  walletId: string;
  txnType:
    | 'INITIAL_GRANT'
    | 'BET_DEDUCT'
    | 'BET_PAYOUT'
    | 'BAILOUT'
    | 'DAILY_BONUS'
    | 'RESET'
    | 'PURCHASE'
    | 'ADMIN_GRANT';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  relatedRoundId?: string | null;
  notes?: string;
}

async function recordTransaction(db: D1Database, input: TransactionInput): Promise<void> {
  await db
    .prepare(
      `INSERT INTO wallet_transactions
         (id, wallet_id, related_round_id, txn_type, amount, balance_before, balance_after, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      newId('txn'),
      input.walletId,
      input.relatedRoundId ?? null,
      input.txnType,
      input.amount,
      input.balanceBefore,
      input.balanceAfter,
      input.notes ?? null,
      now()
    )
    .run();
}

/* ------------------------------------------------------------------ */
/* Payment orders (เติมชิปด้วยเงินจริงผ่าน PromptPay)                   */
/* ------------------------------------------------------------------ */

export type PaymentOrderStatus = 'pending' | 'paid' | 'expired' | 'failed';

export interface PaymentOrder {
  id: string;
  playerId: string;
  transactionId: string;
  amountThb: number;
  chips: number;
  status: PaymentOrderStatus;
  qrUrl: string | null;
  payload: string | null;
  expiresAt: number | null;
  createdAt: number;
  paidAt: number | null;
}

export interface CreatePaymentOrderInput {
  playerId: string;
  transactionId: string;
  chips: number;
  amountThb: number;
  qrUrl?: string;
  payload?: string;
  expiresAt?: number;
}

interface PaymentOrderRow {
  id: string;
  player_id: string;
  transaction_id: string;
  amount_thb: number;
  chips: number;
  status: PaymentOrderStatus;
  qr_url: string | null;
  payload: string | null;
  expires_at: number | null;
  created_at: number;
  paid_at: number | null;
}

function rowToPaymentOrder(row: PaymentOrderRow): PaymentOrder {
  return {
    id: row.id,
    playerId: row.player_id,
    transactionId: row.transaction_id,
    amountThb: row.amount_thb,
    chips: row.chips,
    status: row.status,
    qrUrl: row.qr_url,
    payload: row.payload,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    paidAt: row.paid_at,
  };
}

export async function createPaymentOrder(
  db: D1Database,
  input: CreatePaymentOrderInput
): Promise<PaymentOrder> {
  await ensurePlayer(db, input.playerId);

  const order: PaymentOrder = {
    id: newId('pay'),
    playerId: input.playerId,
    transactionId: input.transactionId,
    amountThb: input.amountThb,
    chips: input.chips,
    status: 'pending',
    qrUrl: input.qrUrl ?? null,
    payload: input.payload ?? null,
    expiresAt: input.expiresAt ?? null,
    createdAt: now(),
    paidAt: null,
  };

  await db
    .prepare(
      `INSERT INTO payment_orders
         (id, player_id, transaction_id, amount_thb, chips, status, qr_url, payload, expires_at, created_at, paid_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, NULL)
       ON CONFLICT (transaction_id) DO NOTHING`
    )
    .bind(
      order.id,
      order.playerId,
      order.transactionId,
      order.amountThb,
      order.chips,
      order.qrUrl,
      order.payload,
      order.expiresAt,
      order.createdAt
    )
    .run();

  return order;
}

export async function getPaymentOrder(
  db: D1Database,
  transactionId: string
): Promise<PaymentOrder | null> {
  const row = await db
    .prepare(
      `SELECT id, player_id, transaction_id, amount_thb, chips, status,
              qr_url, payload, expires_at, created_at, paid_at
         FROM payment_orders WHERE transaction_id = ?`
    )
    .bind(transactionId)
    .first<PaymentOrderRow>();

  return row ? rowToPaymentOrder(row) : null;
}

/**
 * เคลียร์ยอดเมื่อ Gateway ยืนยันว่าชำระสำเร็จ
 *
 * ทำเป็นสองจังหวะโดย "จองสิทธิ์" ด้วย UPDATE ... WHERE status = 'pending' ก่อน
 * ถ้า changes = 0 แปลว่ารายการนี้ถูกเคลียร์ไปแล้ว (หรือไม่มีอยู่) จึงไม่เติมชิปซ้ำ
 * แม้ผู้ใช้จะกดตรวจสอบหลายครั้งหรือเปิดหลายแท็บพร้อมกัน
 */
export async function settlePaymentOrder(
  db: D1Database,
  transactionId: string
): Promise<{ order: PaymentOrder; newBalance: number } | null> {
  const claim = await db
    .prepare(
      `UPDATE payment_orders SET status = 'paid', paid_at = ?
        WHERE transaction_id = ? AND status = 'pending'`
    )
    .bind(now(), transactionId)
    .run();

  if (!claim.meta.changes) {
    return null;
  }

  const order = await getPaymentOrder(db, transactionId);
  if (!order) return null;

  const wallet = await getWallet(db, order.playerId);
  const newBalance = wallet.balance + order.chips;

  await db
    .prepare(
      `UPDATE virtual_wallets
          SET balance = ?, version = version + 1, updated_at = ?
        WHERE player_id = ?`
    )
    .bind(newBalance, now(), order.playerId)
    .run();

  await recordTransaction(db, {
    walletId: wallet.walletId,
    txnType: 'PURCHASE',
    amount: order.chips,
    balanceBefore: wallet.balance,
    balanceAfter: newBalance,
    notes: `เติมชิปด้วย PromptPay สำเร็จ (${order.amountThb} บาท · ${order.transactionId})`,
  });

  await db
    .prepare('UPDATE players SET last_active_at = ? WHERE id = ?')
    .bind(now(), order.playerId)
    .run();

  return { order, newBalance };
}

/* ------------------------------------------------------------------ */
/* Stats                                                               */
/* ------------------------------------------------------------------ */

interface StatsRow {
  total_games: number;
  wins: number;
  losses: number;
  current_streak: number;
  max_streak: number;
  biggest_win: number;
  roadmap_json: string;
}

function defaultStats(): PlayerStats {
  return {
    totalRounds: 0,
    wins: 0,
    losses: 0,
    winRatePercentage: 0,
    currentStreak: 0,
    maxStreak: 0,
    biggestWin: 0,
    roadmap: [],
  };
}

function rowToStats(row: StatsRow): PlayerStats {
  let roadmap: RoadmapItem[] = [];
  try {
    roadmap = JSON.parse(row.roadmap_json || '[]') as RoadmapItem[];
  } catch {
    roadmap = [];
  }

  return {
    totalRounds: row.total_games,
    wins: row.wins,
    losses: row.losses,
    winRatePercentage: row.total_games > 0 ? Math.round((row.wins / row.total_games) * 100) : 0,
    currentStreak: row.current_streak,
    maxStreak: row.max_streak,
    biggestWin: row.biggest_win,
    roadmap,
  };
}

export async function getStats(db: D1Database, playerId: string): Promise<PlayerStats> {
  await ensurePlayer(db, playerId);

  const row = await db
    .prepare(
      `SELECT total_games, wins, losses, current_streak, max_streak, biggest_win, roadmap_json
         FROM player_stats WHERE player_id = ?`
    )
    .bind(playerId)
    .first<StatsRow>();

  if (row) {
    return rowToStats(row);
  }

  await saveStats(db, playerId, defaultStats());
  return defaultStats();
}

export async function saveStats(
  db: D1Database,
  playerId: string,
  stats: PlayerStats
): Promise<PlayerStats> {
  await ensurePlayer(db, playerId);

  await db
    .prepare(
      `INSERT INTO player_stats
         (player_id, total_games, wins, losses, current_streak, max_streak, biggest_win, roadmap_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (player_id) DO UPDATE SET
         total_games    = excluded.total_games,
         wins           = excluded.wins,
         losses         = excluded.losses,
         current_streak = excluded.current_streak,
         max_streak     = excluded.max_streak,
         biggest_win    = excluded.biggest_win,
         roadmap_json   = excluded.roadmap_json,
         updated_at     = excluded.updated_at`
    )
    .bind(
      playerId,
      Math.max(0, stats.totalRounds),
      Math.max(0, stats.wins),
      Math.max(0, stats.losses),
      Math.max(0, stats.currentStreak),
      Math.max(0, stats.maxStreak),
      Math.max(0, stats.biggestWin),
      JSON.stringify(stats.roadmap ?? []),
      now()
    )
    .run();

  return stats;
}

export async function resetStats(db: D1Database, playerId: string): Promise<PlayerStats> {
  return await saveStats(db, playerId, defaultStats());
}

/* ------------------------------------------------------------------ */
/* Bans                                                                */
/* ------------------------------------------------------------------ */

export interface BanEntry {
  playerId: string;
  reason: string;
  bannedAt: number;
}

export async function listBans(db: D1Database): Promise<BanEntry[]> {
  const res = await db
    .prepare('SELECT player_id, reason, banned_at FROM user_bans ORDER BY banned_at DESC')
    .all<{ player_id: string; reason: string; banned_at: number }>();

  return res.results.map((r) => ({
    playerId: r.player_id,
    reason: r.reason,
    bannedAt: r.banned_at,
  }));
}

export async function banUser(
  db: D1Database,
  playerId: string,
  reason: string,
  bannedBy?: string
): Promise<void> {
  await ensurePlayer(db, playerId);
  await db
    .prepare(
      `INSERT INTO user_bans (player_id, reason, banned_by, banned_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (player_id) DO UPDATE SET
         reason    = excluded.reason,
         banned_by = excluded.banned_by,
         banned_at = excluded.banned_at`
    )
    .bind(playerId, reason, bannedBy ?? null, now())
    .run();

  await db.prepare('UPDATE players SET is_active = 0 WHERE id = ?').bind(playerId).run();
}

export async function unbanUser(db: D1Database, playerId: string): Promise<void> {
  await db.prepare('DELETE FROM user_bans WHERE player_id = ?').bind(playerId).run();
  await db.prepare('UPDATE players SET is_active = 1 WHERE id = ?').bind(playerId).run();
}

/* ------------------------------------------------------------------ */
/* Role overrides                                                      */
/* ------------------------------------------------------------------ */

export type Role = 'creator' | 'admin' | 'player';

export async function listRoleOverrides(db: D1Database): Promise<Record<string, Role>> {
  const res = await db
    .prepare('SELECT identifier, role FROM role_overrides')
    .all<{ identifier: string; role: Role }>();

  const map: Record<string, Role> = {};
  for (const row of res.results) {
    map[row.identifier] = row.role;
  }
  return map;
}

export async function setRoleOverride(
  db: D1Database,
  identifier: string,
  role: Role,
  assignedBy?: string
): Promise<void> {
  const normalized = identifier.trim().toLowerCase();
  if (!normalized) return;

  await db
    .prepare(
      `INSERT INTO role_overrides (identifier, role, assigned_by, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (identifier) DO UPDATE SET
         role        = excluded.role,
         assigned_by = excluded.assigned_by,
         updated_at  = excluded.updated_at`
    )
    .bind(normalized, role, assignedBy ?? null, now())
    .run();

  // ให้แถวใน players สะท้อนสิทธิ์ล่าสุดด้วย เผื่อ identifier เป็น player id
  await db
    .prepare('UPDATE players SET role = ? WHERE id = ? OR LOWER(email) = ?')
    .bind(role, identifier, normalized)
    .run();
}

/* ------------------------------------------------------------------ */
/* Audit logs                                                          */
/* ------------------------------------------------------------------ */

export async function addAuditLog(
  db: D1Database,
  entry: Omit<AuditRecord, 'id' | 'timestamp'>
): Promise<AuditRecord> {
  const record: AuditRecord = {
    ...entry,
    id: newId('aud'),
    timestamp: now(),
  };

  await db
    .prepare(
      `INSERT INTO audit_logs
         (id, actor_email, actor_role, action, target_user_id, target_name,
          amount, balance_before, balance_after, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      record.id,
      record.actorEmail ?? null,
      record.actorRole,
      record.action,
      record.targetUserId,
      record.targetName ?? null,
      record.amount ?? null,
      record.balanceBefore ?? null,
      record.balanceAfter ?? null,
      record.detail,
      record.timestamp
    )
    .run();

  return record;
}

export async function listAuditLogs(db: D1Database, limit = 100): Promise<AuditRecord[]> {
  const res = await db
    .prepare(
      `SELECT id, actor_email, actor_role, action, target_user_id, target_name,
              amount, balance_before, balance_after, detail, created_at
         FROM audit_logs ORDER BY created_at DESC LIMIT ?`
    )
    .bind(Math.min(Math.max(1, limit), 500))
    .all<Record<string, unknown>>();

  return res.results.map((r) => ({
    id: r.id as string,
    timestamp: r.created_at as number,
    actorEmail: (r.actor_email as string) ?? undefined,
    actorRole: r.actor_role as string,
    action: r.action as AuditRecord['action'],
    targetUserId: r.target_user_id as string,
    targetName: (r.target_name as string) ?? undefined,
    amount: (r.amount as number) ?? undefined,
    balanceBefore: (r.balance_before as number) ?? undefined,
    balanceAfter: (r.balance_after as number) ?? undefined,
    detail: r.detail as string,
  }));
}

/* ------------------------------------------------------------------ */
/* Admin listings                                                      */
/* ------------------------------------------------------------------ */

/**
 * รวมข้อมูลผู้เล่น + กระเป๋า + สถิติ + สถานะแบน ไว้ในคำสั่งเดียว
 * ใช้เป็นแหล่งข้อมูลหลักของหน้า Admin Dashboard
 */
export async function listManagedUsers(db: D1Database): Promise<ManagedUser[]> {
  const res = await db
    .prepare(
      `SELECT p.id, p.nickname, p.email, p.picture, p.provider, p.role,
              p.created_at, p.last_active_at,
              COALESCE(w.balance, 0)             AS balance,
              COALESCE(w.last_bailout_at, 0)     AS last_bailout_at,
              COALESCE(w.last_daily_claim_at, 0) AS last_daily_claim_at,
              COALESCE(s.total_games, 0)         AS total_games,
              COALESCE(s.wins, 0)                AS wins,
              COALESCE(s.biggest_win, 0)         AS biggest_win,
              COALESCE(s.current_streak, 0)      AS current_streak,
              b.player_id                        AS banned_id,
              b.reason                           AS ban_reason,
              b.banned_at                        AS banned_at,
              -- ใช้ subquery ไม่ใช่ JOIN: override ถูกบันทึกทั้ง player id และอีเมลของคนเดียวกัน
              -- การ JOIN ด้วย OR จะทำให้ผู้ใช้หนึ่งคนแตกเป็นหลายแถว (ข้อมูลซ้ำบน Dashboard)
              -- ลำดับความสำคัญ: override ตาม id > override ตามอีเมล > role ในตาราง players
              COALESCE(
                (SELECT role FROM role_overrides WHERE identifier = p.id),
                (SELECT role FROM role_overrides WHERE identifier = LOWER(p.email))
              )                                  AS override_role
         FROM players p
         LEFT JOIN virtual_wallets w ON w.player_id = p.id
         LEFT JOIN player_stats   s ON s.player_id = p.id
         LEFT JOIN user_bans      b ON b.player_id = p.id
        ORDER BY balance DESC`
    )
    .all<Record<string, unknown>>();

  return res.results.map((r) => {
    const totalGames = (r.total_games as number) || 0;
    const wins = (r.wins as number) || 0;

    return {
      id: r.id as string,
      name: (r.nickname as string) || (r.id as string),
      email: (r.email as string) ?? undefined,
      picture: (r.picture as string) ?? undefined,
      provider: (r.provider as ManagedUser['provider']) ?? 'guest',
      role: ((r.override_role as Role) || (r.role as Role) || 'player') as ManagedUser['role'],
      isBanned: Boolean(r.banned_id),
      banReason: (r.ban_reason as string) ?? undefined,
      bannedAt: (r.banned_at as number) ?? undefined,
      balance: (r.balance as number) || 0,
      totalRounds: totalGames,
      winRate: totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0,
      biggestWin: (r.biggest_win as number) || 0,
      currentStreak: (r.current_streak as number) || 0,
      lastBailoutAt: (r.last_bailout_at as number) || 0,
      lastDailyClaimAt: (r.last_daily_claim_at as number) || 0,
      lastActiveAt: (r.last_active_at as number) || 0,
      createdAt: (r.created_at as number) || 0,
    };
  });
}

export interface SystemMetrics {
  totalUsers: number;
  circulatingChips: number;
  totalRounds: number;
  totalBanned: number;
  adminCount: number;
}

export async function getSystemMetrics(db: D1Database): Promise<SystemMetrics> {
  const row = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM players)                      AS total_users,
         (SELECT COALESCE(SUM(balance), 0) FROM virtual_wallets) AS circulating_chips,
         (SELECT COALESCE(SUM(total_games), 0) FROM player_stats) AS total_rounds,
         (SELECT COUNT(*) FROM user_bans)                    AS total_banned`
    )
    .first<Record<string, number>>();

  // นับแอดมินจากสิทธิ์ที่ resolve แล้ว (override ทับ role ในตาราง players)
  const users = await listManagedUsers(db);
  const adminCount = users.filter((u) => u.role === 'admin' || u.role === 'creator').length;

  return {
    totalUsers: row?.total_users ?? 0,
    circulatingChips: row?.circulating_chips ?? 0,
    totalRounds: row?.total_rounds ?? 0,
    totalBanned: row?.total_banned ?? 0,
    adminCount,
  };
}

/* ------------------------------------------------------------------ */
/* Health                                                             */
/* ------------------------------------------------------------------ */

export interface TableHealth {
  name: string;
  exists: boolean;
  rows: number;
}

export interface HealthReport {
  ok: boolean;
  database: string;
  latencyMs: number;
  checkedAt: number;
  tables: TableHealth[];
  error?: string;
}

/**
 * ตรวจสอบการเชื่อมต่อ D1 จริง: ping, เทียบรายชื่อตารางกับที่ migration ต้องมี, นับจำนวนแถว
 */
export async function checkHealth(db: D1Database): Promise<HealthReport> {
  const startedAt = Date.now();

  try {
    await db.prepare('SELECT 1 AS ping').first();

    const existing = await db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all<{ name: string }>();
    const existingNames = new Set(existing.results.map((r) => r.name));

    const tables: TableHealth[] = [];
    for (const name of APP_TABLES) {
      if (!existingNames.has(name)) {
        tables.push({ name, exists: false, rows: 0 });
        continue;
      }
      const countRow = await db.prepare(`SELECT COUNT(*) AS c FROM ${name}`).first<{ c: number }>();
      tables.push({ name, exists: true, rows: countRow?.c ?? 0 });
    }

    return {
      ok: tables.every((t) => t.exists),
      database: 'mini-casino-db',
      latencyMs: Date.now() - startedAt,
      checkedAt: Date.now(),
      tables,
    };
  } catch (err) {
    return {
      ok: false,
      database: 'mini-casino-db',
      latencyMs: Date.now() - startedAt,
      checkedAt: Date.now(),
      tables: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/* ------------------------------------------------------------------ */
/* Admin actions (เรียกจาก endpoint ที่ผ่าน authenticate แล้วเท่านั้น)    */
/* ------------------------------------------------------------------ */

/** เพิ่มชิปแบบ atomic (balance = balance + ?) แล้วบันทึก wallet_transactions */
export async function grantChips(
  db: D1Database,
  playerId: string,
  amount: number
): Promise<{ before: number; newBalance: number }> {
  const wallet = await getWallet(db, playerId);
  const row = await db
    .prepare(
      `UPDATE virtual_wallets
          SET balance = balance + ?, version = version + 1, updated_at = ?
        WHERE player_id = ?
        RETURNING balance`
    )
    .bind(amount, now(), playerId)
    .first<{ balance: number }>();
  const newBalance = row?.balance ?? wallet.balance + amount;

  await recordTransaction(db, {
    walletId: wallet.walletId,
    txnType: 'ADMIN_GRANT',
    amount,
    balanceBefore: newBalance - amount,
    balanceAfter: newBalance,
    notes: 'ผู้ดูแลระบบเพิ่มชิปให้',
  });
  return { before: newBalance - amount, newBalance };
}

/** ล้าง cooldown ของ Bailout และ Daily */
export async function resetCooldowns(db: D1Database, playerId: string): Promise<void> {
  await getWallet(db, playerId);
  await db
    .prepare(
      `UPDATE virtual_wallets
          SET last_bailout_at = 0, last_daily_claim_at = 0, version = version + 1, updated_at = ?
        WHERE player_id = ?`
    )
    .bind(now(), playerId)
    .run();
}

/** id + อีเมลของผู้เล่น (null ถ้าไม่มีในตาราง players) */
export async function getPlayerIdentity(
  db: D1Database,
  playerId: string
): Promise<{ id: string; email: string | null; nickname: string } | null> {
  return await db
    .prepare('SELECT id, email, nickname FROM players WHERE id = ?')
    .bind(playerId)
    .first<{ id: string; email: string | null; nickname: string }>();
}

/** รายการ player_id ที่ถูกแบน (ไม่มีเหตุผล) — ใช้เป็น public endpoint */
export async function listBannedIds(db: D1Database): Promise<string[]> {
  const res = await db.prepare('SELECT player_id FROM user_bans').all<{ player_id: string }>();
  return res.results.map((r) => r.player_id);
}

/** ใช้โค้ดแจกชิป — เติมชิปตามจำนวนที่โค้ดระบุ (ไม่จำกัดครั้ง) */
export async function redeemCode(
  db: D1Database,
  playerId: string,
  chips: number
): Promise<{ newBalance: number }> {
  const { newBalance } = await grantChips(db, playerId, chips);
  return { newBalance };
}
