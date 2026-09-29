import React from 'react';
import { LogOut, X, ShieldCheck, Mail, User, Coins, Trophy } from 'lucide-react';
import { UserProfile } from '../../domain/entities/User';

interface UserProfileModalProps {
  isOpen: boolean;
  user: UserProfile | null;
  balance: number;
  totalRounds: number;
  winRate: number;
  isAdmin?: boolean;
  onClose: () => void;
  onLogout: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  user,
  balance,
  totalRounds,
  winRate,
  isAdmin = false,
  onClose,
  onLogout,
}) => {
  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Profile Header */}
        <div className="flex items-center gap-4">
          <div className="relative">
            {user.picture ? (
              <img
                src={user.picture}
                alt={user.name}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-500/40 shadow-lg shadow-amber-500/20"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 font-black text-2xl flex items-center justify-center shadow-lg">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div
              className="absolute -bottom-1 -right-1 p-1 rounded-full bg-slate-900 border border-slate-700"
              title="Google Verified"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>{user.name}</span>
            </h2>
            <div className="text-xs text-slate-400 flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-slate-500" />
              <span>{user.email}</span>
            </div>
            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {user.provider === 'google' ? 'Google Account Connected' : 'Demo Profile'}
            </span>
            {isAdmin && (
              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                ⚡ ผ้ดู้แล้ระบบ (Admin)
              </span>
            )}
          </div>
        </div>

        {/* Account Cloud Storage Stats */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            ข้อมูลที่บันทึกไว้ในบัญชีนี้
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center justify-center text-amber-400 mb-1">
                <Coins className="w-4 h-4" />
              </div>
              <div className="text-[10px] text-slate-400">ชิปคงเหลือ</div>
              <div className="text-sm font-black text-amber-300">{balance.toLocaleString()}</div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center justify-center text-blue-400 mb-1">
                <User className="w-4 h-4" />
              </div>
              <div className="text-[10px] text-slate-400">เล่นทั้งหมด</div>
              <div className="text-sm font-bold text-white">{totalRounds} รอบ</div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="flex items-center justify-center text-emerald-400 mb-1">
                <Trophy className="w-4 h-4" />
              </div>
              <div className="text-[10px] text-slate-400">อัตราชนะ</div>
              <div className="text-sm font-bold text-emerald-400">{winRate}%</div>
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            * ยอดชิปและสถิติการเล่นจะถูกผูกไว้กับบัญชี Google นี้โดยเฉพาะ เมื่อกลับมาเข้าสู่ระบบอีกครั้ง ข้อมูลจะโหลดกลับมาอัตโนมัติ
          </p>
        </div>

        {/* Logout Action */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onLogout}
            className="flex-1 py-2.5 px-4 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-red-400" />
            <span>ออกจากระบบ</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors cursor-pointer"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
