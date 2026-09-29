import { IRandomGenerator } from '../../domain/ports/IRandomGenerator';

export class WebCryptoRNG implements IRandomGenerator {
  // ค่าตัวคูณสูงสุดของ 6 ภายในช่วง 32-บิต เพื่อทำ Rejection Sampling กำจัด Modulo Bias:
  // 4294967296 - (4294967296 % 6) = 4294967292
  private static readonly MAX_UNBIASED_LIMIT = 4294967292;

  public rollSingleDie(): number {
    const cryptoObj = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;

    if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
      const array = new Uint32Array(1);
      while (true) {
        cryptoObj.getRandomValues(array);
        const val = array[0];
        // กำจัดค่าตกค้าง 4 ค่า เพื่อความน่าจะเป็นสมบูรณ์แบบ 1/6 ทุกหน้า (Zero Bias)
        if (val < WebCryptoRNG.MAX_UNBIASED_LIMIT) {
          return (val % 6) + 1;
        }
      }
    }

    // Fallback เมื่อรันในสภาพแวดล้อมจำกัด
    return Math.floor(Math.random() * 6) + 1;
  }

  public rollDiceHand(): [number, number, number] {
    return [
      this.rollSingleDie(),
      this.rollSingleDie(),
      this.rollSingleDie(),
    ];
  }
}
