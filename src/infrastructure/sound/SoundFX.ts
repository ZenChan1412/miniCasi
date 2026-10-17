class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  // เพลงพื้นหลัง: สังเคราะห์เองด้วย Web Audio (แจ๊สลาวจ์ 4 คอร์ดวนซ้ำ) ไม่มีไฟล์เสียง/ลิขสิทธิ์
  private musicGain: GainNode | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private musicStep = 0;
  private musicNextTime = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('high_low_muted');
      this.isMuted = saved === 'true';
    }
  }

  private initCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('high_low_muted', this.isMuted.toString());
    }
    if (this.isMuted) this.stopMusic();
    else this.startMusic();
    return this.isMuted;
  }

  public isMusicPlaying(): boolean {
    return this.musicTimer !== null;
  }

  // ท่อนเพลง 1 รอบ = 4 ห้อง x 8 จังหวะย่อย (ฟีลสวิง): Cmaj7 - Am7 - Dm7 - G7
  private static readonly BASS = [65.41, 55, 73.42, 49]; // C2, A1, D2, G1
  private static readonly CHORDS = [
    [329.63, 392, 493.88], // Cmaj7: E4 G4 B4
    [329.63, 392, 523.25], // Am7: E4 G4 C5
    [349.23, 440, 523.25], // Dm7: F4 A4 C5
    [349.23, 392, 493.88], // G7: F4 G4 B4
  ];
  private static readonly MELODY = [
    [659.25, 0, 783.99, 0, 880, 783.99, 0, 659.25],
    [523.25, 0, 659.25, 0, 783.99, 0, 659.25, 0],
    [587.33, 0, 698.46, 0, 880, 698.46, 0, 587.33],
    [493.88, 587.33, 0, 698.46, 783.99, 0, 587.33, 0],
  ];

  private note(freq: number, t: number, dur: number, type: OscillatorType, vol: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // เสียงเครื่องเป่า (ทรัมเป็ต/แซ็กโซโฟน): ซอว์ทูธ 2 ตัวเพี้ยนเล็กน้อย ผ่าน lowpass ที่เปิดกว้างขึ้นตอนเป่าเข้า
  // พร้อม vibrato เบาๆ ให้ฟังเป็นเสียงลมมากกว่าเสียงสังเคราะห์
  private brass(freq: number, t: number, dur: number, vol: number, bright = 2600): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    filter.type = 'lowpass';
    filter.Q.value = 3;
    filter.frequency.setValueAtTime(bright * 0.25, t);
    filter.frequency.exponentialRampToValueAtTime(bright, t + 0.06);
    filter.frequency.exponentialRampToValueAtTime(bright * 0.5, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.04);
    gain.gain.setValueAtTime(vol, t + Math.max(0.05, dur - 0.08));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    filter.connect(gain);
    gain.connect(this.musicGain);

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 5.5;
    lfoGain.gain.setValueAtTime(0, t);
    lfoGain.gain.linearRampToValueAtTime(freq * 0.012, t + 0.25);
    lfo.connect(lfoGain);

    [-6, 6].forEach((detune) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      osc.detune.value = detune;
      lfoGain.connect(osc.frequency);
      osc.connect(filter);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    });
    lfo.start(t);
    lfo.stop(t + dur + 0.02);
  }

  private scheduleMusicStep(step: number, t: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    const bar = Math.floor(step / 8) % 4;
    const beat = step % 8;
    const eighth = 0.25; // ~120 BPM (ตัวละ 0.25 วินาที)

    // เบสเดิน: จังหวะ 0, 2, 4, 6
    if (beat % 2 === 0) {
      const root = SoundSynthesizer.BASS[bar];
      const f = beat === 6 ? root * 1.5 : root;
      this.note(f, t, eighth * 1.8, 'triangle', 0.5);
    }
    // วงเป่าเล่นคอร์ดสั้นๆ ตอนจังหวะ 3 กับ 7 (ออฟบีต)
    if (beat === 3 || beat === 7) {
      SoundSynthesizer.CHORDS[bar].forEach((f) => this.brass(f / 2, t, eighth * 1.3, 0.07, 1800));
    }
    // ทำนองนำเป็นแซ็กโซโฟน/ทรัมเป็ต
    const m = SoundSynthesizer.MELODY[bar][beat];
    if (m) this.brass(m, t, eighth * 2.2, 0.16);
    // ไฮแฮท: สวิงเล็กน้อย
    if (beat % 2 === 1) {
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.04), ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = ctx.createBufferSource();
      const hp = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      hp.type = 'highpass';
      hp.frequency.value = 7000;
      gain.gain.value = 0.12;
      src.buffer = buf;
      src.connect(hp);
      hp.connect(gain);
      gain.connect(this.musicGain);
      src.start(t);
    }
  }

  public startMusic(): void {
    if (this.isMuted || this.musicTimer) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    this.musicGain = ctx.createGain();
    this.musicGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.musicGain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.15);
    this.musicGain.connect(ctx.destination);

    this.musicStep = 0;
    this.musicNextTime = ctx.currentTime + 0.02;
    // scheduler แบบ lookahead: จองโน้ตล่วงหน้า 0.6 วินาที เพื่อไม่ให้จังหวะสะดุดตอนหน้าเว็บทำงานหนัก
    const tick = () => {
      while (this.musicNextTime < ctx.currentTime + 0.6) {
        const swing = this.musicStep % 2 === 1 ? 0.04 : 0;
        this.scheduleMusicStep(this.musicStep, this.musicNextTime + swing);
        this.musicNextTime += 0.25;
        this.musicStep = (this.musicStep + 1) % 32;
      }
    };
    tick(); // จองโน้ตชุดแรกทันที ไม่รอรอบ interval
    this.musicTimer = setInterval(tick, 150);
  }

  public stopMusic(): void {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    const ctx = this.ctx;
    const g = this.musicGain;
    this.musicGain = null;
    if (ctx && g) {
      g.gain.cancelScheduledValues(ctx.currentTime);
      g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      setTimeout(() => g.disconnect(), 400);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // เสียงคลิกเลือกชิป
  public playChipClick(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  }

  // เสียงเขย่า/ทอยเต๋า
  public playDiceRoll(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    // จำลองเสียงกระทบของลูกเต๋า 4 ครั้งต่อเนื่อง
    [0, 0.15, 0.35, 0.55].forEach((delay, idx) => {
      setTimeout(() => {
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        const freq = 180 + Math.random() * 80;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.12 - idx * 0.02, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      }, delay * 1000);
    });
  }

  // เสียงลูกเต๋าตกกระทบโต๊ะ (Landing Impact)
  public playDiceLand(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    // Deep wood/felt thud
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.22, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  }

  // เสียงชนะปกติ (Win)
  public playWin(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);

      gain.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + i * 0.08 + 0.3);
    });
  }

  // เสียงชนะตอง (Big Win / Jackpot 30x)
  public playBigWin(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98]; // C5 to G6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.09);

      gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.09 + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.09);
      osc.stop(ctx.currentTime + i * 0.09 + 0.4);
    });
  }

  // เสียงแพ้ (Lose)
  public playLose(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  }

  // เสียงเติมชิป Bailout / Daily
  public playRefill(): void {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;

    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.07);

      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.07 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.07);
      osc.stop(ctx.currentTime + i * 0.07 + 0.35);
    });
  }
}

export const soundFX = new SoundSynthesizer();
