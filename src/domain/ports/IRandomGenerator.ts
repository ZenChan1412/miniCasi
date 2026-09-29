export interface IRandomGenerator {
  /**
   * สุ่มแต้มลูกเต๋า 1 ลูก (1 ถึง 6)
   */
  rollSingleDie(): number;

  /**
   * สุ่มแต้มลูกเต๋า 3 ลูก
   */
  rollDiceHand(): [number, number, number];
}
