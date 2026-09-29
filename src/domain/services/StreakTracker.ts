export interface RoadmapItem {
  id: string;
  dice: [number, number, number];
  sum: number;
  category: 'HIGH' | 'LOW' | 'TRIPLE';
  isTriple: boolean;
  playerWon: boolean;
  timestamp: number;
}

export interface PlayerStats {
  totalRounds: number;
  wins: number;
  losses: number;
  winRatePercentage: number;
  currentStreak: number;
  maxStreak: number;
  biggestWin: number;
  roadmap: RoadmapItem[];
}

export class StreakTracker {
  public static readonly MAX_ROADMAP_ITEMS = 15;

  public static createDefaultStats(): PlayerStats {
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

  public static updateStats(
    current: PlayerStats,
    newItem: RoadmapItem,
    netGain: number
  ): PlayerStats {
    const isWin = newItem.playerWon;
    const totalRounds = current.totalRounds + 1;
    const wins = isWin ? current.wins + 1 : current.wins;
    const losses = isWin ? current.losses : current.losses + 1;
    const winRatePercentage = Math.round((wins / totalRounds) * 100);

    const currentStreak = isWin ? current.currentStreak + 1 : 0;
    const maxStreak = Math.max(current.maxStreak, currentStreak);
    const biggestWin = isWin ? Math.max(current.biggestWin, netGain) : current.biggestWin;

    const roadmap = [newItem, ...current.roadmap].slice(0, StreakTracker.MAX_ROADMAP_ITEMS);

    return {
      totalRounds,
      wins,
      losses,
      winRatePercentage,
      currentStreak,
      maxStreak,
      biggestWin,
      roadmap,
    };
  }
}
