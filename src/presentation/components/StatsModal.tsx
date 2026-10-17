import React from 'react';
import { PlayerStats } from '../../domain/services/StreakTracker';
import { X, Trophy, Flame, Target, Award } from 'lucide-react';

interface StatsModalProps {
  isOpen: boolean;
  stats: PlayerStats;
  onClose: () => void;
}

export const StatsModal: React.FC<StatsModalProps> = ({ isOpen, stats, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm animate-pop-in bg-slate-900 border border-slate-700/80 rounded-3xl p-5 shadow-2xl relative space-y-4">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">สถิติการเล่นของคุณ</h2>
            <p className="text-xs text-slate-400">บันทึกบนเครื่องเบราว์เซอร์นี้</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/40">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Target className="w-3.5 h-3.5 text-blue-400" />
              <span>รอบเล่นทั้งหมด</span>
            </div>
            <div className="text-xl font-bold text-white">{stats.totalRounds} <span className="text-xs text-slate-400 font-normal">รอบ</span></div>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/40">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Award className="w-3.5 h-3.5 text-emerald-400" />
              <span>อัตราการชนะ</span>
            </div>
            <div className="text-xl font-bold text-emerald-400">{stats.winRatePercentage}%</div>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/40">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Flame className="w-3.5 h-3.5 text-red-400" />
              <span>ชนะติดกันสูงสุด</span>
            </div>
            <div className="text-xl font-bold text-amber-400">{stats.maxStreak} <span className="text-xs text-slate-400 font-normal">รอบ</span></div>
          </div>

          <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/40">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Trophy className="w-3.5 h-3.5 text-yellow-400" />
              <span>กำไรสูงสุดในรอบเดียว</span>
            </div>
            <div className="text-xl font-bold text-amber-300">+{stats.biggestWin.toLocaleString()}</div>
          </div>
        </div>

        {/* Win/Loss summary bar */}
        <div className="bg-slate-800/40 p-3 rounded-2xl border border-slate-700/30">
          <div className="flex justify-between text-xs text-slate-300 mb-1.5">
            <span>ชนะ: <strong className="text-emerald-400">{stats.wins}</strong></span>
            <span>แพ้: <strong className="text-red-400">{stats.losses}</strong></span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden flex">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${stats.totalRounds > 0 ? (stats.wins / stats.totalRounds) * 100 : 50}%` }}
            />
            <div
              className="h-full bg-red-500 transition-all duration-300"
              style={{ width: `${stats.totalRounds > 0 ? (stats.losses / stats.totalRounds) * 100 : 50}%` }}
            />
          </div>
        </div>

        {/* Done Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm transition-colors cursor-pointer"
        >
          ปิดหน้าต่าง
        </button>
      </div>
    </div>
  );
};
