import { GAME_RULES } from '../constants/GameRules';

export interface WalletState {
  walletId: string;
  balance: number;
  lastBailoutAt: number;
  lastDailyClaimAt: number;
}

export class VirtualWallet {
  public static readonly INITIAL_BALANCE = GAME_RULES.INITIAL_BALANCE;
  public static readonly BAILOUT_AMOUNT = GAME_RULES.BAILOUT_AMOUNT;
  public static readonly BAILOUT_THRESHOLD = GAME_RULES.BAILOUT_THRESHOLD;
  public static readonly BAILOUT_COOLDOWN_MS = GAME_RULES.BAILOUT_COOLDOWN_MS;
  public static readonly DAILY_REWARD_AMOUNT = GAME_RULES.DAILY_REWARD_AMOUNT;
  public static readonly DAILY_COOLDOWN_MS = GAME_RULES.DAILY_COOLDOWN_MS;

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
      throw new Error('จำนวนชิปท่ีต้องการหักไม่ถูกต้ง่');
    }
    if (this._balance < amount) {
      return false;
    }
    this._balance -= amount;
    return true;
  }

  public credit(amount: number): void {
    if (amount <= 0 || !Number.isInteger(amount)) {
      throw new Error('จำนวนชิปท่ีต้องการเพิ่่มไม่ถูกต้ง่');
    }
    this._balance += amount;
  }

  /**
   * สิทธิ์การขอชิปช่่วยเหลืือฉุึกเฉิิน (BR-04)
   * ปลดล็อกเมื่ือชิป < 10 และผ่่าน Cooldown 60 วินาทีแล้้ว
   */
  public canClaimBailout(now: number = Date.now()): { eligible: boolean; remainingSeconds: number } {
    if (this._balance >= VirtualWallet.BAILOUT_THRESHOLD) {
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
      throw new Error('ยงั่ไม่สามารถขอรบชิปช่่วยเหลืือได้ในขณะน้ี');
    }
    this._balance += VirtualWallet.BAILOUT_AMOUNT;
    this._lastBailoutAt = now;
    return VirtualWallet.BAILOUT_AMOUNT;
  }

  /**
   * สิทธิ์การรบโบนััสล็อกอินประจำวนั (Daily Faucet)
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
      throw new Error('คณไดร้บโบนััสประจำวนัไปแล้้ว กรณารอรอบถดไป');
    }
    this._balance += VirtualWallet.DAILY_REWARD_AMOUNT;
    this._lastDailyClaimAt = now;
    return VirtualWallet.DAILY_REWARD_AMOUNT;
  }

  /**
   * สิทธิ์ผู้ดูแลระบบ (Admin): รับชิปฉุกเฉินข้าม Cooldown และข้าม threshold 10 ชิป
   * ใช้เมื่อผู้ใช้ติดอยู่ในช่วงรอรับชิปฉุกเฉิน — Admin เข้าถึงได้เสมอ
   */
  public forceClaimBailout(now: number = Date.now()): number {
    this._balance += VirtualWallet.BAILOUT_AMOUNT;
    this._lastBailoutAt = now;
    return VirtualWallet.BAILOUT_AMOUNT;
  }

  /**
   * สิทธผ์ีู้ดู้แล้ระบบ (Admin): รบโบนััสรายวนัข้าม Cooldown
   */
  public forceClaimDaily(now: number = Date.now()): number {
    this._balance += VirtualWallet.DAILY_REWARD_AMOUNT;
    this._lastDailyClaimAt = now;
    return VirtualWallet.DAILY_REWARD_AMOUNT;
  }

  /**
   * สิทธผ์ีู้ดู้แล้ระบบ (Admin): ล้าง Cooldown ทัง้หมด
   * ให้อกัีรกดรบ Bailout / Daily ได้อกัีรทันที
   */
  public resetCooldowns(): void {
    this._lastBailoutAt = 0;
    this._lastDailyClaimAt = 0;
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
