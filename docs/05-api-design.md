# เอกสารการออกแบบส่วนต่อประสานโปรแกรมประยุกต์ (API Design Specification)
## ระบบ: มินิเกมง่าย ๆ แนวพนันไม่ลงเงินจริง (Play-Money Casual High-Low Mini-Game)

> **มาตรฐาน:** ดำเนินการออกแบบตามทักษะ **05-api-design**  
> **อ้างอิงเอกสารเดิม:**  
> - [01-requirements.md](01-requirements.md)  
> - [02-system-design.md](02-system-design.md)  
> - [03-software-architecture.md](03-software-architecture.md)  
> - [04-database-design.md](04-database-design.md)  
> **รูปแบบ:** RESTful API & OpenAPI 3.1 Standard  
> **เวอร์ชัน:** 1.0.0  
> **สถานะ:** Approved for Implementation  

---

## 1. แคตตาล็อกจุดเชื่อมต่อระบบ (Endpoint Catalog)

ฐาน API ทั้งหมดจะขึ้นต้นด้วยเวอร์ชัน `/api/v1`

| Method | Endpoint Path | Summary | Authentication | Idempotent |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/sessions/anonymous` | สร้างหรือกู้คืน Session ผู้เล่นแบบไม่ระบุตัวตน | None | No |
| `GET` | `/api/v1/wallets/me` | ดึงข้อมูลยอดชิปคงเหลือและสถานะ Cooldown | Bearer Token / Session UUID | Yes |
| `POST` | `/api/v1/wallets/me/bailout` | ขอรับชิปช่วยเหลือฉุกเฉิน 200 ชิป (เมื่อชิป < 10) | Bearer Token / Session UUID | Yes (Rate-limited 60s) |
| `POST` | `/api/v1/wallets/me/daily-claim` | กดรับชิปโบนัสล็อกอินรายวัน 500 ชิป | Bearer Token / Session UUID | Yes (1 per 24h) |
| `POST` | `/api/v1/wallets/me/reset` | รีเซ็ตกระเป๋าชิปกลับเป็น 1,000 ชิป | Bearer Token / Session UUID | No |
| `POST` | `/api/v1/game/roll` | วางเดิมพันและสั่งทอยลูกเต๋า 3 ลูก | Bearer Token / Session UUID | Yes (via Idempotency-Key) |
| `GET` | `/api/v1/game/history` | ดึงประวัติผลการออกรางวัลย้อนหลัง (Roadmap) | Bearer Token / Session UUID | Yes |
| `GET` | `/api/v1/game/stats` | ดึงข้อมูลสถิติการเล่นสะสม (Win Rate, Streak) | Bearer Token / Session UUID | Yes |

---

## 2. โครงสร้างคำขอและคำตอบ (Request & Response Contracts)

### 2.1 วางเดิมพันและทอยเต๋า: `POST /api/v1/game/roll`

#### Request Headers:
```http
POST /api/v1/game/roll HTTP/1.1
Host: api.dice-game.local
Authorization: Bearer ply_a89f41b2c7e0
Content-Type: application/json
Idempotency-Key: c9d8f3b1-4f01-447a-8f12-c28d11c76901
```

#### Request Body Schema:
```json
{
  "betChoice": "LOW",
  "betAmount": 50
}
```
- `betChoice` *(string, required)*: ต้องเป็นหนึ่งในค่า `LOW`, `HIGH`, `TRIPLE`
- `betAmount` *(integer, required)*: จำนวนชิประหว่าง `10` ถึง `500`

#### Response Body Schema (200 OK):
```json
{
  "roundId": "rnd_e7a1b490-2e4d-4b96-9812-38d5e1bfa702",
  "dice": [4, 5, 2],
  "diceTotal": 11,
  "isTriple": false,
  "betChoice": "LOW",
  "betAmount": 50,
  "outcome": "LOSS",
  "payoutMultiplier": 0.0,
  "payoutAmount": 0,
  "wallet": {
    "balanceBefore": 1000,
    "balanceAfter": 950,
    "netChange": -50
  },
  "stats": {
    "totalGames": 12,
    "winRate": 58.3,
    "currentStreak": 0,
    "maxStreak": 4
  },
  "timestamp": 1727618080000
}
```

---

### 2.2 ขอรับชิปช่วยเหลือฉุกเฉิน: `POST /api/v1/wallets/me/bailout`

#### Response Body (200 OK):
```json
{
  "success": true,
  "grantedAmount": 200,
  "newBalance": 205,
  "nextBailoutAvailableAt": 1727618140000,
  "cooldownSeconds": 60,
  "message": "เติมชิปช่วยเหลือฉุกเฉินเรียบร้อยแล้ว (+200 ชิป)"
}
```

---

## 3. รูปแบบข้อผิดพลาดมาตรฐาน (Standard Error Contract - RFC 7807)

ระบบส่งกลับข้อผิดพลาดตามมาตรฐาน **RFC 7807 (Problem Details for HTTP APIs)** เสมอ:

```json
{
  "type": "https://api.dice-game.local/errors/insufficient-balance",
  "title": "Insufficient Virtual Balance",
  "status": 400,
  "detail": "คุณมียอดชิปคงเหลือ 30 ชิป ซึ่งไม่เพียงพอสำหรับการเดิมพัน 50 ชิป",
  "instance": "/api/v1/game/roll",
  "code": "ERR_INSUFFICIENT_BALANCE",
  "timestamp": 1727618080000,
  "params": {
    "currentBalance": 30,
    "attemptedBet": 50
  }
}
```

### แคตตาล็อกรหัสข้อผิดพลาด (Error Codes):
| Status Code | Error Code | สาเหตุและคำอธิบาย |
| :--- | :--- | :--- |
| `400 Bad Request` | `ERR_INVALID_BET_AMOUNT` | จำนวนชิปไม่อยู่ในช่วง 10 ถึง 500 หรือไม่ใช่จำนวนเต็ม |
| `400 Bad Request` | `ERR_INSUFFICIENT_BALANCE` | ยอดชิปในกระเป๋าไม่พอเดิมพัน |
| `400 Bad Request` | `ERR_INVALID_BET_CHOICE` | หน้าเดิมพันไม่ใช่ LOW, HIGH, TRIPLE |
| `403 Forbidden` | `ERR_BAILOUT_NOT_ELIGIBLE` | ขอชิปฉุกเฉินขณะชิปยังเหลือ >= 10 |
| `409 Conflict` | `ERR_IDEMPOTENCY_CONFLICT` | มีคำขอด้วย Idempotency Key เดียวกันแต่ Body ไม่ตรงกัน |
| `429 Too Many Requests` | `ERR_RATE_LIMITED` | กดเรียกซ้ำเร็วเกินกำหนด (เช่น Bailout ก่อนหมด Cooldown 60s) |

---

## 4. กลไกความปลอดภัยและความสอดคล้อง (Security & Idempotency)

### 4.1 Idempotency Key Mechanism
1. ผู้เล่นส่ง `Idempotency-Key` (UUIDv4) มาใน HTTP Header ทุกครั้งที่สั่ง Roll
2. เซิร์ฟเวอร์ตรวจสอบในตาราง `game_rounds` ก่อนเริ่มสุ่ม:
   - หากพบคีย์เดิมที่ประมวลผลสำเร็จแล้ว ให้ส่งกลับผลลัพธ์รอบเดิมทันทีโดยไม่หักเงินเพิ่ม
   - หากพบคีย์เดิมที่กำลังอยู่ในสถานะประมวลผล ให้ตอบกลับ `409 Conflict`
   - หากไม่พบ ให้ดำเนินการบันทึกและประมวลผลตามปกติ

### 4.2 Rate Limiting
- `POST /api/v1/game/roll`: สูงสุด 20 requests / นาที ต่อ Session เพื่อป้องกัน Bot สแปม
- `POST /api/v1/wallets/me/bailout`: เข้มงวด 1 ครั้ง ต่อ 60 วินาที

---

## 5. เอกสาร OpenAPI 3.1 Outline (YAML Definition)

```yaml
openapi: 3.1.0
info:
  title: High-Low Casual Dice Mini-Game API
  version: 1.0.0
  description: Play-money casual dice game backend API with Provably Fair CSPRNG.
