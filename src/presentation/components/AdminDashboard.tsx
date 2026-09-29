import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Crown,
  ShieldCheck,
  Users,
  Coins,
  Dice5,
  Ban,
  CheckCircle2,
  RefreshCw,
  ArrowLeft,
  Search,
  Filter,
  PlusCircle,
  RotateCcw,
  Zap,
  TrendingUp,
  FileText,
  Settings,
  Trash2,
  AlertTriangle,
  UserCheck,
  UserX,
  Mail,
  ExternalLink,
} from 'lucide-react';
import { UserProfile } from '../../domain/entities/User';
import { ManagedUser } from '../../domain/entities/ManagedUser';
import { AuditRecord } from '../../domain/entities/AuditLog';
import { adminService } from '../../application/services/AdminService';
import {
  ADMIN_EMAILS,
  CREATOR_EMAILS,
  getDynamicAdminEmails,
  addDynamicAdminEmail,
  removeDynamicAdminEmail,
} from '../../domain/constants/AdminConfig';

interface AdminDashboardProps {
  currentUser: UserProfile;
  isCreator: boolean;
  onReturnToGame: () => void;
  onRefreshWallet: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  isCreator,
  onReturnToGame,
  onRefreshWallet,
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'analytics' | 'audit' | 'settings'>('users');
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal State for Chip Granting
  const [grantModalUser, setGrantModalUser] = useState<ManagedUser | null>(null);
  const [grantAmount, setGrantAmount] = useState<number>(1000);
  const [actionBusy, setActionBusy] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Dynamic Admin Input
  const [newAdminEmail, setNewAdminEmail] = useState<string>('');
  const [dynamicAdmins, setDynamicAdmins] = useState<string[]>([]);

