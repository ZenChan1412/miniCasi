import { IRandomGenerator } from '../../domain/ports/IRandomGenerator';

export class WebCryptoRNG implements IRandomGenerator {
  public rollSingleDie(): number {
    // ใช้งาน Web Cryptography API (CSPRNG) ที่เป็นมาตรฐานสากล ทั้งบน Browser, Bun, Node และ Cloudflare
    const array = new Uint32Array(1);
    const cryptoObj = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;

    if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
      cryptoObj.getRandomValues(array);
      const randomFraction = array[0] / (0xffffffff + 1);
      return Math.floor(randomFraction * 6) + 1;
    }

    // Fallback ปลอดภัย
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
