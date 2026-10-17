-- Migration: 0006_redeemed_codes.sql
-- บันทึกโค้ดแจกชิปที่บัญชีหนึ่งใช้ไปแล้ว (ใช้ได้ครั้งเดียวต่อบัญชีต่อโค้ด)
CREATE TABLE IF NOT EXISTS redeemed_codes (
    player_id TEXT NOT NULL,
    code TEXT NOT NULL,
    chips INTEGER NOT NULL,
    redeemed_at INTEGER NOT NULL,
    PRIMARY KEY (player_id, code)
);
