import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Coins,
  Gift,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { UserProfile } from '../../domain/entities/User';
import {
  checkPromptPayTopUp,
  createPromptPayTopUp,
  fetchPaymentConfig,
} from '../../infrastructure/payment/paymentClient';
import type {
  CreateTopUpResponse,
  PaymentConfigResponse,
} from '../../infrastructure/payment/paymentClient';

interface TopUpModalProps {
  isOpen: boolean;
  balance: number;
  user: UserProfile | null;
  onClose: () => void;
  /** เรียกเมื่อเติมชิปสำเร็จ เพื่อให้หน้าจอซิงก์ยอดล่าสุดจากฐานข้อมูล */
  onCredited: (newBalance: number) => void;
}

type Step = 'form' | 'qr' | 'success';

/** ชุดยอดเติมด่วน (หน่วยบาท) — จะถูกกรองตามค่าขั้นต่ำ/สูงสุดของ Worker อีกชั้น */
const PRESET_BAHT = [20, 50, 100, 300, 500];
/** ระยะเวลาสุ่มตรวจการชำระเงินอัตโนมัติ (มิลลิวินาที) */
const POLL_INTERVAL_MS = 5000;

/** อัตราสำรองก่อนโหลดค่าจริงจาก Worker */
const FALLBACK_CHIPS_PER_THB = 10;

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export const TopUpModal: React.FC<TopUpModalProps> = ({
  isOpen,
  balance,
  user,
  onClose,
  onCredited,
}) => {
  const [step, setStep] = useState<Step>('form');
  const [config, setConfig] = useState<PaymentConfigResponse | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [chipsInput, setChipsInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<CreateTopUpResponse | null>(null);
  const [credited, setCredited] = useState<{ chips: number; balance: number } | null>(null);
  const [clock, setClock] = useState<number>(() => Date.now());

  const verifyingRef = useRef(false);
  const paymentRef = useRef<CreateTopUpResponse | null>(null);
  const balanceRef = useRef(balance);
  const onCreditedRef = useRef(onCredited);

  // เก็บค่าล่าสุดไว้ใน ref เพื่อให้ polling ไม่ถูกรีสตาร์ตทุกครั้งที่ผู้ปกครองเรนเดอร์ใหม่
  useEffect(() => {
    paymentRef.current = payment;
  }, [payment]);
  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);
  useEffect(() => {
    onCreditedRef.current = onCredited;
  }, [onCredited]);

  const chipsPerThb = config?.chipsPerThb ?? FALLBACK_CHIPS_PER_THB;
  const minChips = useMemo(
    () => (config ? Math.ceil(config.minTopupThb * config.chipsPerThb) : FALLBACK_CHIPS_PER_THB * 20),
    [config]
  );
  const maxChips = useMemo(
    () => (config ? Math.floor(config.maxTopupThb * config.chipsPerThb) : FALLBACK_CHIPS_PER_THB * 5000),
    [config]
  );
  const presets = useMemo(() => {
    if (!config) return [] as { baht: number; chips: number }[];
    return PRESET_BAHT.filter((baht) => baht >= config.minTopupThb && baht <= config.maxTopupThb).map(
      (baht) => ({ baht, chips: Math.round(baht * config.chipsPerThb) })
    );
  }, [config]);

  const parsedChips = Math.floor(Number(chipsInput));
  const chipsValid =
    Number.isFinite(parsedChips) && parsedChips >= minChips && parsedChips <= maxChips;
  const amountThb = chipsValid ? Math.ceil(parsedChips / chipsPerThb) : 0;

  const canSubmit = Boolean(config?.enabled) && chipsValid && !submitting;

  // ตั้งค่าเริ่มต้นใหม่ทุกครั้งที่เปิดหน้าต่าง + โหลดค่าจาก Worker
  useEffect(() => {
    if (!isOpen) return;

    setStep('form');
    setConfig(null);
    setConfigError(null);
    setConfigLoading(true);
    setChipsInput('');
    setError(null);
    setPayment(null);
    setCredited(null);

    let alive = true;
    fetchPaymentConfig()
      .then((cfg) => {
        if (alive) setConfig(cfg);
      })
      .catch((err) => {
        if (alive) {
          setConfigError(
            err instanceof Error ? err.message : 'โหลดการตั้งค่าระบบเติมชิปไม่สำเร็จ'
          );
        }
      })
      .finally(() => {
        if (alive) setConfigLoading(false);
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

  // นาฬิกาสำหรับนับถอยหลังอายุ QR
  useEffect(() => {
    if (step !== 'qr') return;
    setClock(Date.now());
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [step]);

  const verify = useCallback(
    async (silent: boolean) => {
      const active = paymentRef.current;
      if (!active || verifyingRef.current) return;
      verifyingRef.current = true;
      if (!silent) setChecking(true);

      try {
        const res = await checkPromptPayTopUp(active.transactionId);
        if (res.status === 'paid') {
          const newBalance = res.balance ?? balanceRef.current + (res.chips ?? active.chips);
          setCredited({ chips: res.chips ?? active.chips, balance: newBalance });
          setStep('success');
          onCreditedRef.current(newBalance);
        } else if (!silent) {
          setError('ยังไม่พบการชำระเงิน กรุณาโอนให้ครบก่อน แล้วกดตรวจสอบอีกครั้ง');
        }
      } catch (err) {
        if (!silent) {
          setError(err instanceof Error ? err.message : 'ตรวจสอบการชำระเงินไม่สำเร็จ');
        }
      } finally {
        verifyingRef.current = false;
        if (!silent) setChecking(false);
      }
    },
    []
  );

  // ตรวจการชำระเงินอัตโนมัติระหว่างแสดง QR (สร้าง interval ครั้งเดียวต่อหนึ่งรายการ)
  useEffect(() => {
    if (!isOpen || step !== 'qr' || !payment) return;
    const poll = setInterval(() => {
      void verify(true);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(poll);
  }, [isOpen, step, payment, verify]);

  const handlePreset = (chips: number) => {
    setChipsInput(String(chips));
    setError(null);
  };

  const handleCreate = async () => {
    if (!chipsValid) {
      setError(
        `กรุณากรอกจำนวนชิปตั้งแต่ ${minChips.toLocaleString()} ถึง ${maxChips.toLocaleString()} ชิป`
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await createPromptPayTopUp(parsedChips, user?.id);
      setPayment(res);
      setClock(Date.now());
      setStep('qr');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'สร้าง QR ไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setSubmitting(false);
    }
  };

  const qrImage = useMemo(() => {
    if (!payment) return '';
    if (payment.qrUrl) return payment.qrUrl;
    if (payment.payload) {
      return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(
        payment.payload
      )}`;
    }
    return '';
  }, [payment]);

  const remainingSeconds =
    payment && payment.expiresAt > 0 ? Math.max(0, Math.floor((payment.expiresAt - clock) / 1000)) : 0;
  const expired = Boolean(payment && payment.expiresAt > 0 && remainingSeconds <= 0);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="เติมชิปด้วยเงินจริง"
    >
      <div className="relative w-full max-w-md max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl">
        {/* ปุ่มปิด */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-xl bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
          aria-label="ปิดหน้าต่างเติมชิป"
        >
          <X className="w-5 h-5" />
        </button>

        {/* หัวเรื่อง */}
        <div className="flex items-center gap-3 p-5 pb-4 border-b border-slate-800">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white leading-tight">
              เติมชิปด้วยเงินจริง
            </h2>
            <p className="text-[11px] text-slate-400">ชำระผ่านพร้อมเพย์ (PromptPay)</p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* ยอดชิปปัจจุบัน */}
          <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] text-slate-400">ชิปคงเหลือ</span>
            <span className="flex items-center gap-1.5 text-sm font-black text-amber-300">
              <Coins className="w-4 h-4 text-amber-400" />
              {balance.toLocaleString()}
            </span>
          </div>

          {/* ---------- ขั้นกรอกจำนวน ---------- */}
          {step === 'form' && (
            <>
              {configLoading && (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  กำลังโหลดการตั้งค่าระบบเติมชิป…
                </div>
              )}

              {!configLoading && (configError || config?.enabled === false) && (
                <div className="flex items-start gap-2 p-3 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-[11px] text-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    {configError ??
                      'ระบบเติมชิปด้วยเงินจริงยังไม่เปิดใช้งาน — ผู้ดูแลระบบต้องตั้งค่า INWCLOUD_API_KEY ก่อน'}
                  </span>
                </div>
              )}

              {!configLoading && config && (
                <>
                  <div className="text-[11px] text-slate-400">
                    อัตราแลก: <span className="text-white font-bold">1 บาท = {config.chipsPerThb.toLocaleString()} ชิป</span>
                    {' · '}ขั้นต่ำ {config.minTopupThb.toLocaleString()} บาท
                  </div>

                  {/* ยอดด่วน */}
                  <div className="grid grid-cols-3 gap-2">
                    {presets.map((preset) => {
                      const active = chipsInput === String(preset.chips);
                      return (
                        <button
                          key={preset.baht}
                          type="button"
                          onClick={() => handlePreset(preset.chips)}
                          className={`py-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                            active
                              ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200'
                              : 'bg-slate-950/60 border-slate-800 text-slate-200 hover:bg-slate-800'
                          }`}
                        >
                          <div className="text-sm font-black">{preset.chips.toLocaleString()}</div>
                          <div className="text-[10px] text-slate-400">฿{preset.baht.toLocaleString()}</div>
                        </button>
                      );
                    })}
                  </div>

                  {/* กรอกจำนวนเอง */}
                  <div className="space-y-1.5">
                    <label htmlFor="topup-chips" className="text-[11px] font-semibold text-slate-400">
                      หรือกรอกจำนวนชิปที่ต้องการเติม
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="topup-chips"
                        type="number"
                        inputMode="numeric"
                        min={minChips}
                        max={maxChips}
                        step={1}
                        value={chipsInput}
                        onChange={(e) => {
                          setChipsInput(e.target.value);
                          setError(null);
                        }}
                        placeholder={`${minChips} - ${maxChips}`}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700 text-white text-sm font-bold placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/70"
                      />
                      <span className="text-xs text-slate-400">ชิป</span>
                    </div>
                  </div>

                  {/* ยอดที่ต้องจ่าย */}
                  <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-teal-950/40 border border-emerald-500/30">
                    <span className="text-[11px] text-slate-300">ยอดที่ต้องชำระ (ประมาณ)</span>
                    <span className="text-lg font-black text-emerald-300">
                      ฿{amountThb.toLocaleString()}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={!canSubmit}
                    className="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/25 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        กำลังสร้าง QR…
                      </>
                    ) : (
                      <>
                        <QrCode className="w-4 h-4" />
                        ยืนยันและสร้าง QR พร้อมเพย์
                      </>
                    )}
                  </button>
                </>
              )}
            </>
          )}

          {/* ---------- ขั้นสแกนจ่าย ---------- */}
          {step === 'qr' && payment && (
            <>
              <div className="text-center space-y-1">
                <div className="text-[11px] text-slate-400">สแกนหรือบันทึก QR แล้วโอนผ่านแอปธนาคาร</div>
                <div className="text-2xl font-black text-emerald-300">
                  ฿{payment.amountThb.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-400">
                  รับ <span className="text-amber-300 font-bold">{payment.chips.toLocaleString()} ชิป</span>
                </div>
              </div>

              <div className="flex justify-center">
                {expired ? (
                  <div className="w-64 h-64 rounded-2xl bg-slate-950/70 border border-red-500/40 flex flex-col items-center justify-center gap-2 text-red-300 text-xs">
                    <AlertTriangle className="w-6 h-6" />
                    QR หมดอายุแล้ว
                  </div>
                ) : qrImage ? (
                  <img
                    src={qrImage}
                    alt="PromptPay QR"
                    className="w-64 h-64 rounded-2xl bg-white p-2 border border-slate-700 object-contain"
                  />
                ) : (
                  <div className="w-64 h-64 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-center text-xs text-slate-500">
                    ไม่พบรูป QR
                  </div>
                )}
              </div>

              {!expired && payment.expiresAt > 0 && (
                <div className="text-center text-[11px] text-slate-400">
                  QR หมดอายุใน{' '}
                  <span className="text-white font-bold">{formatDuration(remainingSeconds)}</span> นาที
                </div>
              )}

              <div className="text-[10px] text-slate-500 text-center font-mono break-all">
                {payment.transactionId}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void verify(false)}
                  disabled={checking || expired}
                  className="flex-1 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/25 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {checking ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      กำลังตรวจสอบ…
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      ตรวจสอบการชำระเงิน
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep('form');
                    setPayment(null);
                    setError(null);
                  }}
                  className="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm transition-colors cursor-pointer"
                >
                  แก้จำนวน
                </button>
              </div>

              <p className="text-[10px] text-slate-500 text-center">
                ระบบจะตรวจสอบอัตโนมัติทุก 5 วินาที เมื่อโอนสำเร็จชิปจะเข้าบัญชีทันที
              </p>
            </>
          )}

          {/* ---------- ขั้นสำเร็จ ---------- */}
          {step === 'success' && credited && (
            <div className="text-center space-y-4 py-2">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-white">เติมชิปสำเร็จ</h3>
                <p className="text-sm text-emerald-300 font-bold">
                  +{credited.chips.toLocaleString()} ชิป
                </p>
                <p className="text-[11px] text-slate-400">
                  ชิปคงเหลือใหม่{' '}
                  <span className="text-amber-300 font-bold">{credited.balance.toLocaleString()}</span> ชิป
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-2xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/25 hover:brightness-110 transition-all cursor-pointer"
              >
                กลับสู่หน้าเกม
              </button>
            </div>
          )}

          {/* ข้อผิดพลาด */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-2xl bg-red-950/40 border border-red-500/30 text-[11px] text-red-200">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* หมายเหตุท้ายหน้าต่าง */}
          <div className="flex items-start gap-2 pt-1 border-t border-slate-800 text-[10px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/70 shrink-0 mt-0.5" />
            <span>
              ชำระเงินปลอดภัยผ่าน Payment Gateway ของ inwcloud.shop · ชิปใช้เล่่นภายในเกมและสามารถถอนเป็นเงินได้ตามอัตรแลกของระบบ
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
