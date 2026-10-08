import type { Sound } from './types';
import { bilingual } from './i18n';
import type { LocalizedText } from './i18n';
import launchUrl from '../assets/audio/launch.wav';
import reelUrl from '../assets/audio/reel.wav';
import grabUrl from '../assets/audio/grab.wav';
import goldUrl from '../assets/audio/gold.wav';
import gemUrl from '../assets/audio/gem.wav';
import rockUrl from '../assets/audio/rock.wav';
import bagUrl from '../assets/audio/bag.wav';
import explosionUrl from '../assets/audio/explosion.wav';
import winUrl from '../assets/audio/win.wav';
import buyUrl from '../assets/audio/buy.wav';

type EffectBuffers = ReadonlyMap<Sound, AudioBuffer>;
type ActiveSources = Map<AudioScheduledSourceNode, () => void>;
type Scene = 'menu' | 'game' | 'shop';

const EFFECTS = [
  ['launch', launchUrl], ['reel', reelUrl], ['grab', grabUrl],
  ['gold', goldUrl], ['gem', gemUrl], ['rock', rockUrl], ['bag', bagUrl],
  ['explosion', explosionUrl], ['win', winUrl], ['buy', buyUrl],
] as const satisfies readonly (readonly [Sound, string])[];

export class GameAudio {
  private context: AudioContext | null = null;
  private effectsGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private paused = false;
  private failed = false;
  private effectsFailed = false;
  private buffers: EffectBuffers | null = null;
  private loading: Promise<EffectBuffers> | null = null;
  private loadController: AbortController | null = null;
  private effects: ActiveSources = new Map();
  private music: ActiveSources = new Map();
  private pending = new Map<Sound, number>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private scene: Scene = 'menu';
  private step = 0;

  constructor(
    private soundEnabled: boolean,
    private musicEnabled: boolean,
    private onError: (message: LocalizedText) => void,
  ) {}

  async unlock(): Promise<void> {
    if ((!this.soundEnabled && !this.musicEnabled) || this.failed) return;
    let context = this.context;
    try {
      if (!context) {
        context = new AudioContext();
        this.context = context;
        this.effectsGain = context.createGain();
        this.effectsGain.gain.value = this.soundEnabled ? 0.55 : 0;
        this.effectsGain.connect(context.destination);
        this.musicGain = context.createGain();
        this.musicGain.gain.value = this.musicEnabled ? 0.55 : 0;
        this.musicGain.connect(context.destination);
      }
      if (context.state === 'suspended') await context.resume();
    } catch (error) {
      if (this.context !== context || this.failed) return;
      this.failed = true;
      this.loadController?.abort();
      this.stopEffects();
      this.stopMusic();
      console.warn('[Gold Miner] Audio could not be started.', error);
      this.onError(bilingual('浏览器未能启用声音，仍可继续挖矿。', 'Audio could not be started. You can still keep mining.'));
      return;
    }
    if (this.context !== context || this.failed) return;
    this.scheduleMusic();
    if (!this.soundEnabled || this.effectsFailed) return;
    try {
      if (!this.loading) {
        this.loadController = new AbortController();
        this.loading = this.loadEffects(context, this.loadController);
      }
      const buffers = await this.loading;
      if (this.context !== context) return;
      this.buffers = buffers;
      if (!this.soundEnabled || this.failed || this.effectsFailed) return;
      const pending = [...this.pending];
      this.pending.clear();
      for (const [sound, requested] of pending) {
        // Never replay a backlog of old effects after a slow download.
        if (performance.now() - requested <= 500) this.play(sound);
      }
    } catch (error) {
      if (this.context !== context || this.failed || this.effectsFailed) return;
      this.effectsFailed = true;
      this.loadController?.abort();
      this.stopEffects();
      console.warn('[Gold Miner] Sound effects could not be started.', error);
      this.onError(bilingual('浏览器未能启用音效，仍可继续挖矿。', 'Sound effects could not be started. You can still keep mining.'));
    }
  }

