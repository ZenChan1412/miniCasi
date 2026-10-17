-- Migration: 0004_payment_orders.sql
-- ระบบเติมชิปด้วยเงินจริงผ่าน Payment Gateway (inwcloud.shop หมวด PromptPay)
--
-- 1. ตาราง payment_orders เก็บรายการสร้าง QR พร้อมเพย์แต่ละครั้ง ผูกกับผู้เล่น
--    transaction_id ของ Gateway เป็น UNIQUE เพื่อกันการเติมชิปซ้ำจากรายการเดียวกัน
-- 2. ขยายค่า txn_type ของ wallet_transactions ให้รับ 'PURCHASE'
--    (SQLite แก้ CHECK constraint เดิมไม่ได้ จึงต้องสร้างตารางใหม่แล้วคัดข้อมูลเดิมมา)

-- 1. ตารางรายการชำระเงิน
CREATE TABLE IF NOT EXISTS payment_orders (
    id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL,
    transaction_id TEXT NOT NULL UNIQUE,
    amount_thb REAL NOT NULL CHECK (amount_thb > 0),
    chips INTEGER NOT NULL CHECK (chips > 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'failed')),
    qr_url TEXT,
    payload TEXT,
    expires_at INTEGER,
    created_at INTEGER NOT NULL,
    paid_at INTEGER,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_player ON payment_orders (player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders (status, created_at DESC);

-- 2. สร้าง wallet_transactions ใหม่ที่รับ txn_type 'PURCHASE' เพิ่ม
CREATE TABLE wallet_transactions_new (
    id TEXT PRIMARY KEY,
    wallet_id TEXT NOT NULL,
    related_round_id TEXT,
    txn_type TEXT NOT NULL CHECK (txn_type IN ('INITIAL_GRANT', 'BET_DEDUCT', 'BET_PAYOUT', 'BAILOUT', 'DAILY_BONUS', 'RESET', 'PURCHASE')),
    amount INTEGER NOT NULL,
    balance_before INTEGER NOT NULL CHECK (balance_before >= 0),
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    notes TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (wallet_id) REFERENCES virtual_wallets(wallet_id) ON DELETE RESTRICT,
    FOREIGN KEY (related_round_id) REFERENCES game_rounds(id) ON DELETE SET NULL
);

INSERT INTO wallet_transactions_new
  (id, wallet_id, related_round_id, txn_type, amount, balance_before, balance_after, notes, created_at)
SELECT id, wallet_id, related_round_id, txn_type, amount, balance_before, balance_after, notes, created_at
  FROM wallet_transactions;

DROP TABLE wallet_transactions;
ALTER TABLE wallet_transactions_new RENAME TO wallet_transactions;

CREATE INDEX IF NOT EXISTS idx_wallet_txns_wallet_created ON wallet_transactions (wallet_id, created_at DESC);
