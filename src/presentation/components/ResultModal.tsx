import React, { useEffect } from 'react';
import { BetOption } from '../../domain/entities/Bet';
import { Sparkles, Trophy, X, Play, RotateCcw, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';

interface ResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayAgain: () => void;
  dice: [number, number, number];
  sum: number;
  category: 'HIGH' | 'LOW' | 'TRIPLE';
  isTriple: boolean;
  betOption: BetOption | null;
  betAmount: number;
  outcome: {
    won: boolean;
    reason: string;
    netGain: number;
    payout: number;
    isTriple: boolean;
  } | null;
  balance: number;
  currentStreak: number;
}

// Visual Mini-Dice renderer for the modal
const ResultDiceBox: React.FC<{ value: number }> = ({ value }) => {
  return (
    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-white via-slate-100 to-slate-200 border-2 border-slate-300 shadow-xl flex flex-col justify-between p-2 relative transform hover:scale-105 transition-transform">
      {/* 3D Chamfer Edge highlight */}
      <div className="absolute inset-0 rounded-2xl border border-white/60 pointer-events-none" />

      {value === 1 && (
        <div className="w-full h-full flex items-center justify-center">
          <span className="w-5 h-5 rounded-full bg-red-600 shadow-inner" />
        </div>
      )}

      {value === 2 && (
        <div className="w-full h-full flex justify-between">
          <span className="w-3 h-3 rounded-full bg-slate-900 shadow-inner" />
          <span className="w-3 h-3 rounded-full bg-slate-900 shadow-inner self-end" />
        </div>
      )}

      {value === 3 && (
        <div className="w-full h-full flex justify-between">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-900 shadow-inner" />
          <span className="w-2.5 h-2.5 rounded-full bg-slate-900 shadow-inner self-center" />
          <span className="w-2.5 h-2.5 rounded-full bg-slate-900 shadow-inner self-end" />
        </div>
      )}

      {value === 4 && (
        <div className="w-full h-full flex flex-col justify-between">
          <div className="flex justify-between">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 shadow-inner" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 shadow-inner" />
          </div>
          <div className="flex justify-between">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 shadow-inner" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 shadow-inner" />
          </div>
        </div>
      )}

      {value === 5 && (
        <div className="w-full h-full flex flex-col justify-between">
          <div className="flex justify-between">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 shadow-inner" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 shadow-inner" />
          </div>
          <div className="flex justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 shadow-inner" />
          </div>
          <div className="flex justify-between">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 shadow-inner" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 shadow-inner" />
          </div>
        </div>
      )}

      {value === 6 && (
        <div className="w-full h-full flex flex-col justify-between">
          <div className="flex justify-between">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 shadow-inner" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 shadow-inner" />
          </div>
          <div className="flex justify-between">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 shadow-inner" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 shadow-inner" />
          </div>
          <div className="flex justify-between">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 shadow-inner" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-900 shadow-inner" />
          </div>
        </div>
      )}
    </div>
  );
};

