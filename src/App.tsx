import React from 'react';
import { useGameEngine } from './presentation/store/useGameStore';
import { WalletBar } from './presentation/components/WalletBar';
import { DiceCup3D } from './presentation/components/DiceCup3D';
import { BetBoard } from './presentation/components/BetBoard';
import { OutcomeAlert } from './presentation/components/OutcomeAlert';
import { HistoryRoadmap } from './presentation/components/HistoryRoadmap';
import { StatsModal } from './presentation/components/StatsModal';
import { DisclaimerBanner } from './presentation/components/DisclaimerBanner';

export const App: React.FC = () => {
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
    selectBetOption,
    selectBetAmount,
    clearBet,
    toggleSound,
    rollDice,
    claimBailout,
    claimDaily,
    resetAllData,
  } = useGameEngine();

  // Determine current category
  const isTriple = dice[0] === dice[1] && dice[1] === dice[2];
  const category = isTriple ? 'TRIPLE' : sum >= 11 ? 'HIGH' : 'LOW';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between py-2 px-3 sm:py-6 sm:px-4">
      <div className="w-full max-w-md mx-auto space-y-3">
        {/* Top Wallet Header */}
        <WalletBar
          balance={balance}
          canBailout={canBailout}
          bailoutTimer={bailoutTimer}
          canDailyClaim={canDailyClaim}
          dailyTimer={dailyTimer}
          isMuted={isMuted}
          onClaimBailout={claimBailout}
          onClaimDaily={claimDaily}
          onToggleSound={toggleSound}
          onOpenStats={() => setShowStatsModal(true)}
          onReset={resetAllData}
        />

        {/* 3D Dice Stage */}
        <DiceCup3D
          dice={dice}
          sum={sum}
          isRolling={isRolling}
          category={category}
          isTriple={isTriple}
        />

        {/* Win/Loss or Error Alert */}
        <OutcomeAlert outcome={lastOutcome} error={error} />

        {/* Bet Selection & Action Board */}
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

      {/* Compliance Disclaimer Footer */}
      <DisclaimerBanner />

      {/* Statistics Modal */}
      <StatsModal
        isOpen={showStatsModal}
        stats={stats}
        onClose={() => setShowStatsModal(false)}
      />
    </div>
  );
};

export default App;
