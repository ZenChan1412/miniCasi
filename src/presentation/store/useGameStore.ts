import { useState, useEffect, useCallback, useMemo } from 'react';
import { BetOption } from '../../domain/entities/Bet';
import { GAME_RULES } from '../../domain/constants/GameRules';
import { PlayerStats, StreakTracker } from '../../domain/services/StreakTracker';
import { PlaceBetAndRollUseCase } from '../../application/usecases/PlaceBetAndRoll';
import { ClaimEmergencyBailoutUseCase } from '../../application/usecases/ClaimEmergencyBailout';
import { ClaimDailyRewardUseCase } from '../../application/usecases/ClaimDailyReward';
import { LocalStorageWalletRepo } from '../../infrastructure/storage/LocalStorageWalletRepo';
import { LocalStorageHistoryRepo } from '../../infrastructure/storage/LocalStorageHistoryRepo';
import { WebCryptoRNG } from '../../infrastructure/rng/WebCryptoRNG';
import { AdminGrantChipsUseCase } from '../../application/usecases/AdminGrantChips';
import { ViewAllWalletsUseCase } from "../../application/usecases/ViewAllWallets";
import { BanUserUseCase } from "../../application/usecases/BanUser";
import { ViewAuditLogsUseCase, AuditEntry } from "../../application/usecases/ViewAuditLogs";
import { soundFX } from '../../infrastructure/sound/SoundFX';
import confetti from 'canvas-confetti';

export interface GameStoreState {
  balance: number;
  betOption: BetOption | null;
  betAmount: number;
  isRolling: boolean;
  dice: [number, number, number];
  sum: number;
  lastOutcome: {
    won: boolean;
    reason: string;
    netGain: number;
    payout: number;
    isTriple: boolean;
  } | null;
  stats: PlayerStats;
  bailoutTimer: number; // seconds remaining
  canBailout: boolean;
  dailyTimer: number;   // seconds remaining
  canDailyClaim: boolean;
  isMuted: boolean;
  error: string | null;
  showStatsModal: boolean;
  showResultModal: boolean;
}

