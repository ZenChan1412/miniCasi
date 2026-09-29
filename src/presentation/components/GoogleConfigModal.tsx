import React, { useState } from 'react';
import { KeyRound, ExternalLink, Copy, Check, Sparkles, X, ShieldCheck } from 'lucide-react';
import { UserProfile } from '../../domain/entities/User';

interface GoogleConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMockLogin: (mock?: Partial<UserProfile>) => void;
}

export const GoogleConfigModal: React.FC<GoogleConfigModalProps> = ({
  isOpen,
  onClose,
  onMockLogin,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const exampleEnv = `VITE_GOOGLE_CLIENT_ID=123456789012-xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(exampleEnv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              ตั้งค่า Google OAuth Key ใน .env
            </h2>
            <p className="text-xs text-slate-400">
              ระบบรองรับ Google Sign-In เรียบร้อยแล้ว นำ Client ID ของคุณมาวางได้ทันที
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div className="space-y-3 text-xs text-slate-300">
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="font-semibold text-amber-300 flex items-center justify-between">
              <span>ขั้นตอนนำ Key มาใส่ในไฟล์ .env:</span>
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 hover:underline inline-flex items-center gap-1 font-normal text-[11px]"
              >
                เปิด Google Console <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-400 leading-relaxed">
              <li>เปิด <span className="text-white font-mono">Google Cloud Console</span> &rarr; เลือก Credentials</li>
              <li>สร้าง <span className="text-white font-semibold">OAuth 2.0 Client ID</span> (Web Application)</li>
              <li>
                ในช่อง <span className="text-amber-400 font-mono">Authorized JavaScript origins</span> ให้ใส่:
                <div className="mt-1 pl-3 font-mono text-[11px] text-slate-300 space-y-0.5">
                  <div>• http://localhost:5173</div>
                  <div>• https://mini-casino-game.songpon-official.workers.dev</div>
                </div>
              </li>
              <li>คัดลอก Client ID แล้วนำมาวางในไฟล์ <span className="text-emerald-400 font-mono font-bold">.env</span> ของโปรเจกต์</li>
            </ol>
          </div>

          {/* Code snippet */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>ตัวอย่างในไฟล์ <span className="font-mono text-slate-300">.env</span>:</span>
              <button
                type="button"
                onClick={copyToClipboard}
                className="text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer font-medium"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'คัดลอกแล้ว' : 'คัดลอกตัวอย่าง'}</span>
              </button>
            </div>
            <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-emerald-400 overflow-x-auto selection:bg-emerald-500 selection:text-slate-950">
              {exampleEnv}
            </pre>
          </div>
        </div>

        {/* Security badge */}
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/20 text-emerald-300 text-[11px]">
          <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>ปลอดภัยตามมาตรฐาน OWASP (Client ID ปลอดภัยในการใช้บน Frontend ไม่เปิดเผย Secret)</span>
        </div>

        {/* Action: Mock Demo Login or Close */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              onMockLogin({
                name: 'ผู้เล่นทดสอบ (Demo User)',
                email: 'player.demo@gmail.com',
                picture: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
              });
              onClose();
            }}
            className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 hover:brightness-110 active:scale-98 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>ทดสอบด้วยบัญชีจำลอง (Mock Demo)</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors cursor-pointer"
          >
            เข้าใจแล้ว ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