servers:
  - url: https://api.dice-game.local/api/v1
    description: Production Edge Worker
paths:
  /game/roll:
    post:
      summary: Place a bet and roll the dice
      operationId: rollDice
      parameters:
        - name: Idempotency-Key
          in: header
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [betChoice, betAmount]
              properties:
                betChoice:
                  type: string
                  enum: [LOW, HIGH, TRIPLE]
                betAmount:
                  type: integer
                  minimum: 10
                  maximum: 500
      responses:
        '200':
          description: Successful roll and payout evaluation
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/RollResult'
        '400':
          description: Validation error or insufficient balance
          content:
            application/problem+json:
              schema:
                $ref: '#/components/schemas/ProblemDetails'
components:
  schemas:
    RollResult:
      type: object
      properties:
        roundId: { type: string }
        dice: { type: array, items: { type: integer, minimum: 1, maximum: 6 }, minItems: 3, maxItems: 3 }
        diceTotal: { type: integer, minimum: 3, maximum: 18 }
        outcome: { type: string, enum: [WIN, LOSS] }
        payoutAmount: { type: integer }
    ProblemDetails:
      type: object
      properties:
        type: { type: string }
        title: { type: string }
        status: { type: integer }
        detail: { type: string }
        code: { type: string }
```

---

## 5. เติมชิปด้วยเงินจริงผ่าน Payment Gateway (PromptPay)

ส่วนนี้เป็น endpoint จริงที่ implement ใน Worker (`src/worker/index.ts`) ต่อกับ
Payment Gateway ของ **inwcloud.shop** หมวด PromptPay
(เอกสารผู้ให้บริการ: https://inwcloud.shop/payment-gateway/api-docs)

หลักการสำคัญ: **คีย์ API ของ Gateway อยู่ใน Worker เท่านั้น** (`INWCLOUD_API_KEY`)
เบราว์เซอร์ไม่เคยเห็นคีย์ จึงเรียกผ่าน endpoint ของเรา แล้วให้ Worker ไปคุยกับ Gateway อีกชั้น

| Method | Endpoint Path | Summary |
| :--- | :--- | :--- |
| `GET` | `/api/payment/config` | อ่านอัตราแลกและขอบเขตยอดเติม (ไม่ต้องใช้คีย์) |
| `POST` | `/api/payment/promptpay/create` | สร้าง QR พร้อมเพย์ตามจำนวนชิปที่ต้องการ |
| `POST` | `/api/payment/promptpay/check` | ตรวจการชำระเงิน และเติมชิปเมื่อสำเร็จ |

### 5.1 อ่านการตั้งค่า: `GET /api/payment/config`

```json
{
  "enabled": true,
  "chipsPerThb": 10,
  "minTopupThb": 20,
  "maxTopupThb": 5000
}
```

`enabled` เป็น `false` เมื่อ Worker ยังไม่ได้ตั้งค่า `INWCLOUD_API_KEY`

### 5.2 สร้าง QR: `POST /api/payment/promptpay/create`

Request Body:
```json
{ "userId": "google_creator_songpon", "chips": 500 }
```

Response (200 OK):
```json
{
  "status": "pending",
  "transactionId": "Market-1-....",
  "qrUrl": "https://api.qrserver.com/v1/create-qr-code/?data=...",
  "payload": "000201010.....",
  "amountThb": 50,
  "chips": 500,
  "expiresAt": 1764246956000
}
```

- ยอดบาทคำนวณจาก `chips / CHIPS_PER_THB` และต้องอยู่ในช่วง `MIN_TOPUP_THB`–`MAX_TOPUP_THB`
- รายการถูกบันทึกในตาราง `payment_orders` โดย `transaction_id` เป็น UNIQUE

### 5.3 ตรวจและเติมชิป: `POST /api/payment/promptpay/check`

Request Body:
```json
{ "transactionId": "Market-1-...." }
```

Response ยังไม่ชำระ (200 OK):
```json
{ "status": "pending" }
```

Response ชำระแล้ว (200 OK):
```json
{ "status": "paid", "chips": 500, "amountThb": 50, "balance": 1500 }
```

การเติมชิปเป็น **idempotent**: Worker จะ `UPDATE payment_orders SET status='paid'
WHERE transaction_id = ? AND status = 'pending'` ก่อน แล้วจึงเติมชิป
ถ้า `changes = 0` (รายการถูกเคลียร์ไปแล้ว) จะไม่เติมซ้ำ แม้ผู้ใช้กดตรวจสอบหลายครั้ง
หรือเปิดหลายแท็บพร้อมกัน — ทุกครั้งที่เติมสำเร็จจะบันทึก ledger `txn_type = 'PURCHASE'`
ลงตาราง `wallet_transactions`

### 5.4 ตัวแปรสภาพแวดล้อม (Worker)

| ตัวแปร | ค่าเริ่มต้น | ความหมาย |
| :--- | :--- | :--- |
| `INWCLOUD_API_KEY` | (ว่าง) | คีย์ลับของ Payment Gateway — ต้องตั้งก่อนใช้งาน |
| `INWCLOUD_BASE_URL` | `https://api.inwcloud.shop` | ฐาน URL ของ Gateway |
| `CHIPS_PER_THB` | `10` | กี่ชิปต่อ 1 บาท |
| `MIN_TOPUP_THB` | `20` | ยอดเติมขั้นต่ำ (บาท) |
| `MAX_TOPUP_THB` | `5000` | ยอดเติมสูงสุด (บาท) |