export function useGameEngine(userId?: string, isAdmin = false, isCreator = false) {
  const [balance, setBalance] = useState<number>(1000);
  const [betOption, setBetOption] = useState<BetOption | null>('HIGH');
  const [betAmount, setBetAmount] = useState<number>(50);
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [dice, setDice] = useState<[number, number, number]>([1, 2, 3]);
  const [sum, setSum] = useState<number>(6);
  const [lastOutcome, setLastOutcome] = useState<{
    won: boolean;
    reason: string;
    netGain: number;
    payout: number;
    isTriple: boolean;
  } | null>(null);
  const [stats, setStats] = useState<PlayerStats>(StreakTracker.createDefaultStats());
  const [bailoutTimer, setBailoutTimer] = useState<number>(0);
  const [canBailout, setCanBailout] = useState<boolean>(false);
  const [dailyTimer, setDailyTimer] = useState<number>(0);
  const [canDailyClaim, setCanDailyClaim] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showStatsModal, setShowStatsModal] = useState<boolean>(false);
  const [showResultModal, setShowResultModal] = useState<boolean>(false);

  // Clean Architecture Repositories & Use Cases
  const walletRepo = useMemo(() => new LocalStorageWalletRepo(), []);
  const historyRepo = useMemo(() => new LocalStorageHistoryRepo(), []);
  const rng = useMemo(() => new WebCryptoRNG(), []);

  const placeBetUseCase = useMemo(
    () => new PlaceBetAndRollUseCase(walletRepo, historyRepo, rng),
    [walletRepo, historyRepo, rng]
  );
  const bailoutUseCase = useMemo(
    () => new ClaimEmergencyBailoutUseCase(walletRepo),
    [walletRepo]
  );
  const dailyUseCase = useMemo(
    () => new ClaimDailyRewardUseCase(walletRepo),
    [walletRepo]
  );
  const adminGrantUseCase = useMemo(
    () => new AdminGrantChipsUseCase(walletRepo),
    [walletRepo]
  );

  // Sync wallet and stats on mount or when userId changes
  const syncState = useCallback(async () => {
    try {
      const wallet = await walletRepo.getWallet(userId);
      const currentStats = await historyRepo.getStats(userId);

      setBalance(wallet.balance);
      setStats(currentStats);
      setIsMuted(soundFX.getMuted());

      const bCheck = wallet.canClaimBailout();
      setCanBailout(bCheck.eligible);
      setBailoutTimer(bCheck.remainingSeconds);

      const dCheck = wallet.canClaimDaily();
      setCanDailyClaim(dCheck.eligible);
      setDailyTimer(dCheck.remainingSeconds);
    } catch (e: unknown) {
      console.error('Failed to sync wallet state:', e);
    }
  }, [walletRepo, historyRepo, userId]);

  useEffect(() => {
    syncState();
  }, [syncState, userId]);

  // Interval timer for countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setBailoutTimer((prev) => {
        if (prev === 1) {
          syncState();
          return 0;
        }
        return prev > 1 ? prev - 1 : 0;
      });

      setDailyTimer((prev) => {
        if (prev === 1) {
          syncState();
          return 0;
        }
        return prev > 1 ? prev - 1 : 0;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [syncState]);

  // Actions
  const selectBetOption = useCallback((option: BetOption) => {
    soundFX.playChipClick();
    setBetOption(option);
    setError(null);
  }, []);

  const selectBetAmount = useCallback((amount: number) => {
    soundFX.playChipClick();
    setBetAmount(amount);
    setError(null);
  }, []);

  const clearBet = useCallback(() => {
    soundFX.playChipClick();
    setBetOption(null);
    setBetAmount(10);
    setError(null);
  }, []);

  const toggleSound = useCallback(() => {
    const muted = soundFX.toggleMute();
    setIsMuted(muted);
  }, []);

  // Main Action: Roll Dice
  const rollDice = useCallback(async () => {
    if (isRolling) return;
    if (!betOption) {
      setError('กรุณาเลือกช่องแทง (สูง, ต่ำ, หรือ ตอง) ก่อนกดทอย');
      return;
    }
    if (betAmount > balance) {
      setError('ยอดชิปของคุณไม่เพียงพอสำหรับการเดิมพันนี้');
      return;
    }

    try {
      setError(null);
      setIsRolling(true);
      setShowResultModal(false);
      setLastOutcome(null);

      // เริ่มเสียงลูกเต๋า
      soundFX.playDiceRoll();

      // ดำเนินการผ่าน Use Case
      const result = await placeBetUseCase.execute(
        {
          option: betOption,
          amount: betAmount,
        },
        userId
      );

      // กำหนดแต้มเป้าหมายทันที เพื่อให้ลูกเต๋าหมุนต่อเนื่อง 4-5 รอบสู่เป้าหมายตลอดช่วง 1.2 วินาที
      setDice(result.dice);

      // หน่วงเวลาให้ลูกเต๋าหมุน ตีลังกา และเด้งลงสู่โต๊ะอย่างเป็นธรรมชาติ
      setTimeout(() => {
        setSum(result.sum);
        setBalance(result.newBalance);
        setStats(result.stats);
        setIsRolling(false);

        // เสียงลูกเต๋าตกกระทบโต๊ะ
        soundFX.playDiceLand();

        const outcome = {
          won: result.won,
          reason: result.reason,
          netGain: result.netGain,
          payout: result.payoutAmount,
          isTriple: result.isTriple,
        };
        setLastOutcome(outcome);

        // Sound & Visual Effects
        if (result.won) {
          if (result.isTriple && betOption === 'TRIPLE') {
            soundFX.playBigWin();
            confetti({
              particleCount: 120,
              spread: 90,
              origin: { y: 0.6 },
            });
          } else {
            soundFX.playWin();
            confetti({
              particleCount: 60,
              spread: 60,
              origin: { y: 0.7 },
            });
          }
        } else {
          soundFX.playLose();
        }

        // เปิด Modal ประกาศผลลัพธ์หลังจากลูกเต๋าหยุดนิ่งลงบนโต๊ะ
        setTimeout(() => {
          setShowResultModal(true);
        }, 320);

        // ตรวจสอบสิทธิ์ bailout
        syncState();
      }, GAME_RULES.ROLL_ANIMATION_DELAY_MS);
    } catch (err: unknown) {
      setIsRolling(false);
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเล่น';
      setError(message);
    }
  }, [isRolling, betOption, betAmount, balance, placeBetUseCase, userId, syncState]);

  // Bailout
  const claimBailout = useCallback(async () => {
    try {
      const res = await bailoutUseCase.execute(userId, isAdmin);
      setBalance(res.newBalance);
      setCanBailout(false);
      setBailoutTimer(res.cooldownRemainingSeconds);
      soundFX.playRefill();
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'ไม่สามารถขอรับชิปได้';
      setError(message);
    }
  }, [bailoutUseCase, userId, isAdmin]);

  // Daily Claim
  const claimDaily = useCallback(async () => {
    try {
      const res = await dailyUseCase.execute(userId, isAdmin);
      setBalance(res.newBalance);
      setCanDailyClaim(false);
      setDailyTimer(res.cooldownRemainingSeconds);
      soundFX.playRefill();
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'ไม่สามารถรับโบนัสได้';
      setError(message);
    }
  }, [dailyUseCase, userId, isAdmin]);

  // Admin: เพิ่มชิปให้ผู้เล่น (เฉพาะ admin — role ตรวจสอบแล้วจาก GoogleAuthService)
  const adminGrantChips = useCallback(
    async (targetUserId: string, grantAmount: number) => {
      if (!isAdmin && !isCreator) {
        throw new Error('สิทธิ์นี้เฉพาะผู้ดูแลระบบและผู้สร้างเท่านั้น');
      }
      const res = await adminGrantUseCase.execute(targetUserId, grantAmount);
      if (targetUserId === userId) {
        await syncState();
      }
      return res;
    },
    [adminGrantUseCase, userId, syncState, isAdmin]
  );

  const adminResetCooldowns = useCallback(
    async (targetUserId: string) => {
      const wallet = await walletRepo.getWallet(targetUserId);
      wallet.resetCooldowns();
      await walletRepo.saveWallet(wallet, targetUserId);
      if (targetUserId === userId) {
        await syncState();
      }
    },
    [walletRepo, userId, syncState]
  );

  const adminResetWallet = useCallback(
    async (targetUserId: string) => {
      await walletRepo.resetWallet(targetUserId);
      if (targetUserId === userId) {
        await syncState();
        setDice([1, 2, 3]);
        setSum(6);
        setLastOutcome(null);
        setError(null);
      }
    },
    [walletRepo, userId, syncState]
  );

  // Reset Game Data
  const resetAllData = useCallback(async () => {
    if (confirm('คุณต้องการรีเซ็ตยอดชิปและสถิติทั้งหมดกลับสู่ค่าเริ่มต้นหรือไม่?')) {
      await walletRepo.resetWallet(userId);
      await historyRepo.resetStats(userId);
      await syncState();
      setDice([1, 2, 3]);
      setSum(6);
      setLastOutcome(null);
      setError(null);
    }
  }, [walletRepo, historyRepo, userId, syncState]);


  // Creator-Only Actions (View Wallets, Ban User, Audit Logs)
  const showWallets = useCallback(async () => {
    if (!isCreator) throw new Error('สิทธิ์เฉพาะผู้สร้างเท่านั้น');
    const svc = new ViewAllWalletsUseCase(walletRepo);
    return await svc.execute();
  }, [walletRepo, isCreator]);

  const banUser = useCallback(async (targetUserId: string) => {
    if (!isCreator) throw new Error('สิทธิ์เฉพาะผู้สร้างเท่านั้น');
    const svc = new BanUserUseCase(walletRepo);
    await svc.execute(targetUserId);
  }, [walletRepo, isCreator]);

  const showAuditLogs = useCallback(async () => {
    if (!isCreator) throw new Error('สิทธิ์เฉพาะผู้สร้างเท่านั้น');
    const svc = new ViewAuditLogsUseCase(historyRepo, walletRepo);
    return await svc.execute();
  }, [historyRepo, walletRepo, isCreator]);

  return {
    balance,
    betOption,
    betAmount,
    isRolling,
    dice,
    sum,
    lastOutcome,
    stats,
    bailoutTimer,
    canBailout,
    dailyTimer,
    canDailyClaim,
    isMuted,
    error,
    showStatsModal,
    setShowStatsModal,
    showResultModal,
    setShowResultModal,
    selectBetOption,
    selectBetAmount,
    clearBet,
    toggleSound,
    rollDice,
    claimBailout,
    claimDaily,
    adminGrantChips,
    adminResetCooldowns,
    adminResetWallet,
    resetAllData,
    showWallets,
    banUser,
    showAuditLogs,
  };
}
