# AGENTS.md

คู่มือสำหรับ AI agent ที่เข้ามาทำงานกับโปรเจกต์นี้

## กฎสำคัญที่สุด: deploy ทุกครั้งที่ทำงานเสร็จ

**เมื่อแก้โค้ดเสร็จและตรวจผ่านแล้ว ให้ deploy ขึ้น Cloudflare ทันที ไม่ต้องถามก่อน**
ถือว่าได้รับอนุญาตจากเจ้าของโปรเจกต์ไว้ล่วงหน้าแล้ว งานที่ยังไม่ deploy ถือว่ายังไม่เสร็จ

ลำดับที่ต้องทำให้ครบทุกครั้ง ห้ามข้าม:

```bash
bun run typecheck                                        # 1. ต้องผ่าน
bun test                                                 # 2. ต้องผ่านทุกเคส
npx wrangler d1 migrations apply mini-casino-db --remote  # 3. ถ้ามี migration ใหม่ ต้องมาก่อน deploy
bun run deploy:cf                                        # 4. build + deploy
curl -s https://mini-casino-game.songpon-official.workers.dev/api/health   # 5. ต้องได้ "ok": true
```

ถ้าขั้นที่ 1 หรือ 2 ไม่ผ่าน **ห้าม deploy** ให้แก้ให้ผ่านก่อน
รายละเอียดเพิ่มเติม ข้อควรระวัง และวิธี rollback อยู่ใน [`deploy.md`](./deploy.md)

หลัง deploy ให้รายงาน URL และ Version ID ที่ได้จาก output ของ `wrangler deploy` ด้วย

## โปรเจกต์นี้คืออะไร

มินิเกมลูกเต๋าสูง-ต่ำ (High-Low Dice) ใช้ชิปจำลอง ไม่มีเงินจริง
เขียนด้วย React 19 + TypeScript + Vite + Tailwind 4 รันบน Cloudflare Workers

## สถาปัตยกรรม

Worker ตัวเดียวทำสองหน้าที่:

- `/api/*` → REST API ที่คุยกับ Cloudflare D1 (`src/worker/index.ts`)
- path อื่น → static assets ของ SPA ผ่าน `env.ASSETS`

โครงสร้างโค้ดเป็น Clean Architecture แยกชั้นชัดเจน **ให้รักษาขอบเขตนี้ไว้**:

```
src/domain/          # entity, port (interface), business rule — ห้าม import ชั้นอื่น
src/application/     # use case, service — เรียกผ่าน port เท่านั้น
src/infrastructure/  # ตัวเชื่อมของจริง: D1 repo, LocalStorage repo, Google auth, RNG
src/presentation/    # React component + hook store
src/worker/          # โค้ดฝั่งเซิร์ฟเวอร์ (router + SQL ทั้งหมด)
```

### ที่เก็บข้อมูลมีสองทาง

`src/infrastructure/storage/storageProvider.ts` เป็นตัวตัดสิน:

- **D1 เป็นหลัก** — ใช้เมื่อ `/api/health` ตอบว่าต่อได้และตารางครบ
- **LocalStorage เป็นตัวสำรอง** — ใช้เมื่อต่อ Worker ไม่ได้ (เช่นรัน `bun run dev` เดี่ยวๆ)

พฤติกรรมนี้ **ตั้งใจไว้ ไม่ใช่บั๊ก** ดูโหมดที่ใช้อยู่ได้ที่ Admin Dashboard แท็บ Settings
เวลาเพิ่มที่เก็บข้อมูลใหม่ ให้ implement port เดิม (`IWalletRepository` / `IHistoryRepository`)
อย่าแก้ตัว port เพราะ `AdminService` และ `useGameEngine` พึ่งสัญญานี้อยู่

## คำสั่งที่ใช้บ่อย

```bash
bun run dev          # vite :5173 (proxy /api ไป :8787) — ต้องรันคู่กับ dev:cf ถ้าจะใช้ D1
bun run dev:cf       # Worker + D1 local :8787
bun run typecheck
bun test
bun run deploy:cf    # vite build && wrangler deploy
bun run db:migrate   # apply migration ขึ้น D1 production
```

## ข้อควรระวัง

- **`wrangler deploy` เดี่ยวๆ ไม่ build ให้** ต้องใช้ `bun run deploy:cf` ไม่งั้นได้ dist เก่า
- **migration ต้อง apply ก่อน deploy** ไม่ใช่หลัง และต้อง apply ทั้ง `--local` และ `--remote`
- **CI ที่ `.github/workflows/deploy.yml` ไม่ apply migration ให้** ต้องทำเองก่อน push
- `npx wrangler whoami` คืน exit code 1 แม้สำเร็จ ให้ดูข้อความที่พิมพ์ ไม่ใช่ exit code
- บัญชี Cloudflare ที่ถูกต้องคือ `songpon.official@gmail.com` ถ้าไม่ใช่ ให้หยุดและถาม
- D1 `--remote` คือฐานข้อมูล production ส่วน `--local` คือไฟล์ใน `.wrangler/state/` **อย่าสลับกันเวลาเขียนข้อมูล**
- ข้อความใน UI และคอมเมนต์เป็นภาษาไทย ให้เขียนต่อด้วยภาษาไทยให้เข้ากับของเดิม

## เรื่องสิทธิ์ผู้ใช้ — ระวังเป็นพิเศษ

สิทธิ์ `creator` / `admin` / `player` ตัดสินจาก **อีเมลที่ Google ยืนยันแล้ว เทียบตรงตัว**
กับรายชื่อใน `src/domain/constants/AdminConfig.ts` เท่านั้น

เคยมีช่องโหว่ที่แก้ไปแล้ว **ห้ามเขียนกลับมาในรูปแบบใด**:

- ให้สิทธิ์จาก substring ของ user id หรืออีเมล (เช่น `id.includes('admin')`, `email.includes('seree')`)
- ปุ่ม/โหมดทดสอบที่กดแล้วได้สิทธิ์ admin หรือ creator
- `loginWithMock()` ต้องเป็น `role: 'player'` เสมอ และไม่รับ id/email/role จากผู้เรียก
- สร้างโปรไฟล์ผู้ดูแลระบบปลอมขึ้นมาเมื่อไม่มีผู้ใช้ล็อกอิน

## งานที่ยังค้างอยู่

**`/api/admin/*` ยังไม่มีการยืนยันตัวตน** ใครก็ `curl` เพิ่มชิป แบนผู้ใช้ หรือเปลี่ยน role ได้
โดยไม่ต้องล็อกอิน การแก้คือให้ Worker ตรวจ Google ID token เอง (verify RS256 กับ JWKS ของ
Google ผ่าน WebCrypto) แล้วเช็ค role จากตาราง `role_overrides` ฝั่งเซิร์ฟเวอร์
ไม่เชื่อ role ที่ client ส่งมา

อีกเรื่อง: `resolveUserRole()` ยังอ่าน role override จาก LocalStorage ซึ่งผู้ใช้แก้เองได้
ใน DevTools แล้วเลื่อนตัวเองเป็น creator ได้ ควรเปลี่ยนไปดึงจาก D1 มาเก็บใน memory
