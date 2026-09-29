export interface WalletState {
  walletId: string;
  balance: number;
  lastBailoutAt: number;
  lastDailyClaimAt: number;
}

export class VirtualWallet {
  public static readonly INITIAL_BALANCE = 1000;
  public static readonly BAILOUT_AMOUNT = 200;
  public static readonly BAILOUT_COOLDOWN_MS = 60 * 1000; // 60 วินาที
  public static readonly DAILY_REWARD_AMOUNT = 500;
  public static readonly DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 ชั่วโมง

  private _balance: number;
  private _lastBailoutAt: number;
  private _lastDailyClaimAt: number;

  constructor(
    public readonly walletId: string,
    balance: number = VirtualWallet.INITIAL_BALANCE,
    lastBailoutAt: number = 0,
    lastDailyClaimAt: number = 0
  ) {
    this._balance = Math.max(0, Math.floor(balance));
    this._lastBailoutAt = lastBailoutAt;
    this._lastDailyClaimAt = lastDailyClaimAt;
  }

  public get balance(): number {
    return this._balance;
  }

  public get lastBailoutAt(): number {
    return this._lastBailoutAt;
  }

  public get lastDailyClaimAt(): number {
    return this._lastDailyClaimAt;
  }

  public deduct(amount: number): boolean {
    if (amount <= 0 || !Number.isInteger(amount)) {
      throw new Error('จำนวนชิปที่ต้องการหักไม่ถูกต้อง');
    }
    if (this._balance < amount) {
      return false;
    }
    this._balance -= amount;
    return true;
  }

  public credit(amount: number): void {
    if (amount <= 0 || !Number.isInteger(amount)) {
      throw new Error('จำนวนชิปที่ต้องการเพิ่มไม่ถูกต้อง');
    }
    this._balance += amount;
  }

  /**
   * สิทธิ์การขอชิปช่วยเหลือฉุกเฉิน (BR-04)
   * ปลดล็อกเมื่อชิป < 10 และผ่าน Cooldown 60 วินาทีแล้ว
   */
  public canClaimBailout(now: number = Date.now()): { eligible: boolean; remainingSeconds: number } {
    if (this._balance >= 10) {
      return { eligible: false, remainingSeconds: 0 };
    }
    const elapsed = now - this._lastBailoutAt;
    if (elapsed < VirtualWallet.BAILOUT_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((VirtualWallet.BAILOUT_COOLDOWN_MS - elapsed) / 1000);
      return { eligible: false, remainingSeconds };
    }
    return { eligible: true, remainingSeconds: 0 };
  }

  public claimBailout(now: number = Date.now()): number {
    const check = this.canClaimBailout(now);
    if (!check.eligible) {
      throw new Error('ยังไม่สามารถขอรับชิปช่วยเหลือได้ในขณะนี้');
    }
    this._balance += VirtualWallet.BAILOUT_AMOUNT;
    this._lastBailoutAt = now;
    return VirtualWallet.BAILOUT_AMOUNT;
  }

  /**
   * สิทธิ์การรับโบนัสล็อกอินประจำวัน (Daily Faucet)
   */
  public canClaimDaily(now: number = Date.now()): { eligible: boolean; remainingSeconds: number } {
    if (this._lastDailyClaimAt === 0) {
      return { eligible: true, remainingSeconds: 0 };
    }
    const elapsed = now - this._lastDailyClaimAt;
    if (elapsed < VirtualWallet.DAILY_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((VirtualWallet.DAILY_COOLDOWN_MS - elapsed) / 1000);
      return { eligible: false, remainingSeconds };
    }
    return { eligible: true, remainingSeconds: 0 };
  }

  public claimDaily(now: number = Date.now()): number {
    const check = this.canClaimDaily(now);
    if (!check.eligible) {
      throw new Error('คุณได้รับโบนัสประจำวันไปแล้ว กรุณารอรอบถัดไป');
    }
    this._balance += VirtualWallet.DAILY_REWARD_AMOUNT;
    this._lastDailyClaimAt = now;
    return VirtualWallet.DAILY_REWARD_AMOUNT;
  }

  public toJSON(): WalletState {
    return {
      walletId: this.walletId,
      balance: this._balance,
      lastBailoutAt: this._lastBailoutAt,
      lastDailyClaimAt: this._lastDailyClaimAt,
    };
  }

  public static fromJSON(data: WalletState): VirtualWallet {
    return new VirtualWallet(
      data.walletId,
      data.balance,
      data.lastBailoutAt,
      data.lastDailyClaimAt
    );
  }
}
