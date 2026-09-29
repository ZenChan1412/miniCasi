import { BetOption } from '../../domain/entities/Bet';
import { PlayerStats, RoadmapItem } from '../../domain/services/StreakTracker';

export interface PlayRoundInput {
  option: BetOption;
  amount: number;
}

export interface PlayRoundOutput {
  dice: [number, number, number];
  sum: number;
  category: 'HIGH' | 'LOW' | 'TRIPLE';
  isTriple: boolean;
  won: boolean;
  multiplier: number;
  payoutAmount: number;
  netGain: number;
  newBalance: number;
  reason: string;
  stats: PlayerStats;
  roadmapItem: RoadmapItem;
}

export interface BailoutOutput {
  claimedAmount: number;
  newBalance: number;
  cooldownRemainingSeconds: number;
}

export interface DailyClaimOutput {
  claimedAmount: number;
  newBalance: number;
  cooldownRemainingSeconds: number;
}