  // Load Data
  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const uList = await adminService.getAllUsers();
      const logs = adminService.getAuditLogs();
      setUsers(uList);
      setAuditLogs(logs);
      setDynamicAdmins(getDynamicAdminEmails());
    } catch (e) {
      console.error('Error loading admin data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Show auto-dismissing banner notification
  const showNotice = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  };

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        u.name.toLowerCase().includes(q) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        u.id.toLowerCase().includes(q);

      const matchRole =
        roleFilter === 'all' ||
        (roleFilter === 'creator' && u.role === 'creator') ||
        (roleFilter === 'admin' && u.role === 'admin') ||
        (roleFilter === 'player' && u.role === 'player');

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'banned' && u.isBanned) ||
        (statusFilter === 'active' && !u.isBanned);

      return matchQuery && matchRole && matchStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  // KPI Metrics
  const metrics = useMemo(() => {
    const totalUsers = users.length;
    const circulatingChips = users.reduce((acc, u) => acc + (u.balance || 0), 0);
    const totalRounds = users.reduce((acc, u) => acc + (u.totalRounds || 0), 0);
    const totalBanned = users.filter((u) => u.isBanned).length;
    return { totalUsers, circulatingChips, totalRounds, totalBanned };
  }, [users]);

  // Handlers
  const handleGrantChips = async () => {
    if (!grantModalUser || grantAmount <= 0) return;
    setActionBusy(true);
    try {
      const res = await adminService.grantChips(grantModalUser.id, grantAmount, currentUser);
      showNotice('success', `เพิ่มชิป +${grantAmount.toLocaleString()} ให้ ${grantModalUser.name} สำเร็จ (ยอดใหม่: ${res.newBalance.toLocaleString()})`);
      setGrantModalUser(null);
      await loadDashboardData();
      onRefreshWallet();
    } catch (e) {
      showNotice('error', e instanceof Error ? e.message : 'เติมชิปล้มเหลว');
    } finally {
      setActionBusy(false);
    }
  };

  const handleResetWallet = async (user: ManagedUser) => {
    if (!window.confirm(`รีเซ็ตชิปของ "${user.name}" (${user.id}) กลับเป็น 1,000 หรือไม่?`)) return;
    setActionBusy(true);
    try {
      await adminService.resetWallet(user.id, currentUser);
      showNotice('success', `รีเซ็ตกระเป๋าชิปของ ${user.name} เรียบร้อยแล้ว`);
      await loadDashboardData();
      onRefreshWallet();
    } catch (e) {
      showNotice('error', 'รีเซ็ตล้มเหลว');
    } finally {
      setActionBusy(false);
    }
  };

  const handleResetCooldown = async (user: ManagedUser) => {
    setActionBusy(true);
    try {
      await adminService.resetCooldowns(user.id, currentUser);
      showNotice('success', `ล้าง Cooldown (Bailout + Daily) ให้ ${user.name} สำเร็จ`);
      await loadDashboardData();
    } catch (e) {
      showNotice('error', 'ล้าง Cooldown ล้มเหลว');
    } finally {
      setActionBusy(false);
    }
  };

  const handleToggleBan = async (user: ManagedUser) => {
    if (!isCreator) {
      showNotice('error', 'สิทธิ์ระงับผู้ใช้สงวนไว้สำหรับ Admin++ (Creator) เท่านั้น');
      return;
    }

    if (user.role === 'creator') {
      showNotice('error', 'ไม่สามารถระงับบัญชีผู้สร้าง (Creator) ได้');
      return;
    }

    setActionBusy(true);
    try {
      if (user.isBanned) {
        await adminService.unbanUser(user.id, currentUser);
        showNotice('success', `ปลดการระงับผู้ใช้ ${user.name} เรียบร้อยแล้ว`);
      } else {
        const reason = window.prompt(`ระบุเหตุผลในการแบน "${user.name}":`, 'ละเมิดข้อกำหนด / พบการปั๊มชิป') || 'ละเมิดข้อกำหนด';
        await adminService.banUser(user.id, reason, currentUser);
        showNotice('success', `ระงับบัญชี (Ban) ${user.name} เรียบร้อยแล้ว`);
      }
      await loadDashboardData();
    } catch (e) {
      showNotice('error', 'ดำเนินการล้มเหลว');
    } finally {
      setActionBusy(false);
    }
  };

  const handleAddDynamicAdmin = () => {
    if (!isCreator) {
      showNotice('error', 'เฉพาะ Admin++ (Creator) เท่านั้นที่สามารถแต่งตั้ง Admin ได้');
      return;
    }
    const email = newAdminEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      showNotice('error', 'กรุณาระบุ Email ที่ถูกต้อง');
      return;
    }
    addDynamicAdminEmail(email);
    setNewAdminEmail('');
    setDynamicAdmins(getDynamicAdminEmails());
    showNotice('success', `แต่งตั้ง ${email} เป็น Admin เรียบร้อยแล้ว`);
    loadDashboardData();
  };

  const handleRemoveDynamicAdmin = (email: string) => {
    if (!isCreator) return;
    if (window.confirm(`ต้องการถอดสิทธิ์ Admin ของ ${email} หรือไม่?`)) {
      removeDynamicAdminEmail(email);
      setDynamicAdmins(getDynamicAdminEmails());
      showNotice('success', `ถอดสิทธิ์ Admin ของ ${email} แล้ว`);
      loadDashboardData();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-purple-500/20 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={onReturnToGame}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium text-xs transition-colors cursor-pointer border border-slate-700/60"
          >
            <ArrowLeft className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">กลับสู่หน้าเกม</span>
          </button>

          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500/20 to-purple-500/20 border border-amber-500/40 text-amber-300 shadow-md shadow-amber-500/10">
              <Crown className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-1.5">
                  Admin++ Dashboard
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {isCreator ? '👑 SUPER ADMIN' : '⚡ ADMIN'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                ศูนย์จัดการผู้ใช้ บัญชีกระเป๋าชิป สถิติ และตรวจสอบความปลอดภัย
              </p>
            </div>
          </div>
        </div>

        {/* Right Action Profile & Refresh */}
        <div className="flex items-center gap-2.5">
          <div className="text-right hidden md:block">
            <div className="text-xs font-bold text-white flex items-center justify-end gap-1.5">
              <span>{currentUser.name}</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">{currentUser.email}</div>
          </div>

          <button
            type="button"
            onClick={loadDashboardData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </header>

      {/* Global Notification Banner */}
      {notification && (
        <div
          className={`sticky top-[57px] z-30 px-6 py-2.5 flex items-center justify-center gap-2 text-xs font-semibold shadow-md animate-fade-in ${
            notification.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-300 border-b border-emerald-500/30'
              : 'bg-red-950/90 text-red-300 border-b border-red-500/30'
          }`}
        >
          {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* 1. Top KPI Summary Grid */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-2xl flex items-center gap-3.5 shadow-lg">
            <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">ผู้ใช้ทั้งหมดในระบบ</div>
              <div className="text-xl sm:text-2xl font-black text-white">{metrics.totalUsers} <span className="text-xs text-slate-400 font-normal">บัญชี</span></div>
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-2xl flex items-center gap-3.5 shadow-lg">
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">ชิปหมุนเวียนรวม</div>
              <div className="text-xl sm:text-2xl font-black text-amber-300">{metrics.circulatingChips.toLocaleString()}</div>
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-2xl flex items-center gap-3.5 shadow-lg">
            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Dice5 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">รอบเดิมพันสะสม</div>
              <div className="text-xl sm:text-2xl font-black text-emerald-400">{metrics.totalRounds.toLocaleString()} <span className="text-xs text-slate-400 font-normal">รอบ</span></div>
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-2xl flex items-center gap-3.5 shadow-lg">
            <div className="p-3 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20">
              <Ban className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">บัญชีที่ถูกระงับ (Ban)</div>
              <div className="text-xl sm:text-2xl font-black text-red-400">{metrics.totalBanned} <span className="text-xs text-slate-400 font-normal">บัญชี</span></div>
            </div>
          </div>
        </section>

        {/* 2. Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`py-2 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>จัดการผู้ใช้ (User Management)</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300 font-mono">
              {users.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`py-2 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>เศรษฐกิจ & สถิติรวม (Analytics)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`py-2 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Audit Logs & ประวัติระบบ</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300 font-mono">
              {auditLogs.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`py-2 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>การตั้งค่า & สิทธิ์ Admin++</span>
          </button>
        </div>

        {/* 3. Tab Contents */}

        {/* TAB 1: USER MANAGEMENT */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Search & Filter Toolbar */}
            <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center gap-3 justify-between">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อ, อีเมล, User ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Filter className="w-3.5 h-3.5 text-slate-500" />
                  <span>สิทธิ์:</span>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="py-1.5 px-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="all">ทั้งหมด</option>
                    <option value="creator">👑 ผู้สร้าง (Creator)</option>
                    <option value="admin">⚡ ผู้ดูแล (Admin)</option>
                    <option value="player">👤 ผู้เล่นทั่วไป</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span>สถานะ:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="py-1.5 px-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="all">ทั้งหมด</option>
                    <option value="active">🟢 ปกติ</option>
                    <option value="banned">🔴 ถูกแบน</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">ผู้เล่น / บัญชี</th>
                      <th className="py-3 px-4">ระดับสิทธิ์</th>
                      <th className="py-3 px-4">สถานะ</th>
                      <th className="py-3 px-4">ชิปคงเหลือ</th>
                      <th className="py-3 px-4">สถิติ (รอบ/ชนะ)</th>
                      <th className="py-3 px-4 text-right">การจัดการด่วน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          ไม่พบผู้ใช้ที่ตรงกับเงื่อนไขการค้นหา
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-850/50 transition-colors">
                          {/* User info */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              {u.picture ? (
                                <img
                                  src={u.picture}
                                  alt={u.name}
                                  referrerPolicy="no-referrer"
                                  className="w-8 h-8 rounded-full object-cover border border-slate-700"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-amber-400 text-xs">
                                  {u.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div className="font-bold text-white flex items-center gap-1.5">
                                  <span>{u.name}</span>
                                  {u.id === currentUser.id && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-800 text-slate-300">
                                      (คุณ)
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {u.email || u.id}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Role */}
                          <td className="py-3.5 px-4">
                            {u.role === 'creator' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                <Crown className="w-3 h-3 text-amber-300" /> ผู้สร้าง (Admin++)
                              </span>
                            ) : u.role === 'admin' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                                <ShieldCheck className="w-3 h-3 text-purple-300" /> แอดมิน (Admin)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                                ผู้เล่น (Player)
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            {u.isBanned ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/40">
                                <Ban className="w-3 h-3" /> ระงับสิทธิ์
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                🟢 ปกติ
                              </span>
                            )}
                          </td>

                          {/* Balance */}
                          <td className="py-3.5 px-4">
                            <span className="font-mono font-bold text-amber-300 text-sm flex items-center gap-1">
                              <Coins className="w-3.5 h-3.5 text-amber-400" />
                              {u.balance.toLocaleString()}
                            </span>
                          </td>

                          {/* Stats */}
                          <td className="py-3.5 px-4 text-slate-300">
                            <div>{u.totalRounds} รอบ</div>
                            <div className="text-[10px] text-emerald-400 font-semibold">{u.winRate}% ชนะ</div>
                          </td>

                          {/* Quick Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Grant chips */}
                              <button
                                type="button"
                                onClick={() => setGrantModalUser(u)}
                                className="py-1 px-2.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                                title="เพิ่มชิป"
                              >
                                <PlusCircle className="w-3.5 h-3.5" />
                                <span>เติมชิป</span>
                              </button>

                              {/* Reset wallet */}
                              <button
                                type="button"
                                onClick={() => handleResetWallet(u)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                                title="รีเซ็ตชิปเป็น 1,000"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>

                              {/* Reset cooldowns */}
                              <button
                                type="button"
                                onClick={() => handleResetCooldown(u)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-950/60 hover:text-emerald-300 text-slate-300 transition-colors cursor-pointer"
                                title="ล้างคูลดาวน์"
                              >
                                <Zap className="w-3.5 h-3.5" />
                              </button>

                              {/* Ban / Unban (Creator-only) */}
                              {isCreator && u.role !== 'creator' && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleBan(u)}
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                    u.isBanned
                                      ? 'bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/30'
                                      : 'bg-red-950/50 hover:bg-red-900/60 text-red-300 border border-red-500/30'
                                  }`}
                                  title={u.isBanned ? 'ปลดแบนผู้เล่น' : 'ระงับบัญชีผู้เล่น'}
                                >
                                  {u.isBanned ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ANALYTICS & ECONOMY */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  สภาพคล่องชิปรวม (Liquidity)
                </div>
                <div className="text-2xl font-black text-amber-300">
                  {metrics.circulatingChips.toLocaleString()} ชิป
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  ยอดชิปรวมของผู้เล่นทุกคนที่หมุนเวียนอยู่ในระบบปัจจุบัน (ชิปจำลอง 100% ไม่ใช้เงินจริง)
                </p>
              </div>

              <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  House Advantage & Payouts
                </div>
                <div className="text-2xl font-black text-emerald-400">
                  97.2% RTP
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  กติกามาตรฐาน: สูง (11-17) จ่าย 1:1, ต่ำ (4-10) จ่าย 1:1, ตอง จ่าย 30:1 (House Edge เมื่อออกตอง)
                </p>
              </div>

              <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  การป้องกันการโกง (Security & Anti-Tamper)
                </div>
                <div className="text-2xl font-black text-purple-400">
                  SHA-256 HMAC
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  กระเป๋าชิปทุกใบมี Cryptographic Checksum ป้องกันการแก้ไขยอดเงินผ่าน DevTools อัตโนมัติ
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: AUDIT LOGS */}
        {activeTab === 'audit' && (
          <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">บันทึกประวัติการกระทำของระบบ (System Audit Trail)</h3>
                <p className="text-[11px] text-slate-400">
                  บันทึกการเพิ่มชิป การรีเซ็ต การระงับผู้ใช้ โดย Admin และ Creator
                </p>
              </div>
              <button
                type="button"
                onClick={loadDashboardData}
                className="py-1 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium transition-colors cursor-pointer"
              >
                รีเฟรช Log
              </button>
            </div>

            <div className="space-y-2">
              {auditLogs.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  ยังไม่มีประวัติการทำรายการในระบบ
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            log.action === 'CHIP_GRANT'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : log.action === 'USER_BAN'
                              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                              : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          }`}
                        >
                          {log.action}
                        </span>
                        <span className="text-xs font-semibold text-slate-200">{log.detail}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-2">
                        <span>โดย: {log.actorEmail || 'ระบบ'} ({log.actorRole})</span>
                        <span>•</span>
                        <span>เป้าหมาย: {log.targetUserId}</span>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono shrink-0">
                      {new Date(log.timestamp).toLocaleString('th-TH')}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: ADMIN++ SETTINGS */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Dynamic Admin Management */}
            <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center gap-2.5">
                <Crown className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">
                  จัดการรายชื่อผู้ดูแลระบบ (Admin Role Assignment)
                </h3>
              </div>
              <p className="text-xs text-slate-400">
                ผู้สร้าง (Creator / Admin++) สามารถแต่งตั้งหรือเพิกถอนสิทธิ์ผู้ดูแลระบบคนอื่นได้ทันที
              </p>

              {/* Hardcoded lists */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-slate-950/70 border border-amber-500/20 space-y-2">
                  <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Crown className="w-4 h-4" />
                    <span>ผู้สร้างสูงสุด (Creator / Admin++)</span>
                  </div>
                  <ul className="text-xs text-slate-300 space-y-1 font-mono">
                    {CREATOR_EMAILS.map((em) => (
                      <li key={em} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        <span>{em}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/70 border border-purple-500/20 space-y-2">
                  <div className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span>ผู้ดูแลระบบตั้งต้น (Default Admins)</span>
                  </div>
                  <ul className="text-xs text-slate-300 space-y-1 font-mono">
                    {ADMIN_EMAILS.map((em) => (
                      <li key={em} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                        <span>{em}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Dynamic Add Admin Form */}
              {isCreator && (
                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <div className="text-xs font-bold text-white">แต่งตั้ง Admin เพิ่มเติม:</div>
                  <div className="flex items-center gap-2 max-w-md">
                    <input
                      type="email"
                      placeholder="ใส่ Gmail เช่น newadmin@gmail.com"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
                    />
                    <button
                      type="button"
                      onClick={handleAddDynamicAdmin}
                      className="py-2 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-bold text-xs hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                    >
                      แต่งตั้ง
                    </button>
                  </div>

                  {dynamicAdmins.length > 0 && (
                    <div className="space-y-1.5 pt-2">
                      <div className="text-[11px] text-slate-400">Admin ที่แต่งตั้งเพิ่มเติม:</div>
                      <div className="flex flex-wrap gap-2">
                        {dynamicAdmins.map((em) => (
                          <span
                            key={em}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-950/60 border border-purple-500/40 text-purple-300 text-xs"
                          >
                            <span>{em}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveDynamicAdmin(em)}
                              className="text-purple-400 hover:text-red-400 cursor-pointer"
                              title="ลบสิทธิ์ Admin"
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Grant Chips Modal */}
      {grantModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300">
                <Coins className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">เติมชิปให้ผู้เล่น</h3>
                <p className="text-xs text-slate-400">
                  {grantModalUser.name} ({grantModalUser.email || grantModalUser.id})
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="text-[11px] text-slate-400">ยอดชิปปัจจุบัน:</div>
              <div className="text-xl font-black text-amber-300">
                {grantModalUser.balance.toLocaleString()} ชิป
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">จำนวนชิปที่ต้องการเพิ่ม:</label>
              <input
                type="number"
                min={1}
                step={500}
                value={grantAmount}
                onChange={(e) => setGrantAmount(Math.max(1, Number(e.target.value) || 1))}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-amber-300 font-bold text-base focus:outline-none focus:border-amber-500/60"
              />

              <div className="grid grid-cols-4 gap-2 pt-1">
                {[500, 1000, 5000, 50000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setGrantAmount(amt)}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      grantAmount === amt
                        ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50'
                        : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                    }`}
                  >
                    +{amt.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={actionBusy}
                onClick={handleGrantChips}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-xs hover:brightness-110 active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
              >
                {actionBusy ? 'กำลังดำเนินการ...' : `ยืนยันเติม +${grantAmount.toLocaleString()} ชิป`}
              </button>

              <button
                type="button"
                onClick={() => setGrantModalUser(null)}
                className="py-3 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
