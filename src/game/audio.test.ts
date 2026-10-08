import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameAudio } from './audio';
import type { Sound } from './types';

function parameter() {
  return {
    value: 0,
    setValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
}

class Source {
  buffer: { url: string } | null = null;
  playbackRate = { ...parameter(), value: 1 };
  onended: (() => void) | null = null;
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class Oscillator extends Source {
  frequency = parameter();
  type: OscillatorType = 'sine';
}

const contexts: TestAudioContext[] = [];

class TestAudioContext {
  state = 'suspended';
  currentTime = 1;
  destination = {};
  sources: Source[] = [];
  resume = vi.fn(async () => { this.state = 'running'; });
  close = vi.fn(async () => { this.state = 'closed'; });
  createGain = vi.fn(() => ({ gain: parameter(), connect: vi.fn(), disconnect: vi.fn() }));
  createOscillator = vi.fn(() => new Oscillator());
  createBufferSource = vi.fn(() => {
    const source = new Source();
    this.sources.push(source);
    return source;
  });
  decodeAudioData = vi.fn(async (data: ArrayBuffer) => ({ url: new TextDecoder().decode(data) }));

  constructor() { contexts.push(this); }
}

const fetchSound = vi.fn(async (url: string, _init?: RequestInit) => new Response(url));
const onError = vi.fn();
let audio: GameAudio;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance'] });
  contexts.length = 0;
  fetchSound.mockReset().mockImplementation(async (url) => new Response(url));
  onError.mockReset();
  vi.stubGlobal('AudioContext', TestAudioContext);
  vi.stubGlobal('fetch', fetchSound);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  audio = new GameAudio(true, false, onError);
});

