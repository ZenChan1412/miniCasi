# High-Low Dice Casual Mini-Game (มินิเกมลูกเต๋าสูง-ต่ำ ไม่ใช้เงินจริง)

> **เฟส 1 (Phase 1):** ระบบเกมหลัก (Core Gameplay), ระบบกระเป๋าชิปจำลอง, ระบบกู้ชีพชิปฉุกเฉิน (Bailout), โบนัสรายวัน (Daily Faucet), สถิติ Roadmap และระบบเสียงสังเคราะห์ Web Audio  
> **สถาปัตยกรรม:** Clean Architecture (Domain, Application, Infrastructure, Presentation)  
> **CI/CD & Deployment:** Cloudflare Pages Auto-Deploy ผ่าน GitHub Actions / Wrangler  

---

## 🎲 จุดเด่นของระบบ (Key Highlights)
1. **Zero Real Money Guarantee:** เล่นด้วยชิปคะแนนจำลอง 100% ไม่มีช่องทางเติมเงินจริง ไม่สามารถแลกเปลี่ยนหรือถอนเป็นเงินสดได้ ปลอดภัยตามกฎหมาย
2. **CSPRNG Fair Random:** ใช้ Web Cryptography API (`crypto.getRandomValues`) สุ่มแต้มลูกเต๋า 1-6 อย่างเป็นธรรม ไร้อคติทางสถิติ
3. **Infinite Playability:** เมื่อชิปหมด (< 10) สามารถกดรับชิปช่วยเหลือฉุกเฉิน (+200 ชิป) หรือรับโบนัสล็อกอินรายวัน (+500 ชิป) ได้ตลอดเวลา
4. **CSS 3D Dice Simulation:** อนิเมชันลูกเต๋า 3 มิติ หมุนและหยุดตามแต้มจริง พร้อมเสียงประกอบสังเคราะห์ผ่าน Web Audio API
5. **Tamper-Resistant Storage:** ระบบตรวจจับการแก้ไขยอดชิปบน Browser Console ด้วย Checksum Signature

---

## 🛠️ โครงสร้างสถาปัตยกรรม (Architecture Layers)
```text
src/
├── domain/               # Core Business Rules (Bet, DiceHand, VirtualWallet, PayoutCalculator)
├── application/          # Use Cases (PlaceBetAndRoll, ClaimBailout, ClaimDailyReward)
├── infrastructure/       # Adapters (WebCryptoRNG, LocalStorageWalletRepo, SoundFX)
└── presentation/         # UI Components (3D Dice, BetBoard, WalletBar, Roadmap, Modals)
```

---

## 🚀 การติดตั้งและรันในเครื่อง (Local Development)

```bash
# ติดตั้ง dependencies
bun install
# หรือ npm install

# รันโหมด Development (Hot Reload)
bun run dev
# หรือ npm run dev

# รันชุดทดสอบ Automated Unit Tests (14 passing tests)
bun test

# สั่ง Build สำหรับ Production
bun run build
```

---

## ☁️ การ Deploy ต่อกับ Cloudflare Pages แบบ Auto

### วิธีที่ 1: Auto-deploy ผ่าน GitHub Actions (ตั้งค่าไว้ใน `.github/workflows/deploy.yml`)
1. เมื่อทำการ Push โค้ดขึ้นบน Branch `master` หรือ `main` บน GitHub:
   ```bash
   git add .
   git commit -m "feat: release phase 1 mini-game"
   git push origin master
   ```
2. ตั้งค่า GitHub Repository Secrets (ไปที่ `Settings` > `Secrets and variables` > `Actions`):
   - `CLOUDFLARE_API_TOKEN`: Cloudflare API Token ที่มีสิทธิ์แก้ไข Pages
   - `CLOUDFLARE_ACCOUNT_ID`: Cloudflare Account ID
3. GitHub Actions จะทำการ Test, Build และ Deploy ขึ้น Cloudflare Pages โดยอัตโนมัติทุกครั้งที่มีการ Push!

### วิธีที่ 2: Deploy ตรงจากเครื่องผ่าน Wrangler CLI
```bash
# ล็อกอิน Cloudflare (ครั้งแรก)
npx wrangler login

# สั่ง Deploy ขึ้น Cloudflare Pages ทันที
bun run deploy:cf
# หรือ npx wrangler pages deploy dist --project-name=mini-casino-game
```

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
