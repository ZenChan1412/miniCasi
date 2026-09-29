export class DiceHand {
  public readonly sum: number;
  public readonly isTriple: boolean;

  constructor(public readonly dice: [number, number, number]) {
    for (const die of dice) {
      if (!Number.isInteger(die) || die < 1 || die > 6) {
        throw new Error(`แต้มลูกเต๋าไม่ถูกต้อง: ${die} (ต้องเป็น 1 ถึง 6)`);
      }
    }
    this.sum = dice[0] + dice[1] + dice[2];
    this.isTriple = dice[0] === dice[1] && dice[1] === dice[2];
  }

  /**
   * สรุปหมวดหมู่ผลลัพธ์ของมือนี้
   * ถ้าเป็นตอง ให้ถือเป็น TRIPLE
   * ถ้าผลรวม 4-10 คือ LOW
   * ถ้าผลรวม 11-17 คือ HIGH
   */
  public getCategory(): 'LOW' | 'HIGH' | 'TRIPLE' {
    if (this.isTriple) {
      return 'TRIPLE';
    }
    return this.sum >= 11 ? 'HIGH' : 'LOW';
  }
}
