# High-Low Dice Mini-Game (มินิเกมลูกเต๋าสูง-ต่ำ)

เกมทอยลูกเต๋า 3 ลูก แทง ต่ำ / ตอง / สูง ด้วยชิป เขียนด้วย React 19 + TypeScript + Vite + Tailwind 4
รันบน Cloudflare Workers เก็บข้อมูลใน Cloudflare D1

- **Production:** https://mini-casino-game.songpon-official.workers.dev
- **สถาปัตยกรรม:** Clean Architecture (domain / application / infrastructure / presentation) + Worker API
- **คู่มือสำหรับ AI agent / ผู้ดูแล:** [`AGENTS.md`](./AGENTS.md) และ [`deploy.md`](./deploy.md)

---

## 🎲 ฟีเจอร์หลัก

- **กติกา:** ต่ำ (แต้มรวม 4–10) และสูง (11–17) จ่าย 1:1, ตอง (3 ลูกเท่ากัน) จ่าย 30:1
- **เดิมพัน:** ขั้นต่ำ 10 ชิป ไม่มีเพดานสูงสุด (ไม่เกินยอดคงเหลือ) เลือกจากปุ่มลัด 10/50/100/250/500,
  ปุ่ม **MAX** (เดิมพันทั้งยอดที่มี) หรือกรอกจำนวนเองในช่องตัวเลข
- **สุ่มเป็นธรรม:** ใช้ `crypto.getRandomValues` (CSPRNG) สุ่มแต้ม 1–6
- **ลูกเต๋า 3 มิติ:** อนิเมชัน CSS 3D พร้อมเสียงสังเคราะห์จาก Web Audio API
- **กระเป๋าชิป:** โบนัสรายวัน, ชิปช่วยเหลือเมื่อชิปหมด, สถิติและ Roadmap ผลย้อนหลัง
- **ล็อกอินด้วย Google:** แยกสิทธิ์ `creator` / `admin` / `player` จากอีเมลที่ Google ยืนยันแล้ว
- **เติม/ถอนชิปผ่าน PromptPay:** สร้าง order และตรวจสถานะผ่าน payment gateway (inwcloud) ฝั่ง Worker
- **แชทเทพเจ้าลูกเต๋า:** แชทดูดวงต่อ AI ผ่าน Worker (`/api/chat`) มี Gemini เป็น fallback
- **แถบข่าวผู้เล่น:** ข้อความจำลอง (ชื่อ + เหตุการณ์) เลื่อนใต้ header สุ่มความเร็ว 7–20 วินาที
  ข้อมูลอยู่ที่ `src/presentation/data/mockActivity.ts` ไม่ใช่ข้อมูลผู้เล่นจริง
- **Admin Dashboard:** จัดการผู้ใช้ แบน เปลี่ยน role ดู audit log และสถานะฐานข้อมูล

> ⚠️ ระบบมีการเติมและถอนชิปด้วยเงินจริงผ่าน PromptPay ไม่ใช่เกมชิปจำลองล้วนอีกต่อไป
> ตรวจกฎหมายและข้อกำหนดของ payment gateway ก่อนเปิดใช้งานจริง

---

## 🛠️ โครงสร้างโค้ด

```text
src/
├── domain/          # กฎธุรกิจ (Bet, DiceHand, VirtualWallet, PayoutCalculator, GameRules)
├── application/     # Use cases (PlaceBetAndRoll, ClaimBailout, ClaimDailyReward, AdminService)
├── infrastructure/  # ตัวเชื่อมของจริง: api, auth (Google), payment, rng, sound, storage (D1 / LocalStorage)
├── presentation/    # React components, store, ข้อมูล mock
└── worker/          # Worker: router, SQL (D1), payment, fortune chat
migrations/          # D1 migrations (0001–0004)
tests/               # bun test
```

ที่เก็บข้อมูลเลือกอัตโนมัติ: ใช้ **D1** เมื่อ `/api/health` ตอบว่าต่อได้ ไม่เช่นนั้นถอยไปใช้ **LocalStorage**
(เช่นรัน `bun run dev` เดี่ยวๆ)

---

## 🚀 รันในเครื่อง

```bash
bun install

bun run dev:cf        # Worker + D1 local ที่ :8787
bun run dev           # Vite ที่ :5173 (proxy /api ไป :8787) — รันคู่กับ dev:cf ถ้าจะใช้ D1

bun run db:migrate:local   # apply migration กับ D1 local
bun run typecheck
bun test
```

คัดลอก `.env.example` เป็น `.env` (หรือ `.dev.vars` สำหรับ Worker) แล้วกรอกค่า เช่น `VITE_GOOGLE_CLIENT_ID`,
`AI_*` / `GEMINI_*`, `INWCLOUD_API_KEY`, `CHIPS_PER_THB`, `MIN_TOPUP_THB`, `MAX_TOPUP_THB`
คีย์ฝั่ง Worker ห้ามขึ้นต้นด้วย `VITE_` และห้าม commit คีย์จริงลง git

---

## ☁️ Deploy (Cloudflare Workers)

```bash
bun run typecheck
bun test
npx wrangler d1 migrations apply mini-casino-db --remote   # ถ้ามี migration ใหม่ ต้องมาก่อน deploy
bun run deploy:cf                                          # vite build + wrangler deploy
curl -s https://mini-casino-game.songpon-official.workers.dev/api/health   # ต้องได้ "ok": true
```

- ใช้ `bun run deploy:cf` เสมอ เพราะ `wrangler deploy` เดี่ยวๆ ไม่ build ให้
- `.github/workflows/deploy.yml` ไม่ apply migration ให้ ต้องทำเองก่อน push
- รายละเอียดและวิธี rollback ดู [`deploy.md`](./deploy.md)

---

## 📑 เอกสารการวิเคราะห์ ออกแบบ และกระบวนการวิศวกรรม (Complete 10-Skill Pipeline)
- 📄 [01-requirements.md](docs/01-requirements.md) — วิเคราะห์ Requirement (Skill 01: Requirements Engineering)
- 📄 [02-system-design.md](docs/02-system-design.md) — สถาปัตยกรรมระบบ System Design (Skill 02: System Design)
- 📄 [03-software-architecture.md](docs/03-software-architecture.md) — รายละเอียด Clean Architecture (Skill 03: Software Architecture)
- 📄 [04-database-design.md](docs/04-database-design.md) — การออกแบบ Database Schema, D1, Ledger & ERD (Skill 04: Database Design)
- 📄 [05-api-design.md](docs/05-api-design.md) — การออกแบบ RESTful API, Idempotency & OpenAPI (Skill 05: API Design)
- 📄 [06-code-quality.md](docs/06-code-quality.md) — ผลการทบทวนคุณภาพโค้ด และแผนการปรับปรุง (Skill 06: Code Quality)
- 📄 [07-testing-qa.md](docs/07-testing-qa.md) — กลยุทธ์การทดสอบ, Test Matrix & Quality Gates (Skill 07: Testing & QA)
- 📄 [08-debugging-refactoring.md](docs/08-debugging-refactoring.md) — การสืบสวนและแก้ไขจุดบกพร่อง (Skill 08: Debugging & Refactoring)
- 📄 [09-owasp-security.md](docs/09-owasp-security.md) — การตรวจสอบและเสริมความปลอดภัยตามมาตรฐาน OWASP (Skill 09: OWASP Security)
- 📄 [10-devops-cicd.md](docs/10-devops-cicd.md) — ไปป์ไลน์ CI/CD, Multi-stage Docker & Auto-Deploy (Skill 10: DevOps & CI/CD)
