# เอกสารการทบทวนคุณภาพโค้ด (Code Quality Assessment Specification)
## ระบบ: มินิเกมง่าย ๆ แนวพนันไม่ลงเงินจริง (Play-Money Casual High-Low Mini-Game)

> **มาตรฐาน:** ดำเนินการตรวจสอบตามทักษะ **06-code-quality**  
> **อ้างอิงเอกสารเดิม:**  
> - [01-requirements.md](01-requirements.md)  
> - [02-system-design.md](02-system-design.md)  
> - [03-software-architecture.md](03-software-architecture.md)  
> **เวอร์ชัน:** 1.0.0  
> **สถานะ:** Reviewed & Prioritized for Refactoring  

---

## 1. ผลการตรวจคุณภาพโค้ดและลำดับความสำคัญ (Code Quality Findings Matrix)

| ID | มิติที่ตรวจพบ | หัวข้อปัญหา | ไฟล์ / ฟังก์ชัน | ระดับความสำคัญ (Priority) |
| :--- | :--- | :--- | :--- | :--- |
| **CQ-01** | Performance & Side Effects | วนลูป Sync State อ่าน Storage ทุก 1 วินาทีไม่สิ้นสุด | `src/presentation/store/useGameStore.ts` | **P1 - High** |
| **CQ-02** | Correctness & Usability | ตัวอักษรย่อ 'ต' ซ้ำกันระหว่าง "ต่ำ" และ "ตอง" ใน Roadmap | `src/presentation/components/HistoryRoadmap.tsx` | **P2 - Medium** |
| **CQ-03** | Modularity & Maintainability | Magic Numbers และค่าคงที่กระจายตัวข้ามไฟล์ | `src/domain/entities/*`, `useGameStore.ts` | **P2 - Medium** |
| **CQ-04** | Security & Integrity | Checksum ชิปในเครื่องใช้แฮช 32-บิตแบบง่ายและ Salt คงที่ | `src/infrastructure/storage/LocalStorageWalletRepo.ts` | **P2 - Medium** |
| **CQ-05** | Mathematical Precision | RNG สุ่มลูกเต๋าขาด Rejection Sampling | `src/infrastructure/rng/WebCryptoRNG.ts` | **P3 - Low** |

---

## 2. รายละเอียดข้อบกพร่องและแนวทางปรับปรุง (Detailed Findings & Refactoring Plan)

### Finding CQ-01: วนลูปอ่าน LocalStorage ทุกวินาที (Uncontrolled Interval Re-sync)
- **ตำแหน่ง:** `src/presentation/store/useGameStore.ts` (บรรทัดที่ 105 - 125)
- **ปัญหา:** ตัวจับเวลา `setInterval` ทำงานทุก 1,000ms เพื่อลดเวลา Cooldown แต่เมื่อ `prev <= 1` (เช่น เมื่อเวลาเป็น 0 หรือสิทธิ์ขอ Bailout/Daily ยังไม่ถึงเกณฑ์) ฟังก์ชันจะสั่ง `syncState()` ซ้ำๆ ทุกวินาที
- **ผลกระทบ:** เกิดการอ่าน `window.localStorage`, แปลง JSON, คำนวณ Checksum และกระตุ้น React State Re-render อย่างต่อเนื่องโดยไม่จำเป็น
- **แนวทางแก้ไข:** ตรวจสอบว่าเวลากำลังนับถอยหลังจริง (`prev > 1`) หรือใช้เงื่อนไขตรวจสอบสถานะ เพื่อสั่ง `syncState()` เฉพาะตอนที่เกิด State Transition (จากมี Cooldown กลายเป็นหมด Cooldown เท่านั้น)

```typescript
// ก่อนปรับปรุง (Before):
setBailoutTimer((prev) => {
  if (prev <= 1) {
    syncState(); // เรียกทุกวินาทีเมื่อ prev เป็น 0!
    return 0;
  }
  return prev - 1;
});

// หลังปรับปรุง (After):
setBailoutTimer((prev) => {
  if (prev === 1) {
    syncState(); // เรียกครั้งเดียวเมื่อครบกำหนดเวลาพอดี
    return 0;
  }
  return prev > 1 ? prev - 1 : 0;
});
```

---

