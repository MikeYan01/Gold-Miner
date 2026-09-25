import type { Sound } from './types';

type Scene = 'menu' | 'game' | 'shop' | 'silent';

export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private scene: Scene = 'menu';
  private step = 0;
  private failed = false;

  constructor(private enabled: boolean, private onError: (message: string) => void) {}

  async unlock(): Promise<void> {
    if (!this.enabled || this.failed) return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = 0.55;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') await this.context.resume();
      this.scheduleMusic();
    } catch (error) {
      this.failed = true;
      console.warn('[Gold Miner] Audio could not be started.', error);
      this.onError('浏览器未能启用声音，仍可继续挖矿。');
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.master && this.context) this.master.gain.setTargetAtTime(enabled ? 0.55 : 0, this.context.currentTime, 0.03);
    if (enabled) void this.unlock();
    else this.stopMusic();
  }

  setScene(scene: Scene): void {
    if (this.scene === scene) return;
    this.scene = scene;
    this.step = 0;
    this.stopMusic();
    this.scheduleMusic();
  }

  private stopMusic(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private scheduleMusic(): void {
    if (this.timer || !this.enabled || !this.context || this.context.state !== 'running' || this.scene === 'silent') return;
    const melody = this.scene === 'shop'
      ? [0, 4, 7, 12, 9, 7, 4, 7, 2, 5, 9, 12, 7, 5, 2, 7]
      : [0, 7, 12, 7, 4, 7, 9, 4, 2, 7, 11, 7, 2, 4, 7, -1];
    this.timer = setInterval(() => {
      const context = this.context;
      if (!context || !this.enabled || context.state !== 'running') return;
      const note = melody[this.step % melody.length];
      const now = context.currentTime;
      if (note !== -1) this.tone(261.63 * 2 ** (note / 12), now, 0.2, 0.055, 'triangle');
      if (this.step % 4 === 0) {
        this.tone(this.step % 8 === 0 ? 130.81 : 146.83, now, 0.28, 0.065, 'sine');
      }
      this.step++;
    }, this.scene === 'shop' ? 270 : 310);
  }

  private tone(frequency: number, when: number, duration: number, volume: number, type: OscillatorType = 'sine', endFrequency?: number): void {
    if (!this.context || !this.master) return;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, when);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, when + duration);
    envelope.gain.setValueAtTime(0.001, when);
    envelope.gain.exponentialRampToValueAtTime(volume, when + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.001, when + duration);
    oscillator.connect(envelope);
    envelope.connect(this.master);
    oscillator.start(when);
    oscillator.stop(when + duration + 0.015);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
  }

  private noise(when: number): void {
    if (!this.context || !this.master) return;
    const duration = 0.48;
    const buffer = this.context.createBuffer(1, Math.ceil(this.context.sampleRate * duration), this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, when);
    filter.frequency.exponentialRampToValueAtTime(80, when + duration);
    gain.gain.setValueAtTime(0.42, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(when);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }

  play(sound: Sound): void {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    switch (sound) {
      case 'launch':
        this.tone(450, now, 0.15, 0.09, 'triangle', 120);
        this.tone(90, now, 0.07, 0.12);
        break;
      case 'reel':
        this.tone(175, now, 0.035, 0.035, 'triangle', 85);
        break;
      case 'grab':
        this.tone(460, now, 0.07, 0.1, 'square', 190);
        break;
      case 'gold':
      case 'buy':
        [783.99, 1046.5, 1318.51].forEach((note, i) => this.tone(note, now + i * 0.065, 0.17, 0.14, 'triangle'));
        break;
      case 'gem':
        [1046.5, 1318.51, 1567.98, 2093].forEach((note, i) => this.tone(note, now + i * 0.06, 0.24, 0.12));
        break;
      case 'rock':
        this.tone(160, now, 0.12, 0.17, 'triangle', 65);
        break;
      case 'bag':
        [392, 523.25, 659.25, 783.99].forEach((note, i) => this.tone(note, now + i * 0.065, 0.15, 0.12, 'triangle'));
        break;
      case 'explosion':
        this.noise(now);
        this.tone(90, now, 0.42, 0.3, 'sine', 25);
        break;
      case 'tick':
        this.tone(880, now, 0.06, 0.085, 'triangle');
        break;
      case 'win':
        [523.25, 659.25, 783.99, 1046.5].forEach((note, i) => this.tone(note, now + i * 0.105, 0.3, 0.12, 'triangle'));
        break;
      case 'lose':
        [392, 349.23, 293.66, 196].forEach((note, i) => this.tone(note, now + i * 0.16, 0.25, 0.13, 'triangle'));
        break;
      case 'denied':
        this.tone(180, now, 0.12, 0.08, 'triangle', 130);
        break;
    }
  }

  dispose(): void {
    this.stopMusic();
    const context = this.context;
    this.context = null;
    this.master = null;
    if (context && context.state !== 'closed') {
      void context.close().catch((error: unknown) => console.warn('[Gold Miner] Audio cleanup failed.', error));
    }
  }
}