export const ResultModal: React.FC<ResultModalProps> = ({
  isOpen,
  onClose,
  onPlayAgain,
  dice,
  sum,
  category,
  isTriple,
  betOption,
  betAmount,
  outcome,
  balance,
  currentStreak,
}) => {
  // Keyboard listener: Enter or Space to play again, Esc to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault();
        onPlayAgain();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onPlayAgain]);

  if (!isOpen || !outcome) return null;

  const won = outcome.won;
  const isJackpot = won && isTriple && betOption === 'TRIPLE';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-md sm:max-w-lg rounded-3xl border shadow-2xl p-5 sm:p-6 overflow-hidden animate-in zoom-in-95 duration-200 ${
          isJackpot
            ? 'bg-gradient-to-b from-purple-950/95 via-slate-900/95 to-slate-950 border-amber-400 shadow-purple-500/40 ring-2 ring-amber-300'
            : won
            ? 'bg-gradient-to-b from-emerald-950/95 via-slate-900/95 to-slate-950 border-emerald-500/50 shadow-emerald-500/30'
            : 'bg-gradient-to-b from-slate-900/95 via-slate-900/95 to-slate-950 border-slate-750 shadow-black/60'
        }`}
      >
        {/* Ambient Top Glow */}
        <div
          className={`absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full blur-3xl pointer-events-none ${
            isJackpot
              ? 'bg-amber-400/30'
              : won
              ? 'bg-emerald-400/30'
              : 'bg-blue-500/10'
          }`}
        />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
          title="ปิด (Esc)"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Badge */}
        <div className="text-center pt-2 pb-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider mb-2">
            {isJackpot ? (
              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 font-black shadow-lg shadow-amber-400/30 flex items-center gap-1.5 animate-bounce">
                <Sparkles className="w-4 h-4" />
                MEGA JACKPOT ตอง 30 เท่า!
              </span>
            ) : won ? (
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-emerald-400" />
                ยินดีด้วย! คุณชนะการเดิมพัน
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                ไม่ชนะในรอบนี้ • เอาใหม่รอบหน้า!
              </span>
            )}
          </div>

          <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {isJackpot
              ? '🎉 ชนะรางวัลใหญ่ 30 เท่า!'
              : won
              ? '🎉 คุณได้รับชิปรางวัล!'
              : 'แต้มรอบนี้ยังไม่เข้าเป้า'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-sm mx-auto">
            {outcome.reason}
          </p>
        </div>

        {/* Dice Visual Stage */}
        <div className="bg-slate-950/70 p-4 sm:p-5 rounded-2xl border border-slate-800/90 my-3 flex flex-col items-center gap-3">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            ลูกเต๋าออกแต้มจริง
          </div>

          <div className="flex items-center justify-center gap-3 sm:gap-4">
            <ResultDiceBox value={dice[0]} />
            <span className="text-lg font-black text-slate-500">+</span>
            <ResultDiceBox value={dice[1]} />
            <span className="text-lg font-black text-slate-500">+</span>
            <ResultDiceBox value={dice[2]} />
          </div>

          {/* Sum & Category Result Pill */}
          <div className="flex items-center gap-2 pt-1">
            <div className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-sm font-bold text-slate-200">
              แต้มรวม: <span className="text-amber-400 text-base">{sum}</span>
            </div>
            <div
              className={`px-3 py-1 rounded-xl text-sm font-black uppercase tracking-wider ${
                isTriple
                  ? 'bg-purple-600 text-purple-100 ring-2 ring-purple-300'
                  : category === 'HIGH'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
              }`}
            >
              {isTriple ? 'ตอง (TRIPLE)' : category === 'HIGH' ? 'สูง (HIGH)' : 'ต่ำ (LOW)'}
            </div>
          </div>
        </div>

        {/* Round Financial & Stats Breakdown */}
        <div className="bg-slate-900/60 p-3.5 sm:p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <span className="text-slate-400">หน้าเดิมพันของคุณ:</span>
            <span className="font-bold text-white flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  betOption === 'TRIPLE'
                    ? 'bg-purple-400'
                    : betOption === 'HIGH'
                    ? 'bg-red-400'
                    : 'bg-blue-400'
                }`}
              />
              {betOption === 'TRIPLE' ? 'ตอง' : betOption === 'HIGH' ? 'สูง' : 'ต่ำ'} ({betAmount} ชิป)
            </span>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <span className="text-slate-400">ผลกำไรสุทธิรอบนี้:</span>
            <span
              className={`text-sm font-extrabold ${
                outcome.netGain > 0
                  ? 'text-emerald-400'
                  : outcome.netGain < 0
                  ? 'text-red-400'
                  : 'text-slate-400'
              }`}
            >
              {outcome.netGain > 0 ? `+${outcome.netGain.toLocaleString()}` : outcome.netGain.toLocaleString()} ชิป
            </span>
          </div>

          <div className="flex items-center justify-between pt-0.5">
            <span className="text-slate-400">ยอดชิปคงเหลือใหม่:</span>
            <span className="text-sm font-black text-amber-300">
              {balance.toLocaleString()} CHIPS
            </span>
          </div>

          {currentStreak > 1 && won && (
            <div className="mt-2 pt-2 border-t border-slate-800/80 text-center text-amber-400 font-bold flex items-center justify-center gap-1.5 text-xs">
              <span>🔥 ชนะติดต่อกัน {currentStreak} รอบแล้ว! สุดยอด!</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5 mt-5">
          <button
            type="button"
            onClick={onPlayAgain}
            className={`flex-1 py-3.5 px-4 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
              won
                ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 text-slate-950 shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98]'
                : 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-amber-500/30 hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            <Play className="w-4 h-4 fill-current" />
            <span>ทอยต่อทันที ({betAmount} ชิป)</span>
            <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-slate-950/20 text-slate-900 rounded border border-slate-900/30">
              Space
            </kbd>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="py-3.5 px-5 rounded-2xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold text-xs sm:text-sm border border-slate-700 transition-colors cursor-pointer text-center"
          >
            เปลี่ยนยอดแทง / หน้าโต๊ะ
          </button>
        </div>
      </div>
    </div>
  );
};
