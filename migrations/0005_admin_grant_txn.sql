-- Migration: 0005_admin_grant_txn.sql
-- ขยาย txn_type ของ wallet_transactions ให้รับ 'ADMIN_GRANT' (ผู้ดูแลเพิ่มชิปให้ผู้เล่น)
-- SQLite แก้ CHECK constraint เดิมไม่ได้ จึงสร้างตารางใหม่แล้วคัดข้อมูลเดิมมา

CREATE TABLE wallet_transactions_new (
    id TEXT PRIMARY KEY,
    wallet_id TEXT NOT NULL,
    related_round_id TEXT,
    txn_type TEXT NOT NULL CHECK (txn_type IN ('INITIAL_GRANT', 'BET_DEDUCT', 'BET_PAYOUT', 'BAILOUT', 'DAILY_BONUS', 'RESET', 'PURCHASE', 'ADMIN_GRANT')),
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
