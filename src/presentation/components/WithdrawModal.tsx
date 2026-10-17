import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, Coins, Loader2, X } from 'lucide-react';
import { fetchPaymentConfig } from '../../infrastructure/payment/paymentClient';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  balance: number;
}

/** อัตรารองรับก่อนโหลดค่าจริงจาก Worker (ให้ตรงกับ TopUpModal) */
const FALLBACK_CHIPS_PER_THB = 10;
/** จุดตัด RWD ของโปรเจกต์: < 1024px = mobile, >= 1024px = desktop */
const MOBILE_BREAKPOINT = 1024;

/** รายชื่อธนาคารที่เลือกได้ */
const BANKS = [
  'กรุงไทย (KTB)',
  'ไทยพาณิชย์ (SCB)',
  'ทหารไทยธนชาต (ttb)',
  'กรุงเทพ (BBL)',
  'กสิกรไทย (KBank)',
  'กรุงศรีอยุธยา (BAY)',
  'ออมสิน (GSB)',
  'ธนาคารอื่น ๆ',
];

/** เลขบัญชีไทยมี 10-12 หลัก (ไม่นับขีด/เว้นวรรค) */
const ACCOUNT_DIGITS_MIN = 10;
const ACCOUNT_DIGITS_MAX = 12;

/**
 * หน้าต่างถอนเงินรางวัล — ผู้ใช้กรอกจำนวนชิปที่ต้องการถอน
 * ระบบแปลงเป็นบาทตามอัตราของระบบ เมื่อยืนยันแล้ว
 * จะเปลี่ยนหน้าไปที่ไฟล์ภาพ (desktop / mobile แยกตามขนาดหน้าจอ)
 */
