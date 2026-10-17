import React, { useEffect, useState } from 'react';
import { randomMockActivity } from '../data/mockActivity';

const MIN_MS = 7000;
const MAX_MS = 20000;

const randomDuration = () => MIN_MS + Math.floor(Math.random() * (MAX_MS - MIN_MS + 1));

export const ActivityTicker: React.FC = () => {
  const [item, setItem] = useState(randomMockActivity);
  const [duration, setDuration] = useState(randomDuration);
  const [tick, setTick] = useState(0);

  // ข้อความวิ่งจบแล้วค่อยขึ้นชุดใหม่ โดยแต่ละชุดสุ่มความเร็ว 7–20 วินาที
  useEffect(() => {
    const id = window.setTimeout(() => {
      setItem(randomMockActivity());
      setDuration(randomDuration());
      setTick((t) => t + 1);
    }, duration);
    return () => window.clearTimeout(id);
  }, [tick, duration]);

  return (
    <div
      className="w-full overflow-hidden border-b border-slate-800/80 bg-slate-900/60 py-1.5"
      aria-live="off"
    >
      <div
        key={tick}
        className="ticker-slide whitespace-nowrap text-xs sm:text-sm text-slate-300"
        style={{ animationDuration: `${duration}ms` }}
      >
        <span className="font-semibold text-amber-400">{item.name}</span>{' '}
        <span>{item.event}</span>
      </div>
    </div>
  );
};
