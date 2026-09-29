import React, { useState, useEffect } from 'react';

interface DiceProps {
  value: number;
  isRolling: boolean;
  dieIndex: number;
  rollEpoch: number;
}

const DIE_BASE_ROTATIONS: Record<number, [number, number]> = {
  1: [0, 0],
  6: [0, 180],
  2: [0, 90],
  5: [0, -90],
  3: [-90, 0],
  4: [90, 0],
};

const SingleDie: React.FC<DiceProps> = ({ value, isRolling, dieIndex, rollEpoch }) => {
  const baseRot = DIE_BASE_ROTATIONS[value] || [0, 0];
  
  // Calculate multi-revolution rotation so the die rolls naturally into place
  // Adding varied revolutions for each die index creates an organic, unsynchronized landing
  const extraRotX = (rollEpoch * 720) + (dieIndex === 0 ? 360 : dieIndex === 1 ? 720 : 1080);
  const extraRotY = (rollEpoch * 720) + (dieIndex === 0 ? 720 : dieIndex === 1 ? 360 : 720);

  const targetTransform = `rotateX(${baseRot[0] + extraRotX}deg) rotateY(${baseRot[1] + extraRotY}deg)`;
  const rollingClass = dieIndex === 0 ? 'dice-rolling-1' : dieIndex === 1 ? 'dice-rolling-2' : 'dice-rolling-3';

  return (
    <div className="dice-wrapper perspective-1000 p-2 sm:p-3">
      {/* 3D Die Cube */}
      <div
        className={`dice-container ${isRolling ? rollingClass : ''}`}
        style={!isRolling ? { transform: targetTransform } : undefined}
      >
        {/* Face 1 (Front - Red Ace) */}
        <div className="dice-face face-1 flex items-center justify-center">
          <span className="pip red !w-4 !h-4 sm:!w-5 sm:!h-5" />
        </div>

        {/* Face 6 (Back) */}
        <div className="dice-face face-6 flex flex-col justify-between">
          <div className="flex justify-between"><span className="pip" /><span className="pip" /></div>
          <div className="flex justify-between"><span className="pip" /><span className="pip" /></div>
          <div className="flex justify-between"><span className="pip" /><span className="pip" /></div>
        </div>

        {/* Face 2 (Right) */}
        <div className="dice-face face-2 flex justify-between">
          <span className="pip" />
          <span className="pip self-end" />
        </div>

        {/* Face 5 (Left) */}
        <div className="dice-face face-5 flex flex-col justify-between">
          <div className="flex justify-between"><span className="pip" /><span className="pip" /></div>
          <div className="flex justify-center"><span className="pip" /></div>
          <div className="flex justify-between"><span className="pip" /><span className="pip" /></div>
        </div>

        {/* Face 3 (Top) */}
        <div className="dice-face face-3 flex justify-between">
          <span className="pip" />
          <span className="pip self-center" />
          <span className="pip self-end" />
        </div>

        {/* Face 4 (Bottom) */}
        <div className="dice-face face-4 flex flex-col justify-between">
          <div className="flex justify-between"><span className="pip" /><span className="pip" /></div>
          <div className="flex justify-between"><span className="pip" /><span className="pip" /></div>
        </div>
      </div>

      {/* Dynamic Table Contact Shadow */}
      <div className={`dice-shadow ${isRolling ? 'shadow-rolling' : ''}`} />
    </div>
  );
};

interface DiceCup3DProps {
  dice: [number, number, number];
  sum: number;
  isRolling: boolean;
  category: 'HIGH' | 'LOW' | 'TRIPLE';
  isTriple: boolean;
}

export const DiceCup3D: React.FC<DiceCup3DProps> = ({
  dice,
  sum,
  isRolling,
  category,
  isTriple,
}) => {
  const [rollEpoch, setRollEpoch] = useState<number>(1);

  // Increment epoch on each roll start to generate new rotation vectors
  useEffect(() => {
    if (isRolling) {
      setRollEpoch((prev) => prev + 1);
    }
  }, [isRolling]);

  return (
    <div className="relative w-full p-4 sm:p-6 lg:p-7 rounded-3xl bg-gradient-to-b from-emerald-950/85 via-slate-900/90 to-slate-950 border border-emerald-500/35 shadow-2xl backdrop-blur-md overflow-hidden transition-all">
      {/* Luxurious Casino Table Rail & Felt Glow */}
      <div className="absolute inset-0 rounded-3xl border-2 border-emerald-400/25 pointer-events-none" />
      <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-80 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Table Felt Inner Border */}
      <div className="absolute inset-2 sm:inset-3 rounded-2xl border border-emerald-500/15 pointer-events-none" />

      {/* Header Info */}
      <div className="relative flex items-center justify-between text-xs text-emerald-300/80 mb-2 font-medium tracking-wide">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" />
          <span className="font-bold tracking-tight text-white">โต๊ะทอยลูกเต๋าจำลอง</span>
          <span className="text-[10px] text-emerald-400/70 hidden sm:inline">(CASUAL FELT TABLE)</span>
        </span>
        <span className="text-[11px] text-slate-400 font-mono">CSPRNG Uniform Physics</span>
      </div>

      {/* 3D Dice Stage with Individual Physics & Shadows */}
      <div className="relative flex items-center justify-center gap-2 sm:gap-6 lg:gap-8 py-5 sm:py-7 min-h-[140px] sm:min-h-[160px]">
        <SingleDie value={dice[0]} isRolling={isRolling} dieIndex={0} rollEpoch={rollEpoch} />
        <SingleDie value={dice[1]} isRolling={isRolling} dieIndex={1} rollEpoch={rollEpoch} />
        <SingleDie value={dice[2]} isRolling={isRolling} dieIndex={2} rollEpoch={rollEpoch} />
      </div>

      {/* Live Result Status Bar */}
      <div className="relative text-center pt-2.5 border-t border-slate-800/80">
        {isRolling ? (
          <div className="text-amber-400 font-bold tracking-wider animate-pulse flex items-center justify-center gap-2 text-sm sm:text-base">
            <span className="inline-block animate-spin">🎲</span>
            <span>กำลังเขย่าและสุ่มผลลูกเต๋า...</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
            <span className="text-slate-400 text-xs sm:text-sm">
              แต้มเต๋า: <strong className="text-white text-sm sm:text-base">{dice[0]} + {dice[1]} + {dice[2]}</strong>
            </span>
            <span className="text-slate-600 hidden sm:inline">•</span>
            <span className="text-slate-300 text-xs sm:text-sm">
              ผลรวม: <strong className="text-amber-400 text-base sm:text-lg">{sum}</strong>
            </span>
            <span className="text-slate-600 hidden sm:inline">•</span>
            <span
              className={`px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                isTriple
                  ? 'bg-purple-600 text-purple-100 ring-2 ring-purple-300 animate-bounce'
                  : category === 'HIGH'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
              }`}
            >
              {isTriple ? '🎉 ตอง (TRIPLE)!' : category === 'HIGH' ? 'สูง (HIGH)' : 'ต่ำ (LOW)'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
