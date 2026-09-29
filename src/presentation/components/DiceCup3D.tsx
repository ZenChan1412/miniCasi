import React from 'react';

interface DiceProps {
  value: number;
  isRolling: boolean;
}

const DIE_TRANSFORMS: Record<number, string> = {
  1: 'rotateX(0deg) rotateY(0deg)',
  6: 'rotateX(0deg) rotateY(180deg)',
  2: 'rotateX(0deg) rotateY(90deg)',
  5: 'rotateX(0deg) rotateY(-90deg)',
  3: 'rotateX(-90deg) rotateY(0deg)',
  4: 'rotateX(90deg) rotateY(0deg)',
};

const SingleDie: React.FC<DiceProps> = ({ value, isRolling }) => {
  const transform = isRolling ? undefined : (DIE_TRANSFORMS[value] || DIE_TRANSFORMS[1]);

  return (
    <div className="perspective-1000 p-2">
      <div
        className={`dice-container ${isRolling ? 'dice-rolling' : ''}`}
        style={!isRolling ? { transform } : undefined}
      >
        {/* Face 1 */}
        <div className="dice-face face-1 flex items-center justify-center">
          <span className="pip red !w-4 !h-4" />
        </div>

        {/* Face 6 */}
        <div className="dice-face face-6 flex flex-col justify-between">
          <div className="flex justify-between"><span className="pip" /><span className="pip" /></div>
          <div className="flex justify-between"><span className="pip" /><span className="pip" /></div>
          <div className="flex justify-between"><span className="pip" /><span className="pip" /></div>
        </div>

        {/* Face 2 */}
        <div className="dice-face face-2 flex justify-between">
          <span className="pip" />
          <span className="pip self-end" />
        </div>

        {/* Face 5 */}
        <div className="dice-face face-5 flex flex-col justify-between">
          <div className="flex justify-between"><span className="pip" /><span className="pip" /></div>
          <div className="flex justify-center"><span className="pip" /></div>
          <div className="flex justify-between"><span className="pip" /><span className="pip" /></div>
        </div>

        {/* Face 3 */}
        <div className="dice-face face-3 flex justify-between">
          <span className="pip" />
          <span className="pip self-center" />
          <span className="pip self-end" />
        </div>

        {/* Face 4 */}
        <div className="dice-face face-4 flex flex-col justify-between">
          <div className="flex justify-between"><span className="pip" /><span className="pip" /></div>
          <div className="flex justify-between"><span className="pip" /><span className="pip" /></div>
        </div>
      </div>
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
  return (
    <div className="relative w-full max-w-md mx-auto my-3 p-5 rounded-3xl bg-gradient-to-b from-emerald-950/80 via-slate-900/90 to-slate-950 border border-emerald-500/30 shadow-2xl backdrop-blur-md">
      {/* Table Ring Glow */}
      <div className="absolute inset-0 rounded-3xl border-2 border-emerald-400/20 pointer-events-none" />

      {/* Header Info */}
      <div className="flex items-center justify-between text-xs text-emerald-300/80 mb-2 font-medium tracking-wide">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          โต๊ะทอยลูกเต๋าจำลอง (CASUAL TABLE)
        </span>
        <span>ลูกเต๋า 3 ลูก (Fair CSPRNG)</span>
      </div>

      {/* 3D Dice Stage */}
      <div className="flex items-center justify-center gap-4 py-4 min-h-[110px]">
        <SingleDie value={dice[0]} isRolling={isRolling} />
        <SingleDie value={dice[1]} isRolling={isRolling} />
        <SingleDie value={dice[2]} isRolling={isRolling} />
      </div>

      {/* Live Result Status */}
      <div className="text-center pt-2 border-t border-slate-800/80">
        {isRolling ? (
          <div className="text-amber-400 font-semibold tracking-wider animate-pulse flex items-center justify-center gap-2">
            <span>🎲 กำลังเขย่าลูกเต๋า...</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <span className="text-slate-400 text-sm">
              แต้ม: <strong className="text-white text-base">{dice[0]} + {dice[1]} + {dice[2]}</strong>
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-300 text-sm">
              ผลรวม: <strong className="text-amber-400 text-lg">{sum}</strong>
            </span>
            <span className="text-slate-500">•</span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                isTriple
                  ? 'bg-purple-600 text-purple-100 ring-1 ring-purple-300 animate-bounce'
                  : category === 'HIGH'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
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
