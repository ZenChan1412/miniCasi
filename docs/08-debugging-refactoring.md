# เอกสารการแก้จุดบกพร่องและการปรับโครงสร้างโค้ด (Debugging & Refactoring Specification)
## ระบบ: มินิเกมง่าย ๆ แนวพนันไม่ลงเงินจริง (Play-Money Casual High-Low Mini-Game)

> **มาตรฐาน:** ดำเนินการตามทักษะ **08-debugging-refactoring**  
> **อ้างอิงเอกสารเดิม:**  
> - [06-code-quality.md](06-code-quality.md)  
> - [07-testing-qa.md](07-testing-qa.md)  
> **เวอร์ชัน:** 1.0.0  
> **สถานะ:** Investigated, Minimal Fixes Implemented, Regression Verified  

---

## 1. การวินิจฉัยจุดบกพร่องและหลักฐาน (Defect Reproduction & Root Cause)

### รายการจุดบกพร่องที่ 1: Runaway Interval Sync Loop ใน Presenter Store
- **รหัสข้อผิดพลาด:** `BUG-01`
- **ไฟล์เป้าหมาย:** `src/presentation/store/useGameStore.ts:107-122`
- **การจำลองปัญหา (Reproduction):**
  1. เปิดเกมด้วยยอดเงินปกติ (1,000 ชิป) ซึ่งเงื่อนไข Bailout ไม่ทำงาน (`bailoutTimer = 0`)
  2. สังเกตการทำงานใน Browser Profiler หรือแทร็ก `console.log`
  3. พบว่าฟังก์ชัน `syncState()` ถูกเรียกซ้ำทุกๆ 1,000 มิลลิวินาที ตลอดเวลาที่เปิดหน้าจอทิ้งไว้
- **หลักฐาน (Evidence):**
  ```typescript
  // ใน useGameStore.ts เดิม:
  setBailoutTimer((prev) => {
    if (prev <= 1) {
      syncState(); // เมื่อ prev เป็น 0 เงื่อนไข prev <= 1 เป็นจริงเสมอ!
      return 0;
    }
    return prev - 1;
  });
  ```
- **สาเหตุรากเหง้า (Root Cause):** เงื่อนไข `prev <= 1` ตีความว่าค่า `0` (สถานะ Idle ที่ไม่มี Cooldown) คือการหมดเวลา จึงสั่งให้ Sync ใหม่ทุกครั้ง
- **การแก้ไขขั้นต่ำ (Minimal Fix):** ปรับเงื่อนไขให้เรียก `syncState()` เฉพาะจังหวะเปลี่ยนผ่าน `prev === 1` เท่านั้น หาก `prev <= 0` ให้คงค่าไว้เป็น 0 โดยไม่เรียกฟังก์ชันภายนอก
- **การทดสอบถดถอย (Regression Test):** จำลองเวลาและตรวจสอบว่าเมื่อ Cooldown ลดลงถึง 0 มีการสั่ง Sync เพียงครั้งเดียว และเมื่อเวลาเป็น 0 แล้วจะไม่เกิดการ Sync ซ้ำ

---

### รายการจุดบกพร่องที่ 2: สัญลักษณ์ย่อเต๋าตองและแต้มต่ำซ้ำกันในกระดานสถิติ
- **รหัสข้อผิดพลาด:** `BUG-02`
- **ไฟล์เป้าหมาย:** `src/presentation/components/HistoryRoadmap.tsx:46`
- **การจำลองปัญหา (Reproduction):**
  1. ทอยเต๋าให้ออกตอง (Triple เช่น 2-2-2)
  2. ดูที่ Roadmap ช่องล่าสุด จะพบตัวย่อ `'ต'`
  3. ทอยเต๋าให้ออกแต้มต่ำ (Low เช่น 1-2-3)
  4. ดูที่ Roadmap จะพบตัวย่อ `'ต'` เช่นเดียวกัน
- **สาเหตุรากเหง้า (Root Cause):** บรรทัดที่ 46 เขียนว่า `{isTriple ? 'ต' : isHigh ? 'ส' : 'ต'}`
- **การแก้ไขขั้นต่ำ (Minimal Fix):** เปลี่ยนตัวย่อของเต๋าตองเป็น `'ตง'` เพื่อความเด่นชัดและสื่อความหมายตรงตามภาษาไทย
- **ผลลัพธ์:** ปัญหาได้รับการแก้ไขโดยไม่กระทบต่อ Layout หรือการทำงานของส่วนอื่น

---

### รายการจุดบกพร่องที่ 3: ความน่าจะเป็นของ RNG ขาด Rejection Sampling
- **รหัสข้อผิดพลาด:** `BUG-03`
- **ไฟล์เป้าหมาย:** `src/infrastructure/rng/WebCryptoRNG.ts:10-12`
- **สาเหตุรากเหง้า (Root Cause):** การนำตัวเลข 32-บิตจำนวน $4,294,967,296$ ค่ามาหารเฉลี่ยให้เหลือ 6 หน้า ทำให้มีเศษตกค้าง 4 ค่า ($4,294,967,296 \pmod 6 = 4$) ก่อให้เกิดอคติเล็กน้อยระดับทศนิยม
- **การแก้ไขขั้นต่ำ (Minimal Fix):** ใช้วิธี **Rejection Sampling** คัดทิ้งค่าที่ $\ge 4,294,967,292$ (ซึ่งหารด้วย 6 ลงตัวพอดี) ก่อนนำมาคำนวณหน้าลูกเต๋า

---

## 2. แผนการปรับปรุงโครงสร้างโค้ดอย่างปลอดภัย (Refactoring Architecture)

1. รวมศูนย์ค่าคงที่ของระบบเกมไว้ที่ [GameRules.ts](file:///srv/http/newAPP/src/domain/constants/GameRules.ts):
   - `MIN_BET = 10`
   - `MAX_BET = 500`
   - `INITIAL_BALANCE = 1000`
   - `BAILOUT_AMOUNT = 200`
   - `BAILOUT_COOLDOWN_MS = 60 * 1000`
   - `DAILY_REWARD_AMOUNT = 500`
   - `DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000`
   - `ROLL_ANIMATION_DELAY_MS = 1100`
2. เชื่อมต่อ Entity ทั้งหมดเข้ากับค่าคงที่กลางเพื่อลดการกระจายตัวของ Magic Values
3. ยืนยันผลการทำงานเดิมด้วยชุด Automated Tests ทุกขั้นตอน