afterEach(() => {
  audio.dispose();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('does not create audio or download effects until an enabled interaction', async () => {
  audio.setSoundEnabled(false);
  await audio.unlock();
  audio.play('launch');
  expect(contexts).toHaveLength(0);
  expect(fetchSound).not.toHaveBeenCalled();
});

it('shares loading between concurrent unlocks and caches decoded effects across mute toggles', async () => {
  await Promise.all([audio.unlock(), audio.unlock()]);
  expect(contexts).toHaveLength(1);
  expect(fetchSound).toHaveBeenCalledTimes(10);
  expect(contexts[0].decodeAudioData).toHaveBeenCalledTimes(10);
  audio.setSoundEnabled(false);
  audio.setSoundEnabled(true);
  await audio.unlock();
  expect(fetchSound).toHaveBeenCalledTimes(10);
  expect(onError).not.toHaveBeenCalled();
});

it('plays every mapped event from a decoded sample, reusing the original rejection sound', async () => {
  await audio.unlock();
  const sounds: Sound[] = ['launch', 'reel', 'grab', 'gold', 'gem', 'rock', 'bag', 'explosion', 'win', 'buy', 'denied'];
  sounds.forEach((sound) => audio.play(sound));
  const context = contexts[0];
  expect(context.sources).toHaveLength(sounds.length);
  context.sources.forEach((source, index) => {
    expect(source.buffer?.url).toContain(`/${sounds[index] === 'denied' ? 'rock' : sounds[index]}.wav`);
    expect(source.connect).toHaveBeenCalledWith(context.createGain.mock.results[0].value);
    expect(source.start).toHaveBeenCalledWith(context.currentTime);
  });
  expect(context.createOscillator).not.toHaveBeenCalled();
  context.sources[0].onended?.();
  expect(context.sources[0].disconnect).toHaveBeenCalledOnce();
  audio.dispose();
  expect(context.sources[0].stop).not.toHaveBeenCalled();
});

it('reuses the explosion buffer for a quieter, faster, short crush without changing real explosions', async () => {
  await audio.unlock();
  audio.play('crush');
  audio.play('explosion');
  const context = contexts[0];
  const [crush, explosion] = context.sources;
  const envelope = context.createGain.mock.results[2].value;
  const effectsGain = context.createGain.mock.results[0].value;
  expect(crush.buffer).toBe(explosion.buffer);
  expect(crush.buffer?.url).toContain('/explosion.wav');
  expect(crush.playbackRate.value).toBe(1.2);
  expect(envelope.gain.setValueAtTime).toHaveBeenCalledWith(0.4, 1);
  expect(envelope.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.001, 1.28);
  expect(crush.connect).toHaveBeenCalledWith(envelope);
  expect(envelope.connect).toHaveBeenCalledWith(effectsGain);
  expect(crush.start).toHaveBeenCalledWith(1);
  expect(crush.stop).toHaveBeenCalledWith(1.3);
  expect(explosion.connect).toHaveBeenCalledWith(effectsGain);
  expect(explosion.playbackRate.value).toBe(1);
  expect(explosion.playbackRate.setValueAtTime).not.toHaveBeenCalled();
  expect(explosion.stop).not.toHaveBeenCalled();
  expect(fetchSound).toHaveBeenCalledTimes(10);
  audio.setSoundEnabled(false);
  expect(crush.stop).toHaveBeenCalledTimes(2);
  expect(envelope.disconnect).toHaveBeenCalledOnce();
  audio.play('crush');
  expect(context.sources).toHaveLength(2);
});

it('preserves the synthesized countdown and loss prompt with music disabled', async () => {
  await audio.unlock();
  audio.play('tick');
  audio.play('lose');
  const context = contexts[0];
  expect(context.sources).toHaveLength(0);
  expect(context.createOscillator).toHaveBeenCalledTimes(5);
  expect(context.createOscillator.mock.results[0].value.frequency.setValueAtTime).toHaveBeenCalledWith(880, 1);
  await vi.advanceTimersByTimeAsync(620);
  expect(context.createOscillator).toHaveBeenCalledTimes(5);
  audio.setSoundEnabled(false);
  await vi.advanceTimersByTimeAsync(1000);
  expect(context.createOscillator).toHaveBeenCalledTimes(5);
});

it('keeps disabled background music silent after unlocking or resuming', async () => {
  await audio.unlock();
  for (const paused of [false, true, false]) {
    audio.setPaused(paused);
    await vi.advanceTimersByTimeAsync(1000);
  }
  expect(contexts[0].createOscillator).not.toHaveBeenCalled();
  expect(contexts[0].sources).toHaveLength(0);
  expect(vi.getTimerCount()).toBe(0);
});

it('plays fresh events after initial loading without duplicating repeated reel events', async () => {
  const starting = audio.unlock();
  audio.play('launch');
  audio.play('reel');
  audio.play('reel');
  await starting;
  expect(contexts[0].sources.map((source) => source.buffer?.url.split('/').at(-1))).toEqual(['launch.wav', 'reel.wav']);
});

it('drops stale effects instead of replaying a backlog after a slow download', async () => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  fetchSound.mockImplementation(async (url) => {
    await gate;
    return new Response(url);
  });
  const starting = audio.unlock();
  audio.play('launch');
  audio.play('reel');
  await vi.advanceTimersByTimeAsync(450);
  audio.play('reel');
  await vi.advanceTimersByTimeAsync(100);
  release();
  await starting;
  expect(contexts[0].sources).toHaveLength(1);
  expect(contexts[0].sources[0].buffer?.url).toContain('/reel.wav');
});

for (const action of ['mute', 'pause', 'dispose'] as const) {
  it(`${action} stops active samples and discards pending playback`, async () => {
    await audio.unlock();
    audio.play('win');
    const context = contexts[0];
    context.state = 'suspended';
    audio.play('launch');
    if (action === 'mute') audio.setSoundEnabled(false);
    else if (action === 'pause') audio.setPaused(true);
    else audio.dispose();
    expect(context.sources[0].stop).toHaveBeenCalledOnce();
    expect(context.sources[0].disconnect).toHaveBeenCalledOnce();
    context.state = 'running';
    audio.play('explosion');
    expect(context.sources).toHaveLength(1);
    if (action === 'mute') audio.setSoundEnabled(true);
    else if (action === 'pause') audio.setPaused(false);
    if (action !== 'dispose') {
      await audio.unlock();
      expect(context.sources).toHaveLength(1);
    }
  });
}

it('does not cut off the completion fanfare when the next unpaused screen is shown', async () => {
  audio.setPaused(false);
  await audio.unlock();
  audio.play('win');
  audio.setScene('shop');
  audio.setPaused(false);
  expect(contexts[0].sources[0].stop).not.toHaveBeenCalled();
});

it('ignores a disposed load and can start a fresh context without resurrecting old sounds', async () => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  fetchSound.mockImplementation(async (url) => {
    await gate;
    return new Response(url);
  });
  const starting = audio.unlock();
  await Promise.resolve();
  audio.play('launch');
  const signal = fetchSound.mock.calls[0][1]?.signal;
  audio.dispose();
  expect(signal?.aborted).toBe(true);
  release();
  await starting;
  expect(contexts[0].sources).toHaveLength(0);
  expect(onError).not.toHaveBeenCalled();
  await audio.unlock();
  audio.play('gold');
  expect(contexts).toHaveLength(2);
  expect(contexts[1].sources[0].buffer?.url).toContain('/gold.wav');
});

