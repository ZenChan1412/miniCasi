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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div
        className={`relative w-full max-w-md sm:max-w-lg rounded-3xl border shadow-2xl p-5 sm:p-6 overflow-hidden animate-pop-in ${
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
          <div className="inline-flex max-w-full items-center gap-2 px-2 sm:px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider mb-2 whitespace-nowrap">
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

          <h3 className="text-xl sm:text-3xl font-black text-white tracking-tight whitespace-nowrap">
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

          {/* ผลสูง/ต่ำ/ตอง ตัวใหญ่ + แอนิเมชัน */}
          <div
            key={`${dice.join('-')}`}
            className={`verdict-pop relative overflow-hidden w-full max-w-xs text-center rounded-2xl py-3 px-4 border-2 ${
              isTriple
                ? 'bg-gradient-to-br from-purple-600 via-fuchsia-500 to-amber-400 border-amber-200 text-white'
                : category === 'HIGH'
                ? 'bg-gradient-to-br from-red-600 via-rose-500 to-orange-400 border-red-200 text-white'
                : 'bg-gradient-to-br from-blue-600 via-sky-500 to-cyan-400 border-sky-200 text-white'
            }`}
            style={{ ['--verdict-color' as string]: isTriple ? '#d946ef' : category === 'HIGH' ? '#ef4444' : '#38bdf8' }}
          >
            <span className="verdict-shine pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-white/40 blur-md" />
            <div className="relative text-5xl sm:text-6xl font-black leading-none whitespace-nowrap drop-shadow-[0_3px_6px_rgba(0,0,0,0.45)]">
              {isTriple ? 'ตอง' : category === 'HIGH' ? 'สูง' : 'ต่ำ'}
            </div>
            <div className="relative mt-1.5 text-sm font-bold tracking-widest whitespace-nowrap text-white/90">
              แต้มรวม <span className="text-xl font-black text-white">{sum}</span>
              <span className="mx-1.5">•</span>
              {isTriple ? 'TRIPLE' : category === 'HIGH' ? 'HIGH' : 'LOW'}
            </div>
          </div>
        </div>

        {/* Round Financial & Stats Breakdown */}
        <div className="bg-slate-900/60 p-3.5 sm:p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <span className="text-slate-400 whitespace-nowrap">หน้าเดิมพันของคุณ:</span>
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
            <span className="text-slate-400 whitespace-nowrap">ผลกำไรสุทธิรอบนี้:</span>
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
            <span className="text-slate-400 whitespace-nowrap">ยอดชิปคงเหลือใหม่:</span>
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
        <div className="flex flex-col gap-2.5 mt-5">
          <button
            type="button"
            onClick={onPlayAgain}
            className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm sm:text-base whitespace-nowrap flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
              won
                ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 text-slate-950 shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98]'
                : 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-amber-500/30 hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            <Play className="w-4 h-4 fill-current shrink-0" />
            <span>ทอยต่อทันที ({betAmount} ชิป)</span>
            <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-slate-950/20 text-slate-900 rounded border border-slate-900/30">
              Space
            </kbd>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 px-5 rounded-2xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold text-xs sm:text-sm whitespace-nowrap border border-slate-700 transition-colors cursor-pointer text-center"
          >
            เปลี่ยนยอดแทง / หน้าโต๊ะ
          </button>
        </div>
      </div>
    </div>
  );
};
