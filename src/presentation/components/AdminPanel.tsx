import React, { useState } from 'react';
import { ShieldCheck, Crown, X, Coins, Zap, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { UserProfile } from '../../domain/entities/User';

interface AdminPanelProps {
  isOpen: boolean;
  adminUser: UserProfile;
  isCreator?: boolean;
  onClose: () => void;
  onGrantChips: (userId: string, amount: number) => Promise<{ grantedAmount: number; newBalance: number }>;
  onResetCooldowns: (userId: string) => Promise<void>;
  onResetWallet: (userId: string) => Promise<void>;
  // Creator-Only
  onShowWallets: () => Promise<{ id: string; balance: number; lastBailoutAt?: number; lastDailyClaimAt?: number }[]>;
  onBanUser: (userId: string) => Promise<void>;
  onShowAuditLogs: () => Promise<{ action: string; target?: string; detail?: string; time: string }[]>;
}

const QUICK_AMOUNTS = [100, 500, 1000, 5000];

/**
 * Admin/Creator Console — แสดงเฉพาะผู้มีสิทธิ์ระดับ admin ขึ้นไป
 * (ตรวจสอบแล้วที่ฝั่ง GoogleAuthService จาก email ใน AdminConfig)
 */
export const AdminPanel: React.FC<AdminPanelProps> = ({
  isOpen,
  adminUser,
  isCreator = false,
  onClose,
  onGrantChips,
  onResetCooldowns,
  onResetWallet,
  onShowWallets,
  onBanUser,
  onShowAuditLogs,
}) => {
  const [targetUserId, setTargetUserId] = useState('');
  const [amount, setAmount] = useState(500);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  if (!isOpen) return null;

  const effectiveTarget = targetUserId.trim() || adminUser.id;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setFeedback(null);
    try {
      await fn();
    } catch (err) {
      setFeedback({ ok: false, text: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' });
    } finally {
      setBusy(false);
    }
  };

  const handleGrant = () =>
    run(async () => {
      const res = await onGrantChips(effectiveTarget, amount);
      setFeedback({
        ok: true,
        text: `เพิ่ม +${res.grantedAmount.toLocaleString()} ชิปให้ ${effectiveTarget} → ยอดใหม่ ${res.newBalance.toLocaleString()}`,
      });
    });

  const handleResetCooldowns = () =>
    run(async () => {
      await onResetCooldowns(effectiveTarget);
      setFeedback({ ok: true, text: `ล้าง Cooldown (Bailout + Daily) ของ ${effectiveTarget} แล้ว` });
    });

  const handleResetWallet = () =>
    run(async () => {
      if (!window.confirm(`รีเซ็ตกระเป๋าชิปของ ${effectiveTarget} กลับเป็น 1,000 ชิป?`)) return;
      await onResetWallet(effectiveTarget);
      setFeedback({ ok: true, text: `รีเซ็ตกระเป๋าชิปของ ${effectiveTarget} แล้ว (กลับเป็น 1,000)` });
    });

  const handleViewAllWallets = () =>
    run(async () => {
      const wallets = await onShowWallets();
      setFeedback({
        ok: true,
        text: `พบ ${wallets.length} กระเป๋า — กดดูรายละเอียดแต่ละใบ (ตัวอย่าง: ${wallets.slice(0, 3).map((w: { id: string }) => w.id).join(', ')})`,
      });
    });

  const handleBanUser = () =>
    run(async () => {
      if (!effectiveTarget) {
        setFeedback({ ok: false, text: 'กรุณาระบุ User ID ที่จะ ban' });
        return;
      }
      await onBanUser(effectiveTarget);
      setFeedback({ ok: true, text: `Ban แล้ว — ${effectiveTarget} ไม่สามารถเล่นได้อีก` });
    });

  const handleViewAudit = () =>
    run(async () => {
      const logs = await onShowAuditLogs();
      setFeedback({
        ok: true,
        text: `Audit Log: ${logs.length} รายการ — กดดูรายละเอียด (ตัวอย่าง: ${logs.slice(0, 2).map((l: { action: string }) => l.action).join(', ')})`,
      });
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-purple-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5">
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl border ${
            isCreator
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
              : 'bg-purple-500/15 border-purple-500/30 text-purple-300'
          }`}>
            {isCreator ? <Crown className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              {isCreator ? 'Creator Console' : 'Admin Console'}
            </h2>
            <div className="text-[11px] text-slate-400">
              {adminUser.email}
              {isCreator ? ' · 👑 ผู้สร้าง เหนือกว่า Admin' : ' · ⚡ ผู้ดูแลระบบ'}
            </div>
          </div>
        </div>

        {/* Target User */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            เป้าหมาย (Wallet ID)
          </label>
          <input
            type="text"
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            placeholder={adminUser.id}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-purple-500/50"
          />
          <p className="text-[11px] text-slate-500">
            เว้นว่าง = ใช้บัญชีของตัวเอง ({adminUser.id}) ·{' '}
            <span className="text-slate-400">guest</span> = ผู้เล่นที่ไม่ล็อกอิน ·{' '}
            <span className="text-slate-400">google_&lt;sub&gt;</span> = ผู้ใช้ Google
          </p>
        </div>

        {/* Grant Chips */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-amber-300">
            <Coins className="w-4 h-4" />
            <span className="text-xs font-bold">เพิ่มชิป (ไม่จำกัดจำนวน)</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              step={50}
              value={amount}
              onChange={(e) => setAmount(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
              className="w-28 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-amber-300 font-bold focus:outline-none focus:border-amber-500/50"
            />
            <div className="flex-1 grid grid-cols-4 gap-1.5">
              {QUICK_AMOUNTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(q)}
                  className={`py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                    amount === q
                      ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                      : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  +{q}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={handleGrant}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-xs hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {busy ? 'กำลังดำเนินการ...' : `เพิ่มชิป +${amount.toLocaleString()}`}
          </button>
        </div>

        {/* Cooldown / Reset */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={handleResetCooldowns}
            className="py-2.5 px-3 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center gap-2 hover:border-emerald-500/40 hover:text-emerald-300 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Zap className="w-4 h-4" />
            <span>ล้าง Cooldown</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleResetWallet}
            className="py-2.5 px-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 font-bold text-xs flex items-center justify-center gap-2 hover:bg-red-900/60 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>รีเซ็ตกระเป๋า</span>
          </button>
        </div>

        {/* Advanced Management Tools (Admin & Creator) */}
        <div className="pt-1 border-t border-slate-700/50">
          <p className={`text-[10px] uppercase tracking-wider font-semibold mb-2 ${
            isCreator ? 'text-amber-400/90' : 'text-purple-400/90'
          }`}>
            {isCreator ? '👑 Creator Exclusive (ผู้สร้างสูงสุด)' : '⚡ Admin Tools (เครื่องมือแอดมิน)'}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleViewAllWallets}
              className="py-2.5 px-2 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-300 font-bold text-[11px] flex items-center justify-center gap-1 hover:border-amber-500/40 hover:text-amber-300 transition-colors disabled:opacity-50 cursor-pointer"
            >
              👁️ Wallets
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleBanUser}
              className="py-2.5 px-2 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 font-bold text-[11px] flex items-center justify-center gap-1 hover:bg-red-900/60 transition-colors disabled:opacity-50 cursor-pointer"
            >
              🚫 Ban
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleViewAudit}
              className="py-2.5 px-2 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-300 font-bold text-[11px] flex items-center justify-center gap-1 hover:border-blue-500/40 hover:text-blue-300 transition-colors disabled:opacity-50 cursor-pointer"
            >
              📋 Audit
            </button>
          </div>
        </div>

        {/* Feedback */}
        {feedback && (
          <div
            className={`flex items-start gap-2 p-3 rounded-xl text-[11px] font-medium border ${
              feedback.ok
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}
          >
            {feedback.ok ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        <p className="text-[10px] text-slate-600">
          * สิทธิ์นี้จำกัดเฉพาะผู้ดูแลระบบที่ระบุใน AdminConfig (ตรวจสอบจาก email Google ที่ยืนยันแล้ว) ·
          ข้อมูลเก็บใน LocalStorage ของเบราว์เซอร์เครื่องนี้
        </p>
      </div>
    </div>
  );
};
