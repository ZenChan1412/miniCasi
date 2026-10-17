import React, { useCallback, useEffect, useState } from 'react';
import { Database, RefreshCw, CheckCircle2, AlertTriangle, HardDrive, Clock } from 'lucide-react';
import {
  getStorageStatus,
  refreshStorageStatus,
  subscribeStorageStatus,
  StorageStatus,
} from '../../infrastructure/storage/storageProvider';

/**
 * แผงแสดงสถานะการเชื่อมต่อ Cloudflare D1
 * บอกว่ากำลังเก็บข้อมูลที่ไหน ตารางใดมีอยู่จริง และมีข้อมูลกี่แถว
 */
export const DbStatusPanel: React.FC = () => {
  const [status, setStatus] = useState<StorageStatus>(getStorageStatus());
  const [checking, setChecking] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = subscribeStorageStatus(setStatus);
    return unsubscribe;
  }, []);

  const recheck = useCallback(async () => {
    setChecking(true);
    try {
      setStatus(await refreshStorageStatus());
    } finally {
      setChecking(false);
    }
  }, []);

  const health = status.health;
  const connected = status.mode === 'd1';
  const totalRows = health?.tables.reduce((acc, t) => acc + t.rows, 0) ?? 0;

  return (
    <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <Database className="w-5 h-5 text-sky-400" />
          <h3 className="text-sm font-bold text-white">สถานะฐานข้อมูล (Cloudflare D1)</h3>
        </div>

        <button
          onClick={recheck}
          disabled={checking}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
          <span>ตรวจการเชื่อมต่อใหม่</span>
        </button>
      </div>

      {/* แถบสรุปผลการเชื่อมต่อ */}
      <div
        className={`flex items-start gap-3 p-4 rounded-xl border ${
          connected
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : 'bg-amber-500/10 border-amber-500/30'
        }`}
      >
        {connected ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        )}

        <div className="space-y-1">
          <div className={`text-sm font-bold ${connected ? 'text-emerald-300' : 'text-amber-300'}`}>
            {connected
              ? `เชื่อมต่อ D1 สำเร็จ — ${health?.database ?? 'mini-casino-db'}`
              : 'ยังไม่ได้ใช้ D1 — กำลังเก็บข้อมูลไว้ที่ LocalStorage ของเบราว์เซอร์'}
          </div>
          <div className="text-xs text-slate-400">
            {connected ? (
              <span className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  ตอบสนอง {health?.latencyMs ?? 0} ms
                </span>
                <span>รวม {totalRows.toLocaleString()} แถวในทุกตาราง</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5" />
                {health?.error ??
                  'ต้องรันผ่าน Worker (wrangler dev หรือ deploy แล้ว) ข้อมูลจึงจะบันทึกลง D1'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ตารางข้อมูลที่อ่านได้จาก D1 จริง */}
      {health && health.tables.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-xs">
            <thead className="bg-slate-950/70 text-slate-400">
              <tr>
                <th className="text-left font-bold px-4 py-2.5">ตาราง</th>
                <th className="text-left font-bold px-4 py-2.5">สถานะ</th>
                <th className="text-right font-bold px-4 py-2.5">จำนวนแถว</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {health.tables.map((table) => (
                <tr key={table.name} className="hover:bg-slate-800/40">
                  <td className="px-4 py-2.5 font-mono text-slate-200">{table.name}</td>
                  <td className="px-4 py-2.5">
                    {table.exists ? (
                      <span className="text-emerald-400 font-bold">พร้อมใช้งาน</span>
                    ) : (
                      <span className="text-rose-400 font-bold">ไม่พบตาราง</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                    {table.rows.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {health && !health.ok && health.tables.some((t) => !t.exists) && (
        <p className="text-xs text-amber-300">
          ตารางไม่ครบ — รัน{' '}
          <code className="font-mono bg-slate-950 px-1.5 py-0.5 rounded">
            wrangler d1 migrations apply mini-casino-db --remote
          </code>{' '}
          เพื่อสร้างตารางที่ขาด
        </p>
      )}

      {status.checkedAt > 0 && (
        <p className="text-[11px] text-slate-500">
          ตรวจล่าสุด: {new Date(status.checkedAt).toLocaleString('th-TH')}
        </p>
      )}
    </div>
  );
};
