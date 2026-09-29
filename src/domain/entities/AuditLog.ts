export type AuditAction =
  | 'CHIP_GRANT'
  | 'WALLET_RESET'
  | 'COOLDOWN_RESET'
  | 'USER_BAN'
  | 'USER_UNBAN'
  | 'ROLE_PROMOTE'
  | 'ROLE_DEMOTE'
  | 'GAME_ROLL'
  | 'BAILOUT_CLAIM'
  | 'DAILY_CLAIM';

export interface AuditRecord {
  id: string;
  timestamp: number;
  actorEmail?: string;
  actorRole: string;
  action: AuditAction;
  targetUserId: string;
  targetName?: string;
  detail: string;
  amount?: number;
  balanceBefore?: number;
  balanceAfter?: number;
}
