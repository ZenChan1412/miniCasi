import { Bet } from '../entities/Bet';
import { DiceHand } from '../entities/DiceHand';
import { GAME_RULES } from '../constants/GameRules';

export interface PayoutEvaluation {
  won: boolean;
  multiplier: number;
  payoutAmount: number; // รวมทุนที่คืน
  netGain: number;      // กำไรสุทธิ (ถ้าแพ้คือ -amount)
  reason: string;
}

export class PayoutCalculator {
  public static readonly HIGH_LOW_MULTIPLIER = GAME_RULES.PAYOUT_MULTIPLIER_HIGH_LOW;
  public static readonly TRIPLE_MULTIPLIER = GAME_RULES.PAYOUT_MULTIPLIER_TRIPLE;

  public static evaluate(bet: Bet, hand: DiceHand): PayoutEvaluation {
    // กรณีที่ 1: ลูกเต๋าออกตอง (Triple)
    if (hand.isTriple) {
      if (bet.option === 'TRIPLE') {
        const netGain = bet.amount * PayoutCalculator.TRIPLE_MULTIPLIER;
        return {
          won: true,
          multiplier: PayoutCalculator.TRIPLE_MULTIPLIER,
          payoutAmount: bet.amount + netGain,
          netGain: netGain,
          reason: `ลูกเต๋าออกตอง ${hand.dice[0]}-${hand.dice[1]}-${hand.dice[2]}! คุณแทงตอง ชนะรางวัล 30 เท่า!`,
        };
      } else {
        // กฎ House Edge: ถ้าออกตอง ผู้แทง High หรือ Low แพ้
        return {
          won: false,
          multiplier: 0,
          payoutAmount: 0,
          netGain: -bet.amount,
          reason: `ลูกเต๋าออกตอง ${hand.dice[0]}-${hand.dice[1]}-${hand.dice[2]} (เจ้ามือกินเรียบตามกติกาสากล)`,
        };
      }
    }

    // กรณีที่ 2: ลูกเต๋าไม่ออกตอง แต่ผู้เล่นแทงตอง
    if (bet.option === 'TRIPLE') {
      return {
        won: false,
        multiplier: 0,
        payoutAmount: 0,
        netGain: -bet.amount,
        reason: `แต้มรวม ${hand.sum} ไม่ออกตอง คุณแพ้การเดิมพัน`,
      };
    }

    // กรณีที่ 3: แทง HIGH
    if (bet.option === 'HIGH') {
      if (hand.sum >= 11 && hand.sum <= 17) {
        const netGain = bet.amount * PayoutCalculator.HIGH_LOW_MULTIPLIER;
        return {
          won: true,
          multiplier: PayoutCalculator.HIGH_LOW_MULTIPLIER,
          payoutAmount: bet.amount + netGain,
          netGain: netGain,
          reason: `แต้มรวม ${hand.sum} (สูง)! คุณชนะการเดิมพัน`,
        };
      } else {
        return {
          won: false,
          multiplier: 0,
          payoutAmount: 0,
          netGain: -bet.amount,
          reason: `แต้มรวม ${hand.sum} (ต่ำ)! คุณแพ้การเดิมพัน`,
        };
      }
    }

    // กรณีที่ 4: แทง LOW
    if (bet.option === 'LOW') {
      if (hand.sum >= 4 && hand.sum <= 10) {
        const netGain = bet.amount * PayoutCalculator.HIGH_LOW_MULTIPLIER;
        return {
          won: true,
          multiplier: PayoutCalculator.HIGH_LOW_MULTIPLIER,
          payoutAmount: bet.amount + netGain,
          netGain: netGain,
          reason: `แต้มรวม ${hand.sum} (ต่ำ)! คุณชนะการเดิมพัน`,
        };
      } else {
        return {
          won: false,
          multiplier: 0,
          payoutAmount: 0,
          netGain: -bet.amount,
          reason: `แต้มรวม ${hand.sum} (สูง)! คุณแพ้การเดิมพัน`,
        };
      }
    }

    return {
      won: false,
      multiplier: 0,
      payoutAmount: 0,
      netGain: -bet.amount,
      reason: 'การเดิมพันไม่ตรงเงื่อนไข',
    };
  }
}
