export interface ManagedUser {
  id: string;               // e.g. "guest", "google_12345...", "mock_abc..."
  name: string;             // Display Name
  email?: string;           // Email
  picture?: string;         // Avatar URL
  provider?: 'google' | 'mock' | 'guest';
  role: 'creator' | 'admin' | 'player'; // Role
  isBanned: boolean;        // Ban status
  banReason?: string;
  bannedAt?: number;
  balance: number;          // Live chip balance
  totalRounds: number;      // Rounds played
  winRate: number;          // Win rate %
  biggestWin: number;
  currentStreak: number;
  lastBailoutAt?: number;
  lastDailyClaimAt?: number;
  lastActiveAt: number;     // Timestamp
  createdAt: number;
}
