import React from 'react';
import { RoadmapItem } from '../../domain/services/StreakTracker';
import { History } from 'lucide-react';

interface HistoryRoadmapProps {
  roadmap: RoadmapItem[];
}

export const HistoryRoadmap: React.FC<HistoryRoadmapProps> = ({ roadmap }) => {
  return (
    <div className="w-full max-w-md mx-auto bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
      <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
        <div className="flex items-center gap-1.5 font-medium">
          <History className="w-3.5 h-3.5 text-slate-400" />
          <span>ประวัติออกรางวัลย้อนหลัง (Roadmap)</span>
        </div>
        <span className="text-[10px] text-slate-500">15 รอบล่าสุด</span>
      </div>

      {roadmap.length === 0 ? (
        <div className="py-2.5 text-center text-xs text-slate-500 italic">
          ยังไม่มีประวัติการเล่น (เริ่มทอยเต๋าเพื่อบันทึกสถิติ)
        </div>
      ) : (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {roadmap.map((item) => {
            const isHigh = item.category === 'HIGH';
            const isLow = item.category === 'LOW';
            const isTriple = item.isTriple;

            return (
              <div
                key={item.id}
                className="flex flex-col items-center flex-shrink-0 group relative"
              >
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shadow-sm transition-transform group-hover:scale-110 ${
                    isTriple
                      ? 'bg-purple-600 text-white ring-1 ring-purple-300'
                      : isHigh
                      ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                      : 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                  }`}
                  title={`แต้ม ${item.dice.join('+')} = ${item.sum} (${item.category})`}
                >
                  {isTriple ? 'ต' : isHigh ? 'ส' : 'ต'}
                </div>
                <span className="text-[10px] text-slate-400 font-semibold mt-0.5">
                  {item.sum}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
