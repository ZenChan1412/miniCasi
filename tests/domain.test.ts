import { describe, it, expect } from 'bun:test';
import { Bet } from '../src/domain/entities/Bet';
import { DiceHand } from '../src/domain/entities/DiceHand';
import { VirtualWallet } from '../src/domain/entities/VirtualWallet';
import { PayoutCalculator } from '../src/domain/services/PayoutCalculator';

describe('Domain: Bet Entity Validation', () => {
  it('ควรผ่านเมื่อเดิมพันถูกต้องอยู่ในช่วง 10 - 500 ชิป', () => {
    const bet = new Bet('HIGH', 50);
    const result = bet.validate(1000);
    expect(result.isValid).toBe(true);
  });

  it('ควรล้มเหลวเมื่อเดิมพันต่ำกว่าขั้นต่ำ 10 ชิป', () => {
    const bet = new Bet('LOW', 5);
    const result = bet.validate(1000);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('เดิมพันขั้นต่ำคือ 10');
  });

  it('ควรล้มเหลวเมื่อเดิมพันเกินขีดจำกัดสูงสุด 500 ชิป', () => {
    const bet = new Bet('TRIPLE', 501);
    const result = bet.validate(1000);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('ไม่เกิน 500');
  });

  it('ควรล้มเหลวเมื่อชิปในกระเป๋าไม่เพียงพอ', () => {
    const bet = new Bet('HIGH', 100);
    const result = bet.validate(50);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('ไม่เพียงพอ');
  });
});

describe('Domain: DiceHand Entity', () => {
  it('ควรคำนวณแต้มรวม 3 ลูกได้อย่างถูกต้อง', () => {
    const hand = new DiceHand([2, 3, 5]);
    expect(hand.sum).toBe(10);
    expect(hand.isTriple).toBe(false);
    expect(hand.getCategory()).toBe('LOW');
  });

  it('ควรระบุแต้มสูงได้อย่างถูกต้อง (11-17)', () => {
    const hand = new DiceHand([4, 5, 6]);
    expect(hand.sum).toBe(15);
    expect(hand.isTriple).toBe(false);
    expect(hand.getCategory()).toBe('HIGH');
  });

  it('ควรตรวจจับกรณีลูกเต๋าออกตอง (Triple)', () => {
    const hand = new DiceHand([4, 4, 4]);
    expect(hand.sum).toBe(12);
    expect(hand.isTriple).toBe(true);
    expect(hand.getCategory()).toBe('TRIPLE');
  });
});

describe('Domain: PayoutCalculator Rules (BR-03)', () => {
  it('ควรจ่าย 1:1 เมื่อแทง LOW แล้วผลรวมแต้ม 4-10 (ไม่ตอง)', () => {
    const bet = new Bet('LOW', 100);
    const hand = new DiceHand([1, 2, 4]); // sum = 7
    const result = PayoutCalculator.evaluate(bet, hand);
    expect(result.won).toBe(true);
    expect(result.multiplier).toBe(1);
    expect(result.netGain).toBe(100);
    expect(result.payoutAmount).toBe(200);
  });

  it('ควรจ่าย 1:1 เมื่อแทง HIGH แล้วผลรวมแต้ม 11-17 (ไม่ตอง)', () => {
    const bet = new Bet('HIGH', 200);
    const hand = new DiceHand([5, 5, 3]); // sum = 13
    const result = PayoutCalculator.evaluate(bet, hand);
    expect(result.won).toBe(true);
    expect(result.multiplier).toBe(1);
    expect(result.netGain).toBe(200);
    expect(result.payoutAmount).toBe(400);
  });

  it('ควรปรับแพ้เมื่อแทง HIGH หรือ LOW แต่ออกลูกเต๋าตอง (House Edge)', () => {
    const betHigh = new Bet('HIGH', 100);
    const tripleHand = new DiceHand([4, 4, 4]); // sum = 12
    const resultHigh = PayoutCalculator.evaluate(betHigh, tripleHand);
    expect(resultHigh.won).toBe(false);
    expect(resultHigh.payoutAmount).toBe(0);
    expect(resultHigh.netGain).toBe(-100);

    const betLow = new Bet('LOW', 100);
    const tripleHandLow = new DiceHand([2, 2, 2]); // sum = 6
    const resultLow = PayoutCalculator.evaluate(betLow, tripleHandLow);
    expect(resultLow.won).toBe(false);
    expect(resultLow.payoutAmount).toBe(0);
    expect(resultLow.netGain).toBe(-100);
  });

  it('ควรจ่าย 30:1 เมื่อแทง TRIPLE แล้วออกลูกเต๋าตอง', () => {
    const bet = new Bet('TRIPLE', 50);
    const hand = new DiceHand([3, 3, 3]);
    const result = PayoutCalculator.evaluate(bet, hand);
    expect(result.won).toBe(true);
    expect(result.multiplier).toBe(30);
    expect(result.netGain).toBe(1500); // 50 * 30
    expect(result.payoutAmount).toBe(1550); // 50 ทุน + 1500 กำไร
  });
});

describe('Domain: VirtualWallet Aggregate (BR-01, BR-04)', () => {
  it('ควรเริ่มต้นด้วย 1,000 ชิป', () => {
    const wallet = new VirtualWallet('test_user');
    expect(wallet.balance).toBe(1000);
  });

  it('ควรไม่อนุญาตให้ขอ Bailout หากชิปยังเหลือ >= 10', () => {
    const wallet = new VirtualWallet('test_user', 50);
    const check = wallet.canClaimBailout();
    expect(check.eligible).toBe(false);
  });

  it('ควรอนุญาตให้ขอ Bailout เมื่อชิปเหลือ < 10 และเติม 200 ชิป', () => {
    const wallet = new VirtualWallet('test_user', 5);
    const check = wallet.canClaimBailout();
    expect(check.eligible).toBe(true);

    const added = wallet.claimBailout();
    expect(added).toBe(200);
    expect(wallet.balance).toBe(205);

    // กดซ้ำทันทีต้องติด cooldown
    const checkAgain = wallet.canClaimBailout();
    expect(checkAgain.eligible).toBe(false);
  });
});
