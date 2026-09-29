import React from 'react';
import { Coins, Volume2, VolumeX, Gift, LifeBuoy, BarChart3, RefreshCw } from 'lucide-react';

interface WalletBarProps {
  balance: number;
  canBailout: boolean;
  bailoutTimer: number;
  canDailyClaim: boolean;
  dailyTimer: number;
  isMuted: boolean;
  onClaimBailout: () => void;
  onClaimDaily: () => void;
  onToggleSound: () => void;
  onOpenStats: () => void;
  onReset: () => void;
}

export const WalletBar: React.FC<WalletBarProps> = ({
  balance,
  canBailout,
  bailoutTimer,
  canDailyClaim,
  dailyTimer,
  isMuted,
  onClaimBailout,
  onClaimDaily,
  onToggleSound,
  onOpenStats,
  onReset,
}) => {
  const formatTime = (seconds: number): string => {
    if (seconds <= 0) return 'พร้อมกดรับ';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}ชม. ${mins}น.`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <header className="w-full py-2.5 px-3 sm:px-6 lg:px-8 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        {/* Left: Branding */}
        <div className="flex items-center justify-between lg:justify-start gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/25 text-xl">
              🎲
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-white leading-tight">
                  High-Low Dice
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  CASUAL
                </span>
              </div>
              <span className="text-[11px] text-emerald-400 font-medium tracking-wide flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-ping" />
                ชิปเล่นฟรี 100% (No Real Money)
              </span>
            </div>
          </div>

          {/* Quick utility controls on mobile only */}
          <div className="flex items-center gap-1.5 lg:hidden">
            <button
              type="button"
              onClick={onToggleSound}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title={isMuted ? 'เปิดเสียง' : 'ปิดเสียง'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>

            <button
              type="button"
              onClick={onOpenStats}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="ดูสถิติการเล่น"
            >
              <BarChart3 className="w-4 h-4 text-amber-400" />
            </button>

            <button
              type="button"
              onClick={onReset}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
              title="รีเซ็ตยอดชิปเริ่มต้น"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center: Main Balance Display */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 px-4 py-2 rounded-2xl border border-slate-700/80 shadow-md flex items-center justify-between lg:justify-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400">
              <Coins className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">ยอดชิปจำลองคงเหลือ</div>
              <div className="text-xl sm:text-2xl font-black text-amber-300 tracking-tight flex items-baseline gap-1.5">
                <span>{balance.toLocaleString()}</span>
                <span className="text-xs text-amber-400/90 font-medium">CHIPS</span>
              </div>
            </div>
          </div>

          {/* Quick chip status badge on desktop */}
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] text-slate-400">ระดับเครดิต</span>
            <span className="text-xs font-bold text-emerald-400">
              {balance >= 1000 ? '⭐ เสี่ยชิป' : balance >= 200 ? '✨ ปกติ' : '⚠️ ชิปเหลือน้อย'}
            </span>
          </div>
        </div>

        {/* Right: Actions & Free Chips (Desktop + Mobile Action group) */}
        <div className="flex items-center justify-end gap-2">
          {/* Daily Bonus Button */}
          <button
            type="button"
            disabled={!canDailyClaim}
            onClick={onClaimDaily}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              canDailyClaim
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-md shadow-emerald-500/30 hover:scale-105 active:scale-95 animate-bounce'
                : 'bg-slate-900 text-slate-400 border border-slate-800 cursor-not-allowed opacity-60'
            }`}
            title="โบนัสล็อกอินรายวัน +500 ชิป"
          >
            <Gift className="w-4 h-4" />
            <span>{canDailyClaim ? 'รับฟรี +500' : formatTime(dailyTimer)}</span>
          </button>

          {/* Emergency Bailout Button */}
          {balance < 10 && (
            <button
              type="button"
              disabled={!canBailout}
              onClick={onClaimBailout}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                canBailout
                  ? 'bg-gradient-to-r from-red-500 via-amber-500 to-yellow-500 text-slate-950 font-black shadow-md shadow-red-500/30 animate-pulse hover:scale-105'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 cursor-not-allowed'
              }`}
              title="ชิปฉุกเฉินเมื่อชิปหมด +200 ชิป"
            >
              <LifeBuoy className="w-4 h-4 text-slate-950" />
              <span>{canBailout ? 'กู้ชีพ +200' : `${bailoutTimer}s`}</span>
            </button>
          )}

          {/* Desktop Utility Controls */}
          <div className="hidden lg:flex items-center gap-1.5 pl-2 border-l border-slate-800">
            <button
              type="button"
              onClick={onToggleSound}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title={isMuted ? 'เปิดเสียง' : 'ปิดเสียง'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>

            <button
              type="button"
              onClick={onOpenStats}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="ดูสถิติการเล่น"
            >
              <BarChart3 className="w-4 h-4 text-amber-400" />
            </button>

            <button
              type="button"
              onClick={onReset}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors cursor-pointer"
              title="รีเซ็ตยอดชิปเริ่มต้น"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
