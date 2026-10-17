-- Migration: 0003_seed_super_users.sql
-- ให้บัญชีผู้สร้างและผู้ดูแลระบบมีแถวใน D1 เสมอ
-- โค้ดเดิม (LocalStorage) ยัดสองบัญชีนี้ลง Dashboard ให้อยู่แล้ว เมื่อย้ายมา D1
-- ถ้าไม่ seed ไว้ หน้า User Management จะว่างจนกว่าเจ้าตัวจะล็อกอินครั้งแรก

-- 1. ผู้เล่นสองบัญชีหลัก
INSERT INTO players (id, nickname, email, provider, role, is_active, created_at, last_active_at)
VALUES
  ('google_creator_songpon', 'Songpon (Creator)', 'songpon.official@gmail.com', 'google', 'creator', 1,
   unixepoch() * 1000, unixepoch() * 1000),
  ('google_admin_seree', 'Seree (Admin)', 'seree999@gmail.com', 'google', 'admin', 1,
   unixepoch() * 1000, unixepoch() * 1000)
ON CONFLICT (id) DO UPDATE SET
  email = COALESCE(players.email, excluded.email),
  role  = excluded.role;

-- 2. ซ่อมชื่อที่เคยถูกเขียนทับด้วย player id (บั๊กของ ensurePlayer ก่อนแก้)
UPDATE players SET nickname = 'Songpon (Creator)'
 WHERE id = 'google_creator_songpon' AND nickname = id;
UPDATE players SET nickname = 'Seree (Admin)'
 WHERE id = 'google_admin_seree' AND nickname = id;

-- 3. กระเป๋าชิปเริ่มต้นของสองบัญชี (ไม่แตะยอดเดิมถ้ามีอยู่แล้ว)
INSERT INTO virtual_wallets (wallet_id, player_id, balance, last_bailout_at, last_daily_claim_at, version, updated_at)
VALUES
  ('w_google_creator_songpon', 'google_creator_songpon', 1000, 0, 0, 1, unixepoch() * 1000),
  ('w_google_admin_seree', 'google_admin_seree', 1000, 0, 0, 1, unixepoch() * 1000)
ON CONFLICT (player_id) DO NOTHING;

-- 4. สถิติเริ่มต้น
INSERT INTO player_stats (player_id, total_games, wins, losses, current_streak, max_streak, biggest_win, roadmap_json, updated_at)
VALUES
  ('google_creator_songpon', 0, 0, 0, 0, 0, 0, '[]', unixepoch() * 1000),
  ('google_admin_seree', 0, 0, 0, 0, 0, 0, '[]', unixepoch() * 1000)
ON CONFLICT (player_id) DO NOTHING;

-- 5. สิทธิ์ของสองบัญชีนี้ (ทั้ง id และอีเมล) ให้ตรงกับ AdminConfig ฝั่ง client
INSERT INTO role_overrides (identifier, role, assigned_by, updated_at)
VALUES
  ('google_creator_songpon', 'creator', 'migration_0003', unixepoch() * 1000),
  ('songpon.official@gmail.com', 'creator', 'migration_0003', unixepoch() * 1000),
  ('google_admin_seree', 'admin', 'migration_0003', unixepoch() * 1000),
  ('seree999@gmail.com', 'admin', 'migration_0003', unixepoch() * 1000)
ON CONFLICT (identifier) DO NOTHING;
