import React from 'react';
import { CheckCircle2, XCircle, Sparkles } from 'lucide-react';

interface OutcomeAlertProps {
  outcome: {
    won: boolean;
    reason: string;
    netGain: number;
    payout: number;
    isTriple: boolean;
  } | null;
  error: string | null;
}

export const OutcomeAlert: React.FC<OutcomeAlertProps> = ({ outcome, error }) => {
  if (error) {
    return (
      <div className="w-full max-w-md mx-auto my-2 p-3 rounded-2xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
        <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
        <span className="font-medium">{error}</span>
      </div>
    );
  }

  if (!outcome) return null;

  return (
    <div
      className={`w-full max-w-md mx-auto my-2 p-3.5 rounded-2xl border flex items-center justify-between animate-in zoom-in-95 duration-200 ${
        outcome.won
          ? outcome.isTriple
            ? 'bg-gradient-to-r from-purple-950 to-amber-950 border-amber-400/60 shadow-lg shadow-purple-500/20'
            : 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
          : 'bg-slate-900/90 border-slate-800 text-slate-300'
      }`}
    >
      <div className="flex items-center gap-2.5">
        {outcome.won ? (
          outcome.isTriple ? (
            <div className="p-1.5 rounded-xl bg-amber-400/20 text-amber-300">
              <Sparkles className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            <div className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          )
        ) : (
          <div className="p-1.5 rounded-xl bg-slate-800 text-slate-400">
            <XCircle className="w-5 h-5" />
          </div>
        )}

        <div>
          <div className="text-xs font-bold text-white flex items-center gap-1.5">
            <span>{outcome.won ? (outcome.isTriple ? '🎉 BIG WIN JACKPOT (30X)!' : 'คุณชนะการเดิมพัน!') : 'คุณไม่ชนะในรอบนี้'}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">{outcome.reason}</div>
        </div>
      </div>

      <div className="text-right">
        <div
          className={`text-base font-black tracking-tight ${
            outcome.won ? 'text-amber-300' : 'text-slate-500'
          }`}
        >
          {outcome.won ? `+${outcome.payout.toLocaleString()}` : `${outcome.netGain}`}
        </div>
        <div className="text-[10px] text-slate-400 uppercase">
          {outcome.won ? 'ชิปที่ได้' : 'ชิปเดิมพัน'}
        </div>
      </div>
    </div>
  );
};
