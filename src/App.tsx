import React, { useEffect, useState } from 'react';
import { useGameEngine } from './presentation/store/useGameStore';
import { useAuth } from './presentation/store/useAuthStore';
import { WalletBar } from './presentation/components/WalletBar';
import { DiceCup3D } from './presentation/components/DiceCup3D';
import { BetBoard } from './presentation/components/BetBoard';
import { OutcomeAlert } from './presentation/components/OutcomeAlert';
import { HistoryRoadmap } from './presentation/components/HistoryRoadmap';
import { StatsModal } from './presentation/components/StatsModal';
import { ResultModal } from './presentation/components/ResultModal';
import { GoogleConfigModal } from './presentation/components/GoogleConfigModal';
import { UserProfileModal } from './presentation/components/UserProfileModal';
import { AdminPanel } from './presentation/components/AdminPanel';
import { AdminDashboard } from './presentation/components/AdminDashboard';
import { DisclaimerBanner } from './presentation/components/DisclaimerBanner';
import { hasAdminAccess } from './domain/constants/AdminConfig';
import { Trophy, Percent, Flame, Sparkles } from 'lucide-react';

export const App: React.FC = () => {
  // Authentication Engine
  const {
    user,
    isConfigured,
    clientId,
    showConfigModal,
    setShowConfigModal,
    showProfileModal,
    setShowProfileModal,
    loginWithCredential,
    loginWithMock,
    logout,
  } = useAuth();

  // สิทธิ์ผู้ดูแลระบบ: email Google ที่ Google ยืนยันแล้วอยู่ใน AdminConfig
  const isAdmin = hasAdminAccess(user?.role);
  const isCreator = user?.role === 'creator';
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [view, setView] = useState<'game' | 'dashboard'>('game');

  // Game Engine (scoped by user.id if logged in, or guest if not)
  const {
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
    syncState,
  } = useGameEngine(user?.id, isAdmin, isCreator);

  // Determine current category
  const isTriple = dice[0] === dice[1] && dice[1] === dice[2];
  const category = isTriple ? 'TRIPLE' : sum >= 11 ? 'HIGH' : 'LOW';

  // Sync view with URL hash (#dashboard or #admin)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#dashboard' || hash === '#admin') {
        if (isAdmin || isCreator) {
          setView('dashboard');
        } else if (!user) {
          // ถ้ายังไม่ได้ล็อกอินและพยายามเข้า #admin หรือ #dashboard ให้เปิดหน้าต่างล็อกอินทันที
          setShowConfigModal(true);
        }
      } else if (hash === '#game' || hash === '' || hash === '#') {
        setView('game');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isAdmin, isCreator, user, setShowConfigModal]);

  // Desktop Keyboard Shortcut: Press Spacebar to Roll
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        if (!isRolling && betOption && balance >= betAmount) {
          rollDice();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRolling, betOption, balance, betAmount, rollDice]);

  // Dedicated Full-Page Admin / Creator Dashboard View
  if (view === 'dashboard' && (isAdmin || isCreator)) {
    return (
      <AdminDashboard
        currentUser={
          user || {
            id: isCreator ? 'creator_demo' : 'admin_demo',
            name: isCreator ? 'Songpon (Creator)' : 'Seree (Admin)',
            email: isCreator ? 'songpon.official@gmail.com' : 'seree999@gmail.com',
            provider: 'google',
            role: isCreator ? 'creator' : 'admin',
            loggedInAt: Date.now(),
          }
        }
        isCreator={isCreator}
        onReturnToGame={() => {
          setView('game');
          window.location.hash = '';
        }}
        onRefreshWallet={() => {
          syncState();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950">
      {/* 1. Full-Width Responsive Header */}
      <WalletBar
        balance={balance}
        canBailout={canBailout}
        bailoutTimer={bailoutTimer}
        canDailyClaim={canDailyClaim}
        dailyTimer={dailyTimer}
        isMuted={isMuted}
        user={user}
        isConfigured={isConfigured}
        clientId={clientId}
        onOpenProfile={() => setShowProfileModal(true)}
        onOpenConfig={() => setShowConfigModal(true)}
        onOpenDashboard={() => {
          setView('dashboard');
          window.location.hash = '#dashboard';
        }}
        onCredentialSuccess={(credential) => {
          loginWithCredential(credential);
        }}
        onClaimBailout={claimBailout}
        onClaimDaily={claimDaily}
        onToggleSound={toggleSound}
        onOpenStats={() => setShowStatsModal(true)}
        onReset={resetAllData}
        isAdmin={isAdmin}
        isCreator={user?.role === 'creator'}
        onOpenAdmin={() => setShowAdminPanel(true)}
      />

      {/* 2. Main Game Viewport: Dual Mobile & Desktop Layout */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-5 lg:py-6">
        {/* Mobile View (< lg): Streamlined Vertical Single-Thumb Column */}
        <div className="block lg:hidden w-full max-w-md mx-auto space-y-3">
          {/* 3D Dice Stage */}
          <DiceCup3D
            dice={dice}
            sum={sum}
            isRolling={isRolling}
            category={category}
            isTriple={isTriple}
          />

          {/* Outcome & Error Alert */}
          <OutcomeAlert outcome={lastOutcome} error={error} />

          {/* Betting Board */}
          <BetBoard
            selectedOption={betOption}
            selectedAmount={betAmount}
            balance={balance}
            isRolling={isRolling}
            onSelectOption={selectBetOption}
            onSelectAmount={selectBetAmount}
            onClearBet={clearBet}
            onRoll={rollDice}
          />

          {/* History Roadmap */}
          <HistoryRoadmap roadmap={stats.roadmap} />
        </div>

        {/* Desktop View (>= lg): Expansive Casino Table & Betting Dashboard */}
        <div className="hidden lg:grid grid-cols-12 gap-6 xl:gap-8 items-start">
          {/* Left Column (7 cols): Casino Dice Stage & Statistics */}
          <section className="col-span-7 xl:col-span-7 space-y-4">
            {/* Expanded 3D Felt Table */}
            <DiceCup3D
              dice={dice}
              sum={sum}
              isRolling={isRolling}
              category={category}
              isTriple={isTriple}
            />

            {/* Outcome Celebration Card */}
            <OutcomeAlert outcome={lastOutcome} error={error} />

            {/* Roadmap History Stream */}
            <HistoryRoadmap roadmap={stats.roadmap} />

            {/* Desktop Quick-Stats Strip */}
            <div className="grid grid-cols-4 gap-3 pt-1">
              <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-2xl flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                  <Trophy className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">เล่นทั้งหมด</div>
                  <div className="text-base font-bold text-white">{stats.totalRounds} <span className="text-xs text-slate-400 font-normal">รอบ</span></div>
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-2xl flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <Percent className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">อัตราชนะ</div>
                  <div className="text-base font-bold text-emerald-400">{stats.winRatePercentage}%</div>
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-2xl flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">ชนะต่อเนื่อง</div>
                  <div className="text-base font-bold text-amber-300">{stats.currentStreak} <span className="text-xs text-amber-400/70 font-normal">(สูงสุด {stats.maxStreak})</span></div>
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-2xl flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">กำไรสูงสุด</div>
                  <div className="text-base font-bold text-purple-300">+{stats.biggestWin.toLocaleString()}</div>
                </div>
              </div>
            </div>
          </section>

          {/* Right Column (5 cols): Betting Terminal & Console */}
          <aside className="col-span-5 xl:col-span-5 space-y-4">
            <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 shadow-2xl backdrop-blur-md space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <h2 className="text-sm font-bold tracking-tight text-white uppercase">
                    คอนโซลวางเดิมพัน (Betting Rack)
                  </h2>
                </div>
                <span className="text-xs text-slate-400 font-medium">ขั้นต่ำ 10 / สูงสุด 500</span>
              </div>

              {/* Responsive Bet Board */}
              <BetBoard
                selectedOption={betOption}
                selectedAmount={betAmount}
                balance={balance}
                isRolling={isRolling}
                onSelectOption={selectBetOption}
                onSelectAmount={selectBetAmount}
                onClearBet={clearBet}
                onRoll={rollDice}
              />

              {/* Game Rules Quick Reference Card */}
              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 space-y-1.5">
                <div className="font-semibold text-slate-300 flex items-center justify-between">
                  <span>สรุปกติกาการจ่ายรางวัล:</span>
                  <span className="text-amber-400">Zero Real Money</span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                  <div className="p-1.5 rounded-lg bg-blue-950/40 border border-blue-500/20">
                    <div className="text-blue-300 font-bold">ต่ำ (4-10)</div>
                    <div className="text-[10px] text-slate-400">จ่าย 1:1</div>
                  </div>
                  <div className="p-1.5 rounded-lg bg-purple-950/40 border border-purple-500/20">
                    <div className="text-amber-300 font-bold">ตอง (1-6)</div>
                    <div className="text-[10px] text-slate-400">จ่าย 30:1</div>
                  </div>
                  <div className="p-1.5 rounded-lg bg-red-950/40 border border-red-500/20">
                    <div className="text-red-300 font-bold">สูง (11-17)</div>
                    <div className="text-[10px] text-slate-400">จ่าย 1:1</div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* 3. Full-Width Disclaimer Footer */}
      <DisclaimerBanner />

      {/* 4. Statistics Modal */}
      <StatsModal
        isOpen={showStatsModal}
        stats={stats}
        onClose={() => setShowStatsModal(false)}
      />

      {/* 5. Clear Result Announcement Modal */}
      <ResultModal
        isOpen={showResultModal}
        onClose={() => setShowResultModal(false)}
        onPlayAgain={() => {
          setShowResultModal(false);
          rollDice();
        }}
        dice={dice}
        sum={sum}
        category={category}
        isTriple={isTriple}
        betOption={betOption}
        betAmount={betAmount}
        outcome={lastOutcome}
        balance={balance}
        currentStreak={stats.currentStreak}
      />

      {/* 6. Google Config Setup Modal */}
      <GoogleConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        onMockLogin={(mock) => loginWithMock(mock)}
      />

      {/* 7. Google User Profile Modal */}
      <UserProfileModal
        isOpen={showProfileModal}
        user={user}
        balance={balance}
        totalRounds={stats.totalRounds}
        winRate={stats.winRatePercentage}
        isAdmin={isAdmin}
        isCreator={user?.role === 'creator'}
        onOpenDashboard={() => {
          setView('dashboard');
          window.location.hash = '#dashboard';
        }}
        onClose={() => setShowProfileModal(false)}
        onLogout={logout}
      />

      {/* 8. Admin/Creator Console */}
      {(isAdmin || isCreator) && user && (
        <AdminPanel
          isOpen={showAdminPanel}
          adminUser={user}
          isCreator={user?.role === 'creator'}
          onClose={() => setShowAdminPanel(false)}
          onGrantChips={adminGrantChips}
          onResetCooldowns={adminResetCooldowns}
          onResetWallet={adminResetWallet}
          // Creator-Only Actions
          onShowWallets={showWallets}
          onBanUser={banUser}
          onShowAuditLogs={showAuditLogs}
        />
      )}
    </div>
  );
};

export default App;