for (const failure of ['request', 'decode', 'context'] as const) {
  it(`reports ${failure} failures once and never silently substitutes synthetic effects`, async () => {
    if (failure === 'request') fetchSound.mockResolvedValue(new Response('', { status: 404 }));
    if (failure === 'decode') {
      vi.stubGlobal('AudioContext', class extends TestAudioContext {
        decodeAudioData = vi.fn(async (): Promise<{ url: string }> => { throw new Error('Invalid WAV'); });
      });
    }
    if (failure === 'context') {
      vi.stubGlobal('AudioContext', class { constructor() { throw new Error('Audio blocked'); } });
    }
    await Promise.all([audio.unlock(), audio.unlock()]);
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0]).toEqual(failure === 'context'
      ? { 'zh-CN': '浏览器未能启用声音，仍可继续挖矿。', en: 'Audio could not be started. You can still keep mining.' }
      : { 'zh-CN': '浏览器未能启用音效，仍可继续挖矿。', en: 'Sound effects could not be started. You can still keep mining.' });
    expect(console.warn).toHaveBeenCalledOnce();
    audio.play('explosion');
    audio.setPaused(false);
    await vi.advanceTimersByTimeAsync(1000);
    if (contexts[0]) {
      expect(contexts[0].sources).toHaveLength(0);
      expect(contexts[0].createOscillator).not.toHaveBeenCalled();
    }
  });
}

it('aborts a stalled download and surfaces the failure', async () => {
  fetchSound.mockImplementation((_url, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
  }));
  const starting = audio.unlock();
  await vi.advanceTimersByTimeAsync(10_000);
  await starting;
  expect(fetchSound.mock.calls.every(([, init]) => init?.signal?.aborted)).toBe(true);
  expect(onError).toHaveBeenCalledOnce();
});

