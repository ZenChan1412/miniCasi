import { GAME_RULES } from '../constants/GameRules';

export type BetOption = 'HIGH' | 'LOW' | 'TRIPLE';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export class Bet {
  public static readonly MIN_BET = GAME_RULES.MIN_BET;
  public static readonly MAX_BET = GAME_RULES.MAX_BET;

  constructor(
    public readonly option: BetOption,
    public readonly amount: number
  ) {
    if (!Number.isInteger(amount)) {
      throw new Error('ยอดเดิมพันต้องเป็นจำนวนเต็มเท่านั้น (Integer only)');
    }
  }

  public validate(currentBalance: number): ValidationResult {
    if (this.amount < Bet.MIN_BET) {
      return { isValid: false, error: `เดิมพันขั้นต่ำคือ ${Bet.MIN_BET} ชิป` };
    }
    if (this.amount > Bet.MAX_BET) {
      return { isValid: false, error: `เดิมพันสูงสุดต่อรอบไม่เกิน ${Bet.MAX_BET} ชิป` };
    }
    if (this.amount > currentBalance) {
      return { isValid: false, error: 'ยอดชิปคงเหลือของคุณไม่เพียงพอ' };
    }
    return { isValid: true };
  }
}