export const WithdrawModal: React.FC<WithdrawModalProps> = ({ isOpen, onClose, balance }) => {
  const [chipsInput, setChipsInput] = useState<string>('');
  const [bank, setBank] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [chipsPerThb, setChipsPerThb] = useState<number>(FALLBACK_CHIPS_PER_THB);

  // ตั้งค่าเริ่มต้นใหม่ทุกครั้งที่เปิดหน้าต่าง + โหลดอัตราแลกจาก Worker
  useEffect(() => {
    if (!isOpen) return;
    setChipsInput('');
    setBank('');
    setAccountNumber('');
    setError(null);
    setChipsPerThb(FALLBACK_CHIPS_PER_THB);

    let alive = true;
    fetchPaymentConfig()
      .then((cfg) => {
        if (alive && cfg.chipsPerThb > 0) setChipsPerThb(cfg.chipsPerThb);
      })
      .catch(() => {
        // ต่อ Worker ไม่ได้ → ใช้อัตราสำรอง
      });
    return () => {
      alive = false;
    };
  }, [isOpen]);

  // ปิดด้วย Escape และล็อกการเลื่อนหน้าหลังระหว่างเปิด
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  const parsedChips = Math.floor(Number(chipsInput));
  const chipsValid = Number.isFinite(parsedChips) && parsedChips > 0 && parsedChips <= balance;
  // จำนวนเงิน (บาท) ที่แปลงจากชิป — ปัดขึ้น 2 ตำแหน่งทศนิยม
  const amountThb = useMemo(
    () => (chipsValid ? Math.ceil((parsedChips / chipsPerThb) * 100) / 100 : 0),
    [chipsValid, parsedChips, chipsPerThb]
  );

  const accountDigits = accountNumber.replace(/[\s-]/g, '');
  const accountValid =
    /^\d+$/.test(accountDigits) &&
    accountDigits.length >= ACCOUNT_DIGITS_MIN &&
    accountDigits.length <= ACCOUNT_DIGITS_MAX;

  const canSubmit = chipsValid && bank !== '' && accountValid;

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!canSubmit) return;
    const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
    // เปลี่ยนหน้าไปไฟล์ภาพ — แยกภาพ desktop / mobile ตามขนาดหน้าจอ
    window.location.href = isMobile ? '/withdraw-mobile.png' : '/withdraw-desktop.png';
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="ถอนเงินรางวัล"
    >
      <div className="animate-pop-in relative w-full max-w-md max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl">
        {/* ปุ่มปิด */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
          aria-label="ปิดหน้าต่างถอนเงิน"
        >
          <X className="w-5 h-5" />
        </button>

        {/* หัวเรื่อง */}
        <div className="flex items-center gap-3 p-5 pb-4 border-b border-slate-800">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <Banknote className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white leading-tight">ถอนเงินรางวัล</h2>
            <p className="text-[11px] text-slate-400">กรอกจำนวนชิปและบัญชีที่ต้องการรับเงิน</p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* ชิปคงเหลือ */}
          <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] text-slate-400">ชิปคงเหลือ</span>
            <span className="flex items-center gap-1.5 text-sm font-black text-amber-300">
              <Coins className="w-4 h-4 text-amber-400" />
              {balance.toLocaleString()}
            </span>
          </div>

          <div className="text-[11px] text-slate-400">
            อัตราแลก: <span className="text-white font-bold">1 บาท = {chipsPerThb.toLocaleString()} ชิป</span>
          </div>

          {/* จำนวนชิปที่ต้องการถอน */}
          <div className="space-y-1.5">
            <label htmlFor="withdraw-chips" className="text-[11px] font-semibold text-slate-400">
              จำนวนชิปที่ต้องการถอน
            </label>
            <div className="flex items-center gap-2">
              <input
                id="withdraw-chips"
                type="number"
                inputMode="numeric"
                min={1}
                max={balance}
                step={1}
                value={chipsInput}
                onChange={(e) => {
                  setChipsInput(e.target.value);
                  setError(null);
                }}
                placeholder={`1 - ${balance.toLocaleString()}`}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700 text-white text-sm font-bold placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/70"
              />
              <span className="text-xs text-slate-400">ชิป</span>
            </div>
            {chipsInput !== '' && !chipsValid && (
              <p className="text-[11px] text-red-400">
                {parsedChips > balance
                  ? 'จำนวนชิปเกินยอดคงเหลือ'
                  : 'กรุณากรอกจำนวนชิปตั้งแต่ 1 ชิปขึ้นไป'}
              </p>
            )}
          </div>

          {/* จำนวนเงินที่แปลงจากชิป */}
          <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-teal-950/40 border border-emerald-500/30">
            <span className="text-[11px] text-slate-300">จำนวนเงินที่จะได้รับ (แปลงจากชิป)</span>
            <span className="text-lg font-black text-emerald-300">
              ฿{amountThb.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* เลือกธนาคาร */}
          <div className="space-y-1.5">
            <label htmlFor="withdraw-bank" className="text-[11px] font-semibold text-slate-400">
              เลือกธนาคารที่ต้องการรับเงิน
            </label>
            <select
              id="withdraw-bank"
              value={bank}
              onChange={(e) => {
                setBank(e.target.value);
                setError(null);
              }}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700 text-white text-sm font-bold focus:outline-none focus:border-emerald-500/70 cursor-pointer [&>option]:bg-slate-900"
            >
              <option value="" disabled>
                เลือกธนาคาร…
              </option>
              {BANKS.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* เลขบัญชีธนาคาร */}
          <div className="space-y-1.5">
            <label htmlFor="withdraw-account" className="text-[11px] font-semibold text-slate-400">
              เลขบัญชีที่ต้องการรับเงิน
            </label>
            <input
              id="withdraw-account"
              type="text"
              inputMode="numeric"
              value={accountNumber}
              onChange={(e) => {
                setAccountNumber(e.target.value);
                setError(null);
              }}
              placeholder="เช่น 123-4-56789-0"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700 text-white text-sm font-bold placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/70"
            />
            {accountNumber !== '' && !accountValid && (
              <p className="text-[11px] text-red-400">
                เลขบัญชีต้องเป็นตัวเลข {ACCOUNT_DIGITS_MIN}-{ACCOUNT_DIGITS_MAX} หลัก
              </p>
            )}
          </div>

          {/* ข้อผิดพลาด */}
          {error && (
            <div className="p-3 rounded-2xl bg-red-950/40 border border-red-500/30 text-[11px] text-red-200">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canSubmit}
            className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/25 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ยืนยันการถอนเงิน
          </button>

          <p className="text-[10px] text-amber-300/80 text-center">
            หมายเหตุ: ตอนนี้ระบบยังไม่ได้โอนเงินเข้าบัญชีจริง
            เมื่อกดยืนยันจะเปิดหน้าภาพให้ดูเท่านั้น
          </p>
        </div>
      </div>
    </div>
  );
};