describe('independent background music and effects', () => {
  it.each([
    [true, true], [true, false], [false, true], [false, false],
  ])('respects sound=%s and music=%s without loading disabled effects', async (sound, music) => {
    audio = new GameAudio(sound, music, onError);
    audio.setScene('game');
    audio.setPaused(false);
    expect(contexts).toHaveLength(0);
    await audio.unlock();
    audio.play('launch');
    await vi.advanceTimersByTimeAsync(310);
    expect(fetchSound).toHaveBeenCalledTimes(sound ? 10 : 0);
    if (!sound && !music) {
      expect(contexts).toHaveLength(0);
      expect(vi.getTimerCount()).toBe(0);
      return;
    }
    const context = contexts[0];
    expect(context.sources).toHaveLength(sound ? 1 : 0);
    expect(context.createOscillator).toHaveBeenCalledTimes(music ? 2 : 0);
    const musicGain = context.createGain.mock.results[1].value;
    if (music) {
      expect(context.createGain.mock.results[2].value.connect).toHaveBeenCalledWith(musicGain);
      expect(context.createGain.mock.results[3].value.connect).toHaveBeenCalledWith(musicGain);
    }
  });

  it('restores the original mine and shop melodies at their separate tempos', async () => {
    audio = new GameAudio(false, true, onError);
    audio.setScene('game');
    await audio.unlock();
    const context = contexts[0];
    await vi.advanceTimersByTimeAsync(309);
    expect(context.createOscillator).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(context.createOscillator.mock.results[0].value.frequency.setValueAtTime).toHaveBeenCalledWith(261.63, 1);
    expect(context.createOscillator.mock.results[1].value.frequency.setValueAtTime).toHaveBeenCalledWith(130.81, 1);
    expect(context.createOscillator.mock.results[1].value.type).toBe('sine');
    await vi.advanceTimersByTimeAsync(310);
    expect(context.createOscillator.mock.results[2].value.frequency.setValueAtTime).toHaveBeenCalledWith(261.63 * 2 ** (7 / 12), 1);
    audio.setScene('shop');
    await vi.advanceTimersByTimeAsync(269);
    expect(context.createOscillator).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(context.createOscillator).toHaveBeenCalledTimes(5);
    await vi.advanceTimersByTimeAsync(270);
    expect(context.createOscillator.mock.results[5].value.frequency.setValueAtTime).toHaveBeenCalledWith(261.63 * 2 ** (4 / 12), 1);
    expect(fetchSound).not.toHaveBeenCalled();
  });

  it('muting effects stops samples and synthesized prompts without stopping music', async () => {
    audio = new GameAudio(true, true, onError);
    await audio.unlock();
    await vi.advanceTimersByTimeAsync(310);
    const context = contexts[0];
    const melody = context.createOscillator.mock.results[0].value;
    audio.play('win');
    audio.play('tick');
    const tick = context.createOscillator.mock.results[2].value;
    audio.setSoundEnabled(false);
    expect(context.sources[0].stop).toHaveBeenCalledOnce();
    expect(tick.stop).toHaveBeenCalledTimes(2);
    expect(tick.disconnect).toHaveBeenCalledOnce();
    expect(melody.stop).toHaveBeenCalledOnce();
    expect(melody.disconnect).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(310);
    expect(context.createOscillator).toHaveBeenCalledTimes(4);
    audio.play('gold');
    expect(context.sources).toHaveLength(1);
  });

  it('muting music stops its notes and timer without cutting off effects or reloading samples', async () => {
    audio = new GameAudio(true, true, onError);
    await audio.unlock();
    audio.play('win');
    await vi.advanceTimersByTimeAsync(310);
    const context = contexts[0];
    const note = context.createOscillator.mock.results[0].value;
    audio.setMusicEnabled(false);
    expect(note.stop).toHaveBeenCalledTimes(2);
    expect(note.disconnect).toHaveBeenCalledOnce();
    expect(context.createGain.mock.results[2].value.disconnect).toHaveBeenCalledOnce();
    expect(context.sources[0].stop).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    audio.play('gold');
    expect(context.sources).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1000);
    expect(context.createOscillator).toHaveBeenCalledTimes(2);
    audio.setMusicEnabled(true);
    await audio.unlock();
    await vi.advanceTimersByTimeAsync(310);
    expect(context.createOscillator.mock.calls.length).toBeGreaterThan(2);
    expect(fetchSound).toHaveBeenCalledTimes(10);
  });

  it('plays music during slow effects loading and never replays events muted during that load', async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    fetchSound.mockImplementation(async (url) => {
      await gate;
      return new Response(url);
    });
    audio = new GameAudio(true, true, onError);
    const starting = audio.unlock();
    audio.play('launch');
    await vi.advanceTimersByTimeAsync(310);
    expect(contexts[0].createOscillator).toHaveBeenCalledTimes(2);
    expect(contexts[0].sources).toHaveLength(0);
    audio.setSoundEnabled(false);
    release();
    await starting;
    expect(contexts[0].sources).toHaveLength(0);
    audio.setSoundEnabled(true);
    await audio.unlock();
    audio.play('gold');
    expect(contexts[0].sources).toHaveLength(1);
    expect(contexts[0].sources[0].buffer?.url).toContain('/gold.wav');
    expect(fetchSound).toHaveBeenCalledTimes(10);
  });

  it('reports an effects failure without disabling independent music', async () => {
    fetchSound.mockResolvedValue(new Response('', { status: 404 }));
    audio = new GameAudio(true, true, onError);
    await audio.unlock();
    await vi.advanceTimersByTimeAsync(620);
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0].en).toContain('Sound effects could not be started');
    expect(contexts[0].createOscillator).toHaveBeenCalledTimes(3);
    audio.play('launch');
    expect(contexts[0].sources).toHaveLength(0);
    audio.setMusicEnabled(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('pauses both channels, resumes one music timer, and disposes every source', async () => {
    audio = new GameAudio(true, true, onError);
    await audio.unlock();
    audio.play('gold');
    await vi.advanceTimersByTimeAsync(310);
    const context = contexts[0];
    audio.setPaused(true);
    expect(context.sources[0].stop).toHaveBeenCalledOnce();
    expect(context.createOscillator.mock.results[0].value.disconnect).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(context.createOscillator).toHaveBeenCalledTimes(2);
    context.state = 'suspended';
    audio.setPaused(false);
    await audio.unlock();
    expect(context.state).toBe('running');
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(310);
    expect(context.createOscillator).toHaveBeenCalledTimes(3);
    const resumed = context.createOscillator.mock.results[2].value;
    resumed.onended?.();
    expect(resumed.disconnect).toHaveBeenCalledOnce();
    audio.dispose();
    expect(resumed.stop).toHaveBeenCalledOnce();
    expect(resumed.disconnect).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    expect(context.close).toHaveBeenCalledOnce();
  });
});

describe('extracted audio files', () => {
  for (const [name, samples] of [
    ['launch', 16608], ['reel', 4212], ['grab', 2278], ['gold', 15364], ['gem', 14804],
    ['rock', 5233], ['bag', 12340], ['explosion', 21200], ['win', 55421], ['buy', 10304],
  ] as const) {
    it(`${name} contains the exact SWF sample count without MP3 encoder padding`, () => {
      const wav = readFileSync(new URL(`../assets/audio/${name}.wav`, import.meta.url));
      expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
      expect(wav.toString('ascii', 8, 12)).toBe('WAVE');
      expect(wav.readUInt16LE(20)).toBe(1);
      expect(wav.readUInt16LE(22)).toBe(1);
      expect(wav.readUInt32LE(24)).toBe(22050);
      expect(wav.readUInt16LE(34)).toBe(16);
      expect(wav.toString('ascii', 36, 40)).toBe('data');
      expect(wav.readUInt32LE(40)).toBe(samples * 2);
      expect(wav.length).toBe(44 + samples * 2);
      expect(wav.subarray(44).some((value) => value !== 0)).toBe(true);
    });
  }
});
