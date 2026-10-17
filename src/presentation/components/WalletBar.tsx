import React, { useEffect, useState } from 'react';
import {
  Coins,
  Gift,
  Volume2,
  VolumeX,
  BarChart3,
  RefreshCw,
  ShieldCheck,
  Crown,
  Menu,
  X,
} from 'lucide-react';
import { UserProfile } from '../../domain/entities/User';
import { GoogleAuthButton } from './GoogleAuthButton';

interface WalletBarProps {
  balance: number;
  isMuted: boolean;
  user: UserProfile | null;
  isConfigured: boolean;
  clientId: string;
  onOpenProfile: () => void;
  onOpenConfig: () => void;
  onCredentialSuccess: (credential: string) => void;
  onTopUp: () => void;
  onWithdraw: () => void;
  onToggleSound: () => void;
  onOpenStats: () => void;
  onReset: () => void;
  isAdmin: boolean;
  isCreator?: boolean;
  onOpenAdmin: () => void;
  onOpenDashboard?: () => void;
}

export const WalletBar: React.FC<WalletBarProps> = ({
  balance,
  isMuted,
  user,
  isConfigured,
  clientId,
  onOpenProfile,
  onOpenConfig,
  onCredentialSuccess,
  onTopUp,
  onWithdraw,
  onToggleSound,
  onOpenStats,
  onReset,
  isAdmin,
  isCreator = false,
  onOpenAdmin,
  onOpenDashboard,
}) => {
  // สวิตช์เมนู burger slide (ใช้เฉพาะ mobile)
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  // ปิดเมนูเมื่อกด Escape และล็อก scroll ของหน้าหลังตราบใดที่เมนูเปิดอยู่
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [menuOpen]);

  const balanceLabel = user
    ? `ยอดชิปบัญชี ${user.givenName || user.name}`
    : 'ยอดชิปจำลองคงเหลือ';

  const roleBadge = isCreator ? (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
      👑 ผู้สร้าง (Admin++)
    </span>
  ) : isAdmin ? (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
      ⚡ ผู้ดูแล (Admin)
    </span>
  ) : null;

  const adminAccent = isCreator
    ? 'bg-amber-950/50 border-amber-500/40 text-amber-300 hover:text-amber-200 hover:bg-amber-900/50'
    : 'bg-purple-950/50 border-purple-500/40 text-purple-300 hover:text-purple-200 hover:bg-purple-900/50';

  const adminDashboardAccent = isCreator
    ? 'bg-gradient-to-r from-amber-500/25 to-yellow-500/25 border-amber-500/60 text-amber-300 hover:brightness-125'
    : 'bg-purple-950/70 border-purple-500/50 text-purple-300 hover:bg-purple-900/70';

  const adminIcon = isCreator ? (
    <Crown className="w-4 h-4" />
  ) : (
    <ShieldCheck className="w-4 h-4" />
  );

  return (
    <>
      <header className="w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30 transition-all">
        {/* ===== Mobile: แถวเดียวย่อย่ิง + ปุ่ม burger ===== */}
        <div className="lg:hidden flex items-center justify-between gap-2 px-3 py-2.5">
          {/* Brand */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/25 text-lg">
              🎲
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-extrabold tracking-tight text-white leading-tight truncate">
                High-Low Dice
              </h1>
              <span className="text-[10px] text-emerald-400 font-medium tracking-wide flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-ping" />
                ชิปเล่น 100%
              </span>
            </div>
          </div>

          {/* Balance ย่อ */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 shadow-md">
            <Coins className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-base font-black text-amber-300 tracking-tight">
              {balance.toLocaleString()}
            </span>
          </div>

          {/* ปุ่ม burger */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="เปิดเมนู"
            aria-expanded={menuOpen}
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* ===== Desktop: แถวเดียว — brand ซ้าย / balance กลาง / actions ขวา ===== */}
        <div className="hidden lg:flex items-center gap-6 max-w-7xl mx-auto px-6 xl:px-8 py-3">
          {/* Brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/25 text-xl">
              🎲
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold tracking-tight text-white leading-tight">
                  High-Low Dice
                </h1>
              </div>
            </div>
          </div>

          {/* Balance กลาง */}
          <div className="flex-1 flex justify-center">
            <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-900 px-5 py-2 rounded-2xl border border-slate-700/80 shadow-md flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400">
                <Coins className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                  {balanceLabel}
                  {roleBadge}
                </div>
                <div className="text-xl font-black text-amber-300 tracking-tight flex items-baseline gap-1.5">
                  <span>{balance.toLocaleString()}</span>
                  <span className="text-xs text-amber-400/90 font-medium">CHIPS</span>
                </div>
              </div>
              <div className="hidden xl:flex flex-col items-end pl-3 border-l border-slate-800">
                <span className="text-[10px] text-slate-400">ระดับเครดิต</span>
                <span className="text-xs font-bold text-emerald-400">
                  {balance >= 1000 ? '⭐ เสี่ยงชิป' : balance >= 200 ? '✨ ปกติ' : '⚠️ ชิปเหลือน้อย'}
                </span>
              </div>
            </div>
          </div>

          {/* Actions ขวา */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onTopUp}
              className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-md shadow-emerald-500/30 hover:scale-105 active:scale-95"
              title={user ? 'เติมชิป' : 'เข้าสู่ระบบเพื่อเติมชิป'}
            >
              <Gift className="w-4 h-4" />
              <span>เติมชิป</span>
            </button>

            <button
              type="button"
              onClick={onWithdraw}
              className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer bg-slate-900 border border-slate-700 text-white hover:bg-slate-800 shadow-sm hover:scale-105 active:scale-95"
              title={user ? 'ถอนเงิน' : 'เข้าสู่ระบบเพื่อถอนเงิน'}
            >
              <Coins className="w-4 h-4 text-amber-400" />
              <span>ถอนเงิน</span>
            </button>

            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-800">
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

              {isAdmin && (
                <>
                  {onOpenDashboard && (
                    <button
                      type="button"
                      onClick={onOpenDashboard}
                      className={`py-1.5 px-3 rounded-xl border flex items-center gap-1.5 font-bold text-xs transition-all cursor-pointer shadow-lg ${adminDashboardAccent}`}
                      title={isCreator ? 'เปิดแดชบอร์ด Admin++ เต็มรูปแบบ' : 'เปิดแดชบอร์ด Admin เต็มรูปแบบ'}
                    >
                      {isCreator ? (
                        <Crown className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5 text-purple-300" />
                      )}
                      <span>{isCreator ? '👑 Admin++ แดชบอร์ด' : '⚡ Admin แดชบอร์ด'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onOpenAdmin}
                    className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${adminAccent}`}
                    title={isCreator ? 'Creator Console (หน้าต่างด่วน)' : 'Admin Console (หน้าต่างด่วน)'}
                  >
                    {adminIcon}
                  </button>
                </>
              )}
            </div>

            <div className="pl-2 border-l border-slate-800">
              <GoogleAuthButton
                user={user}
                isConfigured={isConfigured}
                clientId={clientId}
                onOpenProfile={onOpenProfile}
                onOpenConfig={onOpenConfig}
                onCredentialSuccess={onCredentialSuccess}
              />
            </div>
          </div>
        </div>
      </header>

      {/* ===== Mobile Drawer: backdrop ===== */}
      <div
        className={`lg:hidden fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          menuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeMenu}
        aria-hidden="true"
      />

      {/* ===== Mobile Drawer: แผงเมนูสไลด์จากขวามือ ===== */}
      <aside
        className={`lg:hidden fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-slate-900 border-l border-slate-800 shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-out ${
          menuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="เมนู"
      >
        {/* หัว drawer */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-slate-950 font-black text-base">
              🎲
            </div>
            <div>
              <div className="text-sm font-extrabold text-white leading-tight">High-Low Dice</div>
              <div className="text-[10px] text-slate-400">เมนูและตั้งค่า</div>
            </div>
          </div>
          <button
            type="button"
            onClick={closeMenu}
            className="p-2 rounded-xl bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
            aria-label="ปิดเมนู"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* เนื้อหา drawer */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* บัญชี */}
          <section className="space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">บัญชี</h3>
            <GoogleAuthButton
              user={user}
              isConfigured={isConfigured}
              clientId={clientId}
              onOpenProfile={onOpenProfile}
              onOpenConfig={onOpenConfig}
              onCredentialSuccess={onCredentialSuccess}
            />
            {roleBadge && (
              <div className="flex justify-center">{roleBadge}</div>
            )}
          </section>

          {/* ชิป */}
          <section className="space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">ชิป</h3>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => {
                  onTopUp();
                  closeMenu();
                }}
                className="w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-md shadow-emerald-500/30 hover:scale-[1.02] active:scale-95"
              >
                <Gift className="w-4 h-4" />
                <span>เติมชิป</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onWithdraw();
                  closeMenu();
                }}
                className="w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer bg-slate-900 border border-slate-800 text-white hover:bg-slate-800 shadow-sm hover:scale-[1.02] active:scale-95"
              >
                <Coins className="w-4 h-4 text-amber-400" />
                <span>ถอนเงิน</span>
              </button>
            </div>
          </section>

          {/* เครื่องมือ */}
          <section className="space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">เครื่องมือ</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onToggleSound();
                  closeMenu();
                }}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs font-bold text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                <span>{isMuted ? 'เปิดเสียง' : 'ปิดเสียง'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onOpenStats();
                  closeMenu();
                }}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs font-bold text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <BarChart3 className="w-4 h-4 text-amber-400" />
                <span>สถิติ</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onReset();
                  closeMenu();
                }}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs font-bold text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>รีเซ็ตชิป</span>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenAdmin();
                    closeMenu();
                  }}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${adminAccent}`}
                >
                  {adminIcon}
                  <span>{isCreator ? 'Creator' : 'Admin'}</span>
                </button>
              )}
            </div>
          </section>

          {/* แดชบอร์ด (admin/creator) */}
          {isAdmin && onOpenDashboard && (
            <section className="space-y-2">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">แดชบอร์ด</h3>
              <button
                type="button"
                onClick={() => {
                  onOpenDashboard();
                  closeMenu();
                }}
                className={`w-full py-2.5 rounded-xl border flex items-center justify-center gap-1.5 font-bold text-xs transition-all cursor-pointer shadow-lg ${adminDashboardAccent}`}
              >
                {isCreator ? (
                  <Crown className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-300" />
                )}
                <span>{isCreator ? '👑 Admin++ แดชบอร์ด' : '⚡ Admin แดชบอร์ด'}</span>
              </button>
            </section>
          )}

          {/* กติกาจ่ายรางวัลย่อ */}
          <section className="space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">กติกาจ่ายรางวัล</h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-blue-950/40 border border-blue-500/20">
                <div className="text-blue-300 font-bold text-[11px]">ต่ำ (4-10)</div>
                <div className="text-[10px] text-slate-400">จ่าย 1:1</div>
              </div>
              <div className="p-2 rounded-lg bg-purple-950/40 border border-purple-500/20">
                <div className="text-amber-300 font-bold text-[11px]">ตอง (1-6)</div>
                <div className="text-[10px] text-slate-400">จ่าย 30:1</div>
              </div>
              <div className="p-2 rounded-lg bg-red-950/40 border border-red-500/20">
                <div className="text-red-300 font-bold text-[11px]">สูง (11-17)</div>
                <div className="text-[10px] text-slate-400">จ่าย 1:1</div>
              </div>
            </div>
          </section>
        </div>
      </aside>
    </>
  );
};
