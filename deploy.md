# Deploy

คู่มือ deploy โปรเจกต์นี้สำหรับ agent — ทำตามลำดับ อย่าข้ามขั้น

## สิ่งที่ต้องรู้ก่อน

| รายการ | ค่า |
|---|---|
| Worker name | `mini-casino-game` |
| D1 database | `mini-casino-db` |
| D1 database_id | `7aa283f3-ae4b-42bc-8337-930851021a00` |
| D1 binding ในโค้ด | `env.DB` |
| Assets binding | `env.ASSETS` (เสิร์ฟ `./dist`) |
| Cloudflare account | `songpon.official@gmail.com` (`14b0a7ab8fac9d18ff55440a28cc8871`) |
| Config | `wrangler.jsonc` |

สถาปัตยกรรม: Worker เดียวทำสองหน้าที่ — `/api/*` คือ REST API ที่คุยกับ D1
(`src/worker/index.ts`) ส่วน path อื่นส่งต่อให้ static assets ของ SPA

ตรวจว่า login ถูกบัญชีก่อนเสมอ:

```bash
npx wrangler whoami
```

ถ้าไม่ใช่ `songpon.official@gmail.com` ให้หยุดและถามผู้ใช้ อย่า deploy ข้ามบัญชี
(คำสั่ง `wrangler whoami` คืน exit code 1 แม้สำเร็จ ให้ดูข้อความที่พิมพ์ออกมาแทน)

## ขั้นตอน deploy

### 1. ตรวจคุณภาพโค้ดก่อน

```bash
bun run typecheck
bun test
```

ทั้งสองต้องผ่าน ถ้า fail ให้แก้ก่อน ห้าม deploy ทับ

### 2. apply migration ขึ้น D1 production

**ขั้นนี้สำคัญและต้องทำก่อน deploy โค้ด** ถ้า deploy โค้ดที่ query ตารางใหม่
แต่ยังไม่ apply migration ระบบจะพังทันทีเพราะหาตารางไม่เจอ

```bash
npx wrangler d1 migrations apply mini-casino-db --remote
```

migration อยู่ที่ `migrations/` เรียงตามเลขหน้าไฟล์ และ apply แบบ idempotent
(รันซ้ำได้ ตัวที่ apply แล้วจะถูกข้าม) ถ้าเพิ่มไฟล์ใหม่ให้ตั้งชื่อต่อเลขเดิม
เช่น `0004_xxx.sql` และต้อง apply ลง local ด้วยเพื่อให้ `wrangler dev` ตรงกัน:

```bash
npx wrangler d1 migrations apply mini-casino-db --local
```

### 3. build แล้ว deploy

```bash
bun run deploy:cf
```

script นี้คือ `vite build && wrangler deploy` — ต้อง build ก่อนเพราะ `wrangler deploy`
อัปโหลดไฟล์จาก `./dist` ตามที่ตั้งใน `wrangler.jsonc` ถ้าลืม build จะได้ของเก่าขึ้นไป

### 4. ตรวจผลหลัง deploy

```bash
# ควรได้ "ok": true และตาราง 8 ตัวครบ
curl -s https://mini-casino-game.<subdomain>.workers.dev/api/health | python3 -m json.tool

# ข้อมูลผู้ใช้ออกมาจริงไหม
curl -s https://mini-casino-game.<subdomain>.workers.dev/api/admin/users
```

URL จริงดูได้จาก output ของ `wrangler deploy` หรือ `npx wrangler deployments list`

ถ้า `/api/health` ตอบ `503` พร้อม `exists: false` ของตารางใด = ลืม apply migration
ให้ย้อนไปทำขั้นที่ 2

## rollback

```bash
npx wrangler deployments list
npx wrangler rollback <deployment-id>
```

**ข้อควรระวัง: rollback ย้อนได้แค่โค้ด ไม่ย้อน schema ของ D1** ถ้า deploy นั้นมาพร้อม
migration ที่เปลี่ยนโครงสร้างตาราง ต้องเขียน migration ใหม่เพื่อย้อน schema เอง

## รันในเครื่องเพื่อทดสอบก่อน deploy

```bash
bun run dev:cf   # Worker + D1 local ที่ :8787 — ใช้ตัวนี้ถ้าจะทดสอบ API/D1
bun run dev      # vite ที่ :5173 (proxy /api ไป :8787 ให้แล้ว) ต้องรันคู่กับ dev:cf
```

`bun run dev` เดี่ยวๆ จะไม่มี Worker ให้คุย แอปจะตรวจไม่พบ D1 แล้วถอยไปเก็บข้อมูล
ที่ LocalStorage โดยอัตโนมัติ (เห็นสถานะได้ที่ Admin Dashboard แท็บ Settings)
ซึ่งเป็นพฤติกรรมที่ตั้งใจไว้ ไม่ใช่บั๊ก

## CI/CD

`.github/workflows/deploy.yml` deploy อัตโนมัติเมื่อ push เข้า `master`/`main`
ใช้ secret `CLOUDFLARE_API_TOKEN` และ `CLOUDFLARE_ACCOUNT_ID`

**ข้อจำกัดที่ต้องรู้: workflow นี้ไม่ apply D1 migration ให้** ถ้า commit มี migration ใหม่
ต้องรัน `wrangler d1 migrations apply mini-casino-db --remote` เองก่อน push
หรือไม่ก็เพิ่มขั้นนั้นเข้า workflow ก่อน

## คำสั่งอ้างอิง

```bash
npx wrangler d1 list                                    # ดู database ทั้งหมด
npx wrangler d1 info mini-casino-db                      # ขนาด/จำนวน read-write
npx wrangler d1 execute mini-casino-db --remote --command "SELECT * FROM players"
npx wrangler d1 execute mini-casino-db --local  --command "SELECT * FROM players"
npx wrangler tail                                        # ดู log สดของ Worker
```

`--remote` = ฐานข้อมูล production บน Cloudflare, `--local` = ไฟล์ใน `.wrangler/state/`
**ระวังอย่าสลับสองตัวนี้เวลารันคำสั่งที่เขียนข้อมูล**

## เรื่องที่ค้างอยู่ (ควรรู้ก่อน deploy ขึ้น production จริง)

`/api/admin/*` **ยังไม่มีการยืนยันตัวตน** ใครก็เรียกเพิ่มชิป แบนผู้ใช้ หรือเปลี่ยน role
ได้โดยไม่ต้องล็อกอิน การแก้คือให้ Worker ตรวจ Google ID token เอง (verify RS256
กับ JWKS ของ Google) แล้วเช็ค role จากตาราง `role_overrides` ฝั่งเซิร์ฟเวอร์
ไม่เชื่อ role ที่ client ส่งมา — ถ้าจะเปิดใช้งานจริงแบบมีผู้ใช้ภายนอก ต้องแก้ข้อนี้ก่อน
