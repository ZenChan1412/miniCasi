-- Migration: 0002_admin_and_identity.sql
-- เพิ่มข้อมูลโปรไฟล์ผู้ใช้, การระงับบัญชี, การกำหนดสิทธิ์ และ Audit Log
-- ย้ายข้อมูลที่เคยเก็บใน LocalStorage (registry / banned / audit / role override) มาอยู่บน D1

-- 1. ขยายตาราง players ให้เก็บโปรไฟล์จาก Google OAuth
ALTER TABLE players ADD COLUMN email TEXT;
ALTER TABLE players ADD COLUMN picture TEXT;
ALTER TABLE players ADD COLUMN provider TEXT NOT NULL DEFAULT 'guest';
ALTER TABLE players ADD COLUMN role TEXT NOT NULL DEFAULT 'player';

CREATE INDEX IF NOT EXISTS idx_players_email ON players (email);

-- 2. ตารางการระงับบัญชี (แทน high_low_banned_users_v1)
CREATE TABLE IF NOT EXISTS user_bans (
    player_id TEXT PRIMARY KEY,
    reason TEXT NOT NULL DEFAULT 'ละเมิดข้อกำหนดการใช้งาน',
    banned_by TEXT,
    banned_at INTEGER NOT NULL
);

-- 3. ตารางกำหนดสิทธิ์ (แทน role overrides ใน LocalStorage)
-- identifier เก็บได้ทั้ง player id และอีเมล (normalize เป็นตัวพิมพ์เล็ก)
CREATE TABLE IF NOT EXISTS role_overrides (
    identifier TEXT PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('creator', 'admin', 'player')),
    assigned_by TEXT,
    updated_at INTEGER NOT NULL
);

-- 4. ตาราง Audit Log (แทน high_low_audit_logs_v2)
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_email TEXT,
    actor_role TEXT NOT NULL,
    action TEXT NOT NULL,
    target_user_id TEXT NOT NULL,
    target_name TEXT,
    amount INTEGER,
    balance_before INTEGER,
    balance_after INTEGER,
    detail TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs (target_user_id, created_at DESC);

-- 5. เก็บ roadmap ของผู้เล่น (15 ตาล่าสุด) ไว้ใน player_stats เพื่อให้ตรงกับ PlayerStats ฝั่งโดเมน
ALTER TABLE player_stats ADD COLUMN roadmap_json TEXT NOT NULL DEFAULT '[]';