### Finding CQ-02: สัญลักษณ์ย่อกำกวมในกระดานสถิติ (Ambiguous Roadmap Abbreviation)
- **ตำแหน่ง:** `src/presentation/components/HistoryRoadmap.tsx` (บรรทัดที่ 46)
- **ปัญหา:** โค้ดแสดงสัญลักษณ์ `{isTriple ? 'ต' : isHigh ? 'ส' : 'ต'}` ส่งผลให้ผล "เต๋าตอง" และ "แต้มต่ำ" ใช้ตัวอักษรย่อ `'ต'` เหมือนกันทั้งคู่
- **ผลกระทบ:** ผู้เล่นเข้าใจผิดว่าผลเต๋าตองคือแต้มต่ำ ขัดแย้งกับหลักการ Usability (NFR-03)
- **แนวทางแก้ไข:** เปลี่ยนสัญลักษณ์ของเต๋าตองให้เด่นชัดและไม่ซ้ำ เช่น ใช้ตัวย่อ `'ตง'` หรือไอคอนพิเศษ `'✦'` หรือ `'3x'`

---

### Finding CQ-03: การกระจายตัวของค่าคงที่ (Scattered Magic Values)
- **ตำแหน่ง:** 
  - `Bet.ts`: 10 (MIN_BET), 500 (MAX_BET)
  - `VirtualWallet.ts`: 1000 (INITIAL), 200 (BAILOUT), 60000ms (COOLDOWN)
  - `useGameStore.ts`: 1100ms (Animation Delay)
- **ปัญหา:** ค่าคอนฟิกของระบบเกมกระจัดกระจายอยู่ในหลาย Entity และ Presenter
- **แนวทางแก้ไข:** สกัด (Extract) ค่าคงที่ทั้งหมดมาไว้ในโมดูลเดียวที่ `src/domain/constants/GameRules.ts` เพื่อให้ปรับจูนตัวเลขเศรษฐกิจของเกมได้จากจุดเดียว (Single Source of Truth)

---

### Finding CQ-04: ความสมบูรณ์ของระบบตรวจสอบการโกง (Storage Checksum Integrity)
- **ตำแหน่ง:** `src/infrastructure/storage/LocalStorageWalletRepo.ts`
- **ปัญหา:** ใช้อัลกอริทึม Bitwise Polynomial Hash 32-bit แบบธรรมดา และฝัง Salt เป็น Plaintext ในซอร์สโค้ด
- **ผลกระทบ:** ผู้ใช้งานสามารถเปิด Console และเขียนฟังก์ชันปลอมแปลง Checksum เพื่อปั๊มชิปได้ง่ายดาย
- **แนวทางแก้ไข:** ยกระดับไปใช้ Web Cryptography API (`crypto.subtle.digest('SHA-256', ...)`) ร่วมกับ Device Fingerprint / UUID ที่สร้างขึ้นต่อ Client

---

### Finding CQ-05: ความเป็นธรรมของการสุ่ม (Uniform CSPRNG & Zero Modulo Bias)
- **ตำแหน่ง:** `src/infrastructure/rng/WebCryptoRNG.ts`
- **ปัญหา:** `array[0] / (0xffffffff + 1)` นำมาคูณ 6 แล้วปัดเศษ แม้ความคลาดเคลื่อนจะน้อยมากระดับ $10^{-9}$ แต่ตามหลักสถิติของเกมลูกเต๋าระดับมาตรฐาน ควรใช้ **Rejection Sampling** (คัดค่าที่เกิน $4,294,967,292$ ออกก่อนหาเศษส่วน)
- **แนวทางแก้ไข:** ปรับปรุงให้อัลกอริทึม Rejection Sampling ปฏิเสธค่าส่วนเกิน เพื่อให้ความน่าจะเป็นของหน้าเต๋า 1-6 มีค่าเท่ากัน $1/6$ อย่างสมบูรณ์แบบ $100\%$

---

## 3. สรุปมาตรการดำเนินงานปรับปรุงโค้ด (Refactoring Action Plan)

1. [x] จัดทำเอกสารทบทวนคุณภาพโค้ดตาม Skill 06
2. [ ] สร้างโมดูล `src/domain/constants/GameRules.ts` และเชื่อมโยง Entity เข้ากับค่าคงที่
3. [ ] แก้ไข Logic `setInterval` ใน `useGameStore.ts` เพื่อตัดการเรียก `syncState()` ที่เปลืองทรัพยากร
4. [ ] ปรับปรุงการแสดงผลสัญลักษณ์ Roadmap ใน `HistoryRoadmap.tsx` ให้แยกความแตกต่างระหว่าง "ตอง" และ "ต่ำ" ได้ชัดเจน
5. [ ] ปรับปรุง `WebCryptoRNG.ts` ให้ใช้ Rejection Sampling ที่สมบูรณ์แบบ
