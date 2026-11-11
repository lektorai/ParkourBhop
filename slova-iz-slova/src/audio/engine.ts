/**
 * Звук и музыка на Web Audio API. Все звуки синтезируются кодом — внешних файлов нет.
 * Контекст создаётся по первому касанию; при потере фокуса, паузе SDK и рекламе всё затихает.
 */
export type Sfx = 'tap' | 'untap' | 'success' | 'error' | 'bonus' | 'star' | 'win' | 'shuffle' | 'coin';

type AudioContextCtor = typeof AudioContext;

interface Tone {
  freq: number;
  /** Задержка от начала звука, с. */
  at?: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  /** Конечная частота для скольжения. */
  slideTo?: number;
}

const SFX: Record<Sfx, Tone[]> = {
  tap: [{ freq: 660, slideTo: 380, duration: 0.07, type: 'triangle', gain: 0.22 }],
  untap: [{ freq: 420, slideTo: 300, duration: 0.06, type: 'triangle', gain: 0.16 }],
  success: [
    { freq: 523.25, duration: 0.14, type: 'triangle', gain: 0.2 },
    { freq: 659.25, at: 0.08, duration: 0.14, type: 'triangle', gain: 0.2 },
    { freq: 783.99, at: 0.16, duration: 0.24, type: 'triangle', gain: 0.22 },
  ],
  error: [
    { freq: 196, duration: 0.12, type: 'sine', gain: 0.2 },
    { freq: 164.81, at: 0.1, duration: 0.18, type: 'sine', gain: 0.2 },
  ],
  bonus: [
    { freq: 1046.5, duration: 0.09, type: 'sine', gain: 0.16 },
    { freq: 1567.98, at: 0.07, duration: 0.16, type: 'sine', gain: 0.16 },
  ],
  star: [
    { freq: 880, duration: 0.5, type: 'sine', gain: 0.16 },
    { freq: 1318.51, at: 0.06, duration: 0.6, type: 'sine', gain: 0.12 },
    { freq: 1760, at: 0.12, duration: 0.7, type: 'sine', gain: 0.08 },
  ],
  win: [
    { freq: 523.25, duration: 0.16, type: 'triangle', gain: 0.2 },
    { freq: 659.25, at: 0.13, duration: 0.16, type: 'triangle', gain: 0.2 },
    { freq: 783.99, at: 0.26, duration: 0.16, type: 'triangle', gain: 0.2 },
    { freq: 1046.5, at: 0.39, duration: 0.6, type: 'triangle', gain: 0.22 },
    { freq: 659.25, at: 0.39, duration: 0.6, type: 'sine', gain: 0.12 },
    { freq: 783.99, at: 0.39, duration: 0.6, type: 'sine', gain: 0.12 },
  ],
  shuffle: [
    { freq: 300, slideTo: 520, duration: 0.09, type: 'triangle', gain: 0.12 },
    { freq: 360, slideTo: 600, at: 0.06, duration: 0.09, type: 'triangle', gain: 0.12 },
    { freq: 420, slideTo: 680, at: 0.12, duration: 0.1, type: 'triangle', gain: 0.12 },
  ],
  coin: [
    { freq: 1318.51, duration: 0.08, type: 'square', gain: 0.07 },
    { freq: 1975.53, at: 0.07, duration: 0.3, type: 'square', gain: 0.07 },
  ],
};

/** Спокойная фоновая мелодия: четыре аккорда, мягкие «подушки» и редкие ноты пентатоники. */
const CHORDS: number[][] = [
  [261.63, 329.63, 392.0], // C
  [220.0, 261.63, 329.63], // Am
  [174.61, 220.0, 261.63], // F
  [196.0, 246.94, 293.66], // G
];
const MELODY = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
const BAR_SECONDS = 4;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private soundEnabled = true;
  private musicEnabled = true;
  private suspendReasons = new Set<string>();
  private musicTimer: number | null = null;
  private nextBarAt = 0;
  private bar = 0;
  private seed = 7;

  /** Создаёт аудиоконтекст. Вызывать из обработчика первого касания или нажатия клавиши. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && this.suspendReasons.size === 0) void this.ctx.resume().catch(() => undefined);
      return;
    }
    const Ctor: AudioContextCtor | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
    } catch {
      return;
    }
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicEnabled ? 1 : 0;
    this.musicGain.connect(this.ctx.destination);
    this.applySuspension();
    this.startMusic();
  }

  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
  }

  setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    if (this.ctx && this.musicGain) {
      this.musicGain.gain.setTargetAtTime(enabled ? 1 : 0, this.ctx.currentTime, 0.15);
    }
    if (enabled) this.startMusic();
  }

  /**
   * Приостанавливает или возобновляет весь звук. Причин может быть несколько сразу
   * (вкладка скрыта, идёт реклама, пауза SDK) — звук вернётся, когда уйдут все.
   */
  setSuspended(reason: string, suspended: boolean): void {
    if (suspended) this.suspendReasons.add(reason);
    else this.suspendReasons.delete(reason);
    this.applySuspension();
  }

  get isSuspended(): boolean {
    return this.suspendReasons.size > 0;
  }

  private applySuspension(): void {
    if (!this.ctx) return;
    if (this.suspendReasons.size > 0) {
      if (this.ctx.state === 'running') void this.ctx.suspend().catch(() => undefined);
    } else if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => undefined);
    }
  }

  play(name: Sfx): void {
    if (!this.soundEnabled || !this.ctx || !this.sfxGain || this.isSuspended) return;
    const start = this.ctx.currentTime + 0.005;
    for (const tone of SFX[name]) this.tone(tone, start, this.sfxGain);
  }

  private tone(tone: Tone, start: number, output: AudioNode, attack = 0.005): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const at = start + (tone.at ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = tone.type ?? 'sine';
    osc.frequency.setValueAtTime(tone.freq, at);
    if (tone.slideTo) osc.frequency.exponentialRampToValueAtTime(tone.slideTo, at + tone.duration);
    const peak = tone.gain ?? 0.2;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + tone.duration);
    osc.connect(gain);
    gain.connect(output);
    osc.start(at);
    osc.stop(at + tone.duration + 0.05);
  }

  private random(): number {
    // Детерминированный генератор: мелодия не повторяется слишком явно, но и не «скачет».
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  private startMusic(): void {
    if (!this.ctx || this.musicTimer !== null) return;
    this.nextBarAt = this.ctx.currentTime + 0.3;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 500);
  }

  private scheduleMusic(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain || !this.musicEnabled || ctx.state !== 'running') return;
    // После долгой паузы не доигрываем пропущенные такты.
    if (this.nextBarAt < ctx.currentTime) this.nextBarAt = ctx.currentTime + 0.1;
    while (this.nextBarAt < ctx.currentTime + 1.5) {
      const chord = CHORDS[this.bar % CHORDS.length]!;
      for (const freq of chord) {
        this.tone({ freq: freq / 2, duration: BAR_SECONDS * 1.05, type: 'sine', gain: 0.035 }, this.nextBarAt, this.musicGain, 0.9);
      }
      for (let beat = 0; beat < 4; beat++) {
        if (this.random() < 0.55) {
          const freq = MELODY[Math.floor(this.random() * MELODY.length)]!;
          this.tone(
            { freq, duration: 1.4, type: 'triangle', gain: 0.022 },
            this.nextBarAt + beat * (BAR_SECONDS / 4) + (this.random() < 0.3 ? BAR_SECONDS / 8 : 0),
            this.musicGain,
            0.02,
          );
        }
      }
      this.nextBarAt += BAR_SECONDS;
      this.bar++;
    }
  }
}
