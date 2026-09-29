import React from 'react';
import { BetOption } from '../../domain/entities/Bet';
import { Sparkles, RotateCcw, Play } from 'lucide-react';

interface BetBoardProps {
  selectedOption: BetOption | null;
  selectedAmount: number;
  balance: number;
  isRolling: boolean;
  onSelectOption: (option: BetOption) => void;
  onSelectAmount: (amount: number) => void;
  onClearBet: () => void;
  onRoll: () => void;
}

const CHIP_DENOMINATIONS = [10, 50, 100, 250, 500];

export const BetBoard: React.FC<BetBoardProps> = ({
  selectedOption,
  selectedAmount,
  balance,
  isRolling,
  onSelectOption,
  onSelectAmount,
  onClearBet,
  onRoll,
}) => {
  return (
    <div className="w-full space-y-4">
      {/* Bet Options Grid */}
      <div className="grid grid-cols-3 gap-2.5">
        {/* LOW CARD */}
        <button
          type="button"
          disabled={isRolling}
          onClick={() => onSelectOption('LOW')}
          className={`relative p-3.5 rounded-2xl flex flex-col items-center justify-center transition-all duration-200 cursor-pointer ${
            selectedOption === 'LOW'
              ? 'bg-gradient-to-b from-blue-600 to-blue-800 text-white shadow-lg shadow-blue-500/30 scale-102 ring-2 ring-blue-300'
              : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800/90 border border-slate-700/60'
          }`}
        >
          <div className="text-base font-bold tracking-tight">ต่ำ (LOW)</div>
          <div className="text-[11px] text-blue-200/80 mt-0.5">แต้มรวม 4 - 10</div>
          <div className="mt-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-950/40 text-blue-300">
            จ่าย 1 : 1
          </div>
          {selectedOption === 'LOW' && (
            <div className="absolute -top-2 -right-2 bg-amber-400 text-slate-950 text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow">
              {selectedAmount} ชิป
            </div>
          )}
        </button>

        {/* TRIPLE CARD */}
        <button
          type="button"
          disabled={isRolling}
          onClick={() => onSelectOption('TRIPLE')}
          className={`relative p-3.5 rounded-2xl flex flex-col items-center justify-center transition-all duration-200 cursor-pointer ${
            selectedOption === 'TRIPLE'
              ? 'bg-gradient-to-b from-purple-600 to-purple-800 text-white shadow-lg shadow-purple-500/40 scale-102 ring-2 ring-purple-300'
              : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800/90 border border-slate-700/60'
          }`}
        >
          <div className="flex items-center gap-1 text-base font-bold tracking-tight text-amber-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>ตอง</span>
          </div>
          <div className="text-[11px] text-purple-200/80 mt-0.5">เต๋าแต้มเท่ากัน 3 ลูก</div>
          <div className="mt-2 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
            จ่าย 30 : 1
          </div>
          {selectedOption === 'TRIPLE' && (
            <div className="absolute -top-2 -right-2 bg-amber-400 text-slate-950 text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow">
              {selectedAmount} ชิป
            </div>
          )}
        </button>

        {/* HIGH CARD */}
        <button
          type="button"
          disabled={isRolling}
          onClick={() => onSelectOption('HIGH')}
          className={`relative p-3.5 rounded-2xl flex flex-col items-center justify-center transition-all duration-200 cursor-pointer ${
            selectedOption === 'HIGH'
              ? 'bg-gradient-to-b from-red-600 to-red-800 text-white shadow-lg shadow-red-500/30 scale-102 ring-2 ring-red-300'
              : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800/90 border border-slate-700/60'
          }`}
        >
          <div className="text-base font-bold tracking-tight">สูง (HIGH)</div>
          <div className="text-[11px] text-red-200/80 mt-0.5">แต้มรวม 11 - 17</div>
          <div className="mt-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-950/40 text-red-300">
            จ่าย 1 : 1
          </div>
          {selectedOption === 'HIGH' && (
            <div className="absolute -top-2 -right-2 bg-amber-400 text-slate-950 text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow">
              {selectedAmount} ชิป
            </div>
          )}
        </button>
      </div>

      {/* Chip Denominations Selector */}
      <div className="bg-slate-900/70 p-3 rounded-2xl border border-slate-800 backdrop-blur-sm">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span>เลือกจำนวนชิปเดิมพัน:</span>
          <span className="text-amber-400 font-semibold">{selectedAmount} ชิป</span>
        </div>

        <div className="flex items-center justify-between gap-1.5">
          {CHIP_DENOMINATIONS.map((chip) => {
            const isSelected = selectedAmount === chip;
            const canAfford = balance >= chip;

            return (
              <button
                key={chip}
                type="button"
                disabled={isRolling || !canAfford}
                onClick={() => onSelectAmount(chip)}
                className={`flex-1 py-2 px-1 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 shadow-md shadow-amber-500/30 ring-2 ring-yellow-200 scale-105'
                    : canAfford
                    ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                    : 'bg-slate-900/50 text-slate-600 border border-slate-800/40 cursor-not-allowed opacity-40'
                }`}
              >
                {chip}
              </button>
            );
          })}

          {/* Max Button */}
          <button
            type="button"
            disabled={isRolling || balance < 10}
            onClick={() => onSelectAmount(Math.min(500, balance))}
            className="px-2.5 py-2 rounded-xl text-xs font-bold bg-slate-800 text-amber-400 hover:bg-slate-700 border border-amber-500/30 transition-all cursor-pointer"
          >
            MAX
          </button>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={isRolling}
          onClick={onClearBet}
          className="p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center justify-center cursor-pointer border border-slate-700"
          title="ล้างเดิมพัน"
        >
          <RotateCcw className="w-5 h-5" />
        </button>

        <button
          type="button"
          disabled={isRolling || !selectedOption || balance < selectedAmount}
          onClick={onRoll}
          className={`flex-1 py-3.5 px-6 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${
            isRolling
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed animate-pulse'
              : !selectedOption
              ? 'bg-slate-800 text-slate-400 border border-slate-700'
              : balance < selectedAmount
              ? 'bg-red-950 text-red-400 border border-red-800'
              : 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 shadow-xl shadow-amber-500/30 hover:scale-[1.02] active:scale-[0.98]'
          }`}
        >
          <Play className={`w-5 h-5 fill-current ${isRolling ? 'animate-spin' : ''}`} />
          <span>{isRolling ? 'กำลังทอยเต๋า...' : `ทอยเต๋า (${selectedAmount} ชิป)`}</span>
          {!isRolling && selectedOption && balance >= selectedAmount && (
            <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-slate-950/20 text-slate-900 rounded border border-slate-900/30">
              Space
            </kbd>
          )}
        </button>
      </div>
    </div>
  );
};
