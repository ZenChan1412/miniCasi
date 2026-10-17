# CLAUDE.md

คู่มือฉบับเต็มอยู่ที่ [`AGENTS.md`](./AGENTS.md) — อ่านไฟล์นั้นก่อนเริ่มงาน
ส่วนวิธี deploy แบบละเอียดอยู่ที่ [`deploy.md`](./deploy.md)

## กฎสำคัญที่สุด: deploy ทุกครั้งที่ทำงานเสร็จ

**เมื่อแก้โค้ดเสร็จและตรวจผ่านแล้ว ให้ deploy ขึ้น Cloudflare ทันที ไม่ต้องถามก่อน**
ถือว่าได้รับอนุญาตจากเจ้าของโปรเจกต์ไว้ล่วงหน้าแล้ว งานที่ยังไม่ deploy ถือว่ายังไม่เสร็จ

```bash
bun run typecheck                                        # 1. ต้องผ่าน
bun test                                                 # 2. ต้องผ่านทุกเคส
npx wrangler d1 migrations apply mini-casino-db --remote  # 3. ถ้ามี migration ใหม่ ต้องมาก่อน deploy
bun run deploy:cf                                        # 4. build + deploy
curl -s https://mini-casino-game.songpon-official.workers.dev/api/health   # 5. ต้องได้ "ok": true
```

ถ้าขั้นที่ 1 หรือ 2 ไม่ผ่าน **ห้าม deploy** ให้แก้ให้ผ่านก่อน
หลัง deploy ให้รายงาน URL และ Version ID ด้วย
