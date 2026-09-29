-- Migration: 0001_initial_schema.sql
-- High-Low Dice Casual Game Database Schema (SQLite / Cloudflare D1 Compatible)

-- 1. Players Table
CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    nickname TEXT NOT NULL,
    client_ip_hash TEXT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at INTEGER NOT NULL,
    last_active_at INTEGER NOT NULL
);

-- 2. Virtual Wallets Table
CREATE TABLE IF NOT EXISTS virtual_wallets (
    wallet_id TEXT PRIMARY KEY,
    player_id TEXT NOT NULL UNIQUE,
    balance INTEGER NOT NULL DEFAULT 1000 CHECK (balance >= 0),
    last_bailout_at INTEGER NOT NULL DEFAULT 0,
    last_daily_claim_at INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

-- 3. Player Stats Table
CREATE TABLE IF NOT EXISTS player_stats (
    player_id TEXT PRIMARY KEY,
    total_games INTEGER NOT NULL DEFAULT 0 CHECK (total_games >= 0),
    wins INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0),
    losses INTEGER NOT NULL DEFAULT 0 CHECK (losses >= 0),
    current_streak INTEGER NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
    max_streak INTEGER NOT NULL DEFAULT 0 CHECK (max_streak >= 0),
    biggest_win INTEGER NOT NULL DEFAULT 0 CHECK (biggest_win >= 0),
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

-- 4. Game Rounds Table
CREATE TABLE IF NOT EXISTS game_rounds (
    id TEXT PRIMARY KEY,
    wallet_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    bet_choice TEXT NOT NULL CHECK (bet_choice IN ('LOW', 'HIGH', 'TRIPLE')),
    bet_amount INTEGER NOT NULL CHECK (bet_amount >= 10 AND bet_amount <= 500),
    dice_1 INTEGER NOT NULL CHECK (dice_1 BETWEEN 1 AND 6),
    dice_2 INTEGER NOT NULL CHECK (dice_2 BETWEEN 1 AND 6),
    dice_3 INTEGER NOT NULL CHECK (dice_3 BETWEEN 1 AND 6),
    dice_total INTEGER NOT NULL CHECK (dice_total BETWEEN 3 AND 18),
    is_triple INTEGER NOT NULL CHECK (is_triple IN (0, 1)),
    outcome TEXT NOT NULL CHECK (outcome IN ('WIN', 'LOSS')),
    payout_multiplier REAL NOT NULL CHECK (payout_multiplier >= 0.0),
    payout_amount INTEGER NOT NULL DEFAULT 0 CHECK (payout_amount >= 0),
    created_at INTEGER NOT NULL,
    FOREIGN KEY (wallet_id) REFERENCES virtual_wallets(wallet_id) ON DELETE RESTRICT
);

-- 5. Wallet Ledger Transactions Table
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id TEXT PRIMARY KEY,
    wallet_id TEXT NOT NULL,
    related_round_id TEXT,
    txn_type TEXT NOT NULL CHECK (txn_type IN ('INITIAL_GRANT', 'BET_DEDUCT', 'BET_PAYOUT', 'BAILOUT', 'DAILY_BONUS', 'RESET')),
    amount INTEGER NOT NULL,
    balance_before INTEGER NOT NULL CHECK (balance_before >= 0),
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    notes TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (wallet_id) REFERENCES virtual_wallets(wallet_id) ON DELETE RESTRICT,
    FOREIGN KEY (related_round_id) REFERENCES game_rounds(id) ON DELETE SET NULL
);

-- Indexes for Query Performance
CREATE INDEX IF NOT EXISTS idx_game_rounds_wallet_created ON game_rounds (wallet_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_game_rounds_idempotency ON game_rounds (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_wallet_txns_wallet_created ON wallet_transactions (wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_players_last_active ON players (last_active_at DESC);