  private async loadEffects(context: AudioContext, controller: AbortController): Promise<EffectBuffers> {
    const timeout = setTimeout(() => controller.abort(new Error('Sound effects took too long to load.')), 10_000);
    try {
      return new Map(await Promise.all(EFFECTS.map(async ([sound, url]) => {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`Unable to load ${sound} sound: HTTP ${response.status}.`);
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        return [sound, buffer] as const;
      })));
    } finally {
      clearTimeout(timeout);
    }
  }

  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    if (this.effectsGain && this.context) this.effectsGain.gain.setTargetAtTime(enabled ? 0.55 : 0, this.context.currentTime, 0.03);
    if (enabled) void this.unlock();
    else this.stopEffects();
  }

  setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    if (this.musicGain && this.context) this.musicGain.gain.setTargetAtTime(enabled ? 0.55 : 0, this.context.currentTime, 0.03);
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

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      this.stopEffects();
      this.stopMusic();
    } else if (this.context) {
      void this.unlock();
    }
  }

  private stopEffects(): void {
    this.pending.clear();
    this.stopSources(this.effects);
  }

  private stopMusic(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.stopSources(this.music);
  }

  private stopSources(sources: ActiveSources): void {
    for (const [source, cleanup] of sources) {
      source.stop();
      cleanup();
    }
  }

  private trackSource(source: AudioScheduledSourceNode, sources: ActiveSources, envelope?: GainNode): void {
    const cleanup = () => {
      source.onended = null;
      sources.delete(source);
      source.disconnect();
      envelope?.disconnect();
    };
    sources.set(source, cleanup);
    source.onended = cleanup;
  }

  private scheduleMusic(): void {
    const context = this.context;
    if (this.timer !== null || !this.musicEnabled || this.paused || this.failed || !context || context.state !== 'running') return;
    const melody = this.scene === 'shop'
      ? [0, 4, 7, 12, 9, 7, 4, 7, 2, 5, 9, 12, 7, 5, 2, 7]
      : [0, 7, 12, 7, 4, 7, 9, 4, 2, 7, 11, 7, 2, 4, 7, -1];
    this.timer = setInterval(() => {
      if (this.context !== context || !this.musicEnabled || this.paused || context.state !== 'running') return;
      const note = melody[this.step % melody.length];
      const now = context.currentTime;
      if (note !== -1) this.tone(261.63 * 2 ** (note / 12), now, 0.2, 0.055, 'music');
      if (this.step % 4 === 0) this.tone(this.step % 8 === 0 ? 130.81 : 146.83, now, 0.28, 0.065, 'music', 'sine');
      this.step++;
    }, this.scene === 'shop' ? 270 : 310);
  }

  private tone(frequency: number, when: number, duration: number, volume: number, channel: 'effects' | 'music', type: OscillatorType = 'triangle'): void {
    const output = channel === 'music' ? this.musicGain : this.effectsGain;
    if (!this.context || !output) return;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, when);
    envelope.gain.setValueAtTime(0.001, when);
    envelope.gain.exponentialRampToValueAtTime(volume, when + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.001, when + duration);
    oscillator.connect(envelope);
    envelope.connect(output);
    this.trackSource(oscillator, channel === 'music' ? this.music : this.effects, envelope);
    oscillator.start(when);
    oscillator.stop(when + duration + 0.015);
  }

  play(sound: Sound): void {
    if (!this.soundEnabled || this.failed || this.effectsFailed || !this.context || !this.effectsGain || this.paused) return;
    if (!this.buffers || this.context.state !== 'running') {
      this.pending.set(sound, performance.now());
      return;
    }
    const now = this.context.currentTime;
    const buffer = this.buffers.get(sound === 'denied' ? 'rock' : sound === 'crush' ? 'explosion' : sound);
    if (buffer) {
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      let envelope: GainNode | undefined;
      if (sound === 'crush') {
        envelope = this.context.createGain();
        envelope.gain.setValueAtTime(0.4, now);
        envelope.gain.setValueAtTime(0.4, now + 0.2);
        envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        envelope.connect(this.effectsGain);
        source.playbackRate.value = 1.2;
      }
      source.connect(envelope ?? this.effectsGain);
      this.trackSource(source, this.effects, envelope);
      source.start(now);
      if (sound === 'crush') source.stop(now + 0.3);
      return;
    }
    switch (sound) {
      case 'tick':
        this.tone(880, now, 0.06, 0.085, 'effects');
        break;
      case 'lose':
        [392, 349.23, 293.66, 196].forEach((note, i) => this.tone(note, now + i * 0.16, 0.25, 0.13, 'effects'));
        break;
      default:
        throw new Error(`Missing sound effect: ${sound}.`);
    }
  }

  dispose(): void {
    this.stopEffects();
    this.stopMusic();
    this.loadController?.abort();
    const context = this.context;
    this.context = null;
    this.effectsGain = null;
    this.musicGain = null;
    this.buffers = null;
    this.loading = null;
    this.loadController = null;
    if (context && context.state !== 'closed') {
      void context.close().catch((error: unknown) => console.warn('[Gold Miner] Audio cleanup failed.', error));
    }
  }
}
