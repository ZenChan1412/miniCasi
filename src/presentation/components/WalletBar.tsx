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
    <header className="w-full max-w-md mx-auto py-2.5 px-3 flex flex-col gap-2">
      {/* Top Branding & Quick Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/20 text-lg">
            🎲
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white leading-tight">
              High-Low Mini Game
            </h1>
            <span className="text-[10px] text-emerald-400 font-medium tracking-wide">
              ชิปเล่นฟรี 100% (No Real Money)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
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

      {/* Main Balance Display */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-3 rounded-2xl border border-slate-700/80 shadow-lg flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400">
            <Coins className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">ชิปจำลองคงเหลือ</div>
            <div className="text-xl font-black text-amber-300 tracking-tight flex items-baseline gap-1">
              <span>{balance.toLocaleString()}</span>
              <span className="text-xs text-amber-400 font-normal">CHIPS</span>
            </div>
          </div>
        </div>

        {/* Free Chips Buttons */}
        <div className="flex items-center gap-1.5">
          {/* Daily Bonus Button */}
          <button
            type="button"
            disabled={!canDailyClaim}
            onClick={onClaimDaily}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
              canDailyClaim
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-md shadow-emerald-500/30 animate-bounce'
                : 'bg-slate-800/80 text-slate-400 border border-slate-700 cursor-not-allowed opacity-60'
            }`}
            title="โบนัสล็อกอินรายวัน +500 ชิป"
          >
            <Gift className="w-3.5 h-3.5" />
            <span>{canDailyClaim ? '+500 ฟรี' : formatTime(dailyTimer)}</span>
          </button>

          {/* Emergency Bailout Button */}
          {balance < 10 && (
            <button
              type="button"
              disabled={!canBailout}
              onClick={onClaimBailout}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                canBailout
                  ? 'bg-gradient-to-r from-red-500 to-amber-500 text-white shadow-md shadow-red-500/30 animate-pulse'
                  : 'bg-slate-800/80 text-slate-400 border border-slate-700 cursor-not-allowed'
              }`}
              title="ชิปฉุกเฉินเมื่อชิปหมด +200 ชิป"
            >
              <LifeBuoy className="w-3.5 h-3.5" />
              <span>{canBailout ? 'ขอชิป +200' : `${bailoutTimer}s`}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
