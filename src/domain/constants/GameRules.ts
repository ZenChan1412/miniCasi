/**
 * ค่าคงที่และกฎทางธุรกิจกลางของระบบมินิเกม (Business Rules Constants)
 * ควบคุมตามเอกสาร 01-requirements.md และ 03-software-architecture.md
 */
export const GAME_RULES = {
  // กฎการเดิมพัน (BR-02)
  MIN_BET: 10,
  MAX_BET: 500,

  // อัตราการจ่ายเงินรางวัลจำลอง (BR-03)
  PAYOUT_MULTIPLIER_HIGH_LOW: 1, // 1:1 (ได้ทุนคืน + กำไร 1 เท่า)
  PAYOUT_MULTIPLIER_TRIPLE: 30,  // 30:1 (ได้ทุนคืน + กำไร 30 เท่า)

  // กฎระบบกระเป๋าชิปและโบนัส (BR-01, BR-04)
  INITIAL_BALANCE: 1000,
  BAILOUT_AMOUNT: 200,
  BAILOUT_THRESHOLD: 10, // ต่ำกว่ายอดนี้จึงจะมีสิทธิ์ขอ Bailout
  BAILOUT_COOLDOWN_MS: 60 * 1000, // 60 วินาที

  DAILY_REWARD_AMOUNT: 500,
  DAILY_COOLDOWN_MS: 24 * 60 * 60 * 1000, // 24 ชั่วโมง

  // ค่าคงที่ด้านการแสดงผล (Presentation Settings)
  ROLL_ANIMATION_DELAY_MS: 1100, // หน่วงเวลาอนิเมชันลูกเต๋าหมุน 1.1 วินาที
  MAX_ROADMAP_HISTORY: 15,
} as const;
