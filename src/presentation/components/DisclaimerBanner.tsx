import React, { useState } from 'react';
import { ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';

export const DisclaimerBanner: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  return (
    <footer className="w-full max-w-7xl mx-auto mt-6 px-3 sm:px-6 lg:px-8 pb-4">
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-3 sm:p-4 text-slate-400 text-xs backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-left font-medium text-slate-300 hover:text-emerald-400 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-[11px] font-semibold">ข้อกำหนดการใช้งาน: เล่นเพื่อความบันเทิง ไม่ใช้เงินจริง</span>
          </div>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {isExpanded && (
          <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1.5 leading-relaxed">
            <p>
              • <strong>ไม่มีมูลค่าทางการเงิน (Zero Monetary Value):</strong> ชิปทั้งหมดในระบบเป็นเพียงแต้มคะแนนสมมติที่แจกฟรีในเกม ไม่สามารถแลกเปลี่ยน ถอน หรือแปลงเป็นเงินสดหรือสิ่งของใดๆ ได้
            </p>
            <p>
              • <strong>ไม่มีระบบเติมเงิน:</strong> เกมนี้ไม่มีฟังก์ชันการชำระเงิน In-App Purchase หรือเชื่อมต่อ Payment Gateway ใดๆ ทั้งสิ้น
            </p>
            <p>
              • <strong>เล่นได้ไม่จำกัด:</strong> หากชิปหมด ผู้เล่นสามารถกดขอรับชิปช่วยเหลือฉุกเฉิน (+200) หรือรับโบนัสรายวัน (+500) เพื่อเล่นต่อได้ฟรีตลอดเวลา
            </p>
          </div>
        )}
      </div>
    </footer>
  );
};
