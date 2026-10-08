import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { catchAt, openFixture, readGame, settleHooks } from './game-driver';

interface AudioProbe {
  decoded: number[];
  played: number[];
  rates: number[];
  stopped: number;
  notes: number;
  running: boolean;
}

declare global {
  interface Window {
    getAudioProbe?: () => AudioProbe;
  }
}

async function readAudio(page: Page): Promise<AudioProbe> {
  return page.evaluate(() => {
    if (!window.getAudioProbe) throw new Error('The audio probe is missing.');
    return window.getAudioProbe();
  });
}

async function monitorAudio(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const probe: Omit<AudioProbe, 'running'> = { decoded: [], played: [], rates: [], stopped: 0, notes: 0 };
    const contexts = new Set<AudioContext>();
    const createGain = AudioContext.prototype.createGain;
    AudioContext.prototype.createGain = function () {
      contexts.add(this);
      return createGain.call(this);
    };
    const decode = AudioContext.prototype.decodeAudioData;
    AudioContext.prototype.decodeAudioData = function (data, success, failure) {
      return decode.call(this, data, success, failure).then((buffer) => {
        probe.decoded.push(buffer.duration);
        return buffer;
      });
    };
    const createSource = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const source = createSource.call(this);
      const start = source.start.bind(source);
      const stop = source.stop.bind(source);
      source.start = (...args) => {
        if (!source.buffer) throw new Error('An audio source started without decoded data.');
        probe.played.push(source.buffer.duration);
        probe.rates.push(source.playbackRate.value);
        start(...args);
      };
      source.stop = (...args) => {
        probe.stopped++;
        stop(...args);
      };
      return source;
    };
    const createOscillator = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      probe.notes++;
      return createOscillator.call(this);
    };
    window.getAudioProbe = () => ({ ...structuredClone(probe), running: [...contexts].some((context) => context.state === 'running') });
  });
}

async function openAudioFixture(page: Page, scenario: string, mode = 'solo'): Promise<void> {
  await monitorAudio(page);
  await page.addInitScript(() => {
    localStorage.setItem('gold-miner.preferences.v1', JSON.stringify({ sound: true, music: false, records: { solo: 0, coop: 0 } }));
  });
  await openFixture(page, `/tests/game.html?fixture=abilities&scenario=${scenario}&mode=${mode}`);
  await page.getByRole('group', { name: '游戏已暂停' }).waitFor();
  await page.getByRole('button', { name: '关闭音效', exact: true }).click();
  await page.getByRole('button', { name: '开启音效', exact: true }).click();
  await expect.poll(async () => (await readAudio(page)).decoded.length).toBe(10);
  await page.getByRole('button', { name: '继续挖矿', exact: true }).click();
}

function countSample(probe: AudioProbe, samples: number): number {
  return probe.played.filter((duration) => Math.abs(duration - samples / 22050) < 0.0001).length;
}

for (const mode of ['solo', 'coop'] as const) {
  test(`${mode} crushing reuses explosion audio at a faster rate with one shared cue per rock row`, async ({ page }) => {
    await openAudioFixture(page, 'rock-crusher', mode);
    if (mode === 'coop') await page.keyboard.press('s');
    await page.keyboard.press('ArrowDown');
    await page.clock.runFor(700);
    const probe = await readAudio(page);
    const crushes = probe.rates.flatMap((rate, index) => Math.abs(rate - 1.2) < 0.0001 ? [index] : []);
    expect(crushes).toHaveLength(2);
    for (const index of crushes) expect(probe.played[index]).toBeCloseTo(21200 / 22050, 4);
    expect(countSample(probe, 21200)).toBe(2);
    expect(probe.decoded).toHaveLength(10);
    expect(probe.notes).toBe(0);
  });
}

test('decodes the bundled effects once and plays real samples with working mute controls', async ({ page }) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('.wav') && !new URL(request.url()).search) requests.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await monitorAudio(page);
  await page.goto('/');
  expect(requests).toHaveLength(0);
  await page.getByRole('button', { name: '开始单人游戏', exact: true }).click();
  await expect.poll(async () => (await readAudio(page)).decoded.length).toBe(10);
  const decoded = (await readAudio(page)).decoded.sort((a, b) => a - b);
  const samples = [16608, 4212, 2278, 15364, 14804, 5233, 12340, 21200, 55421, 10304].sort((a, b) => a - b);
  decoded.forEach((duration, index) => expect(duration).toBeCloseTo(samples[index] / 22050, 4));
  expect(new Set(requests).size).toBe(10);

  await page.locator('.ability-card').first().click();
  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await readAudio(page)).played.some((duration) => Math.abs(duration - 16608 / 22050) < 0.0001)).toBe(true);
  await page.getByRole('button', { name: '关闭音效', exact: true }).click();
  const muted = await readAudio(page);
  expect(muted.stopped).toBeGreaterThan(0);
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(250);
  expect((await readAudio(page)).played).toEqual(muted.played);

  await page.getByRole('button', { name: '开启音效', exact: true }).click();
  await page.keyboard.press('ArrowUp');
  await expect.poll(async () => (await readAudio(page)).played.length).toBeGreaterThan(muted.played.length);
  expect((await readAudio(page)).decoded).toHaveLength(10);
  expect(requests).toHaveLength(10);
  expect(errors).toEqual([]);
});

for (const mode of ['solo', 'coop'] as const) {
  test(`${mode} heavy-gold hauling plays at most one shared reeling sample per second`, async ({ page }) => {
    await openAudioFixture(page, 'keyboard-cargo', mode);
    if (mode === 'coop') await page.keyboard.press('s');
    await page.keyboard.press('ArrowDown');
    await page.clock.runFor(500);
    expect((await readGame(page)).players.every((player) => player.cargoId !== null)).toBe(true);
    const before = countSample(await readAudio(page), 4212);
    await page.clock.runFor(2000);
    const count = countSample(await readAudio(page), 4212) - before;
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(2);
    await page.keyboard.press('Escape');
    const paused = countSample(await readAudio(page), 4212);
    await page.clock.runFor(3000);
    expect(countSample(await readAudio(page), 4212)).toBe(paused);
  });
}

test('plays the diamond-mole sample immediately on capture and not again on collection', async ({ page }) => {
  await openAudioFixture(page, 'risk-mole');
  await catchAt(page, ['mole-diamond']);
  expect((await readGame(page)).score).toBe(0);
  expect(countSample(await readAudio(page), 14804)).toBe(1);
  await settleHooks(page);
  expect((await readGame(page)).score).toBeGreaterThan(0);
  expect(countSample(await readAudio(page), 14804)).toBe(1);
});

for (const [scenario, original, final] of [
  ['alchemy', 'rock-small', 'gold-large'],
  ['diamond-vein', 'gold-large', 'diamond'],
] as const) {
  test(`${scenario} selects the sample from the transformed cargo, not the original item`, async ({ page }) => {
    await openAudioFixture(page, scenario);
    const target = await catchAt(page, [original]);
    const state = await readGame(page);
    expect(state.entities.find((entity) => entity.id === target.id)?.kind).toBe(final);
    expect(state.score).toBe(0);
    const gem = final === 'diamond' ? 1 : 0;
    expect(countSample(await readAudio(page), 14804)).toBe(gem);
    expect(countSample(await readAudio(page), 2278)).toBe(1 - gem);
    expect(countSample(await readAudio(page), 15364)).toBe(0);
    await settleHooks(page);
    expect((await readGame(page)).score).toBeGreaterThan(0);
    expect(countSample(await readAudio(page), 14804)).toBe(gem);
    expect(countSample(await readAudio(page), 15364)).toBe(1 - gem);
    expect(countSample(await readAudio(page), 5233)).toBe(0);
  });
}

test('waits until stage completion for victory and respects disabled music in the mine and shop', async ({ page }) => {
  await openAudioFixture(page, 'keyboard-cargo', 'coop');
  await page.keyboard.press('s');
  await page.keyboard.press('ArrowDown');
  await settleHooks(page);
  const state = await readGame(page);
  expect(state.score).toBe(1000);
  expect(state.goalAnnounced).toBe(true);
  expect(state.phase).toBe('playing');
  expect(countSample(await readAudio(page), 55421)).toBe(0);
  expect((await readAudio(page)).notes).toBe(0);
  await page.getByRole('button', { name: '提前收工', exact: true }).click();
  await expect(page.getByRole('region', { name: '过关', exact: true })).toBeVisible();
  expect(countSample(await readAudio(page), 55421)).toBe(1);
  await page.getByRole('button', { name: '去补给商店', exact: true }).click();
  await page.clock.runFor(3000);
  expect(countSample(await readAudio(page), 55421)).toBe(1);
  expect((await readAudio(page)).notes).toBe(0);
});

for (const failure of ['missing', 'corrupt'] as const) {
  test(`${failure} audio is reported without blocking play or reverting to synthetic effects`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/assets/audio/launch.wav', (route) => route.fulfill({
      status: failure === 'missing' ? 404 : 200,
      contentType: 'audio/wav',
      body: failure === 'missing' ? '' : 'Not a WAV file',
    }));
    await page.goto('/');
    await page.getByRole('button', { name: '开始单人游戏', exact: true }).click();
    await page.locator('.ability-card').first().click();
    await expect(page.locator('.warning-icon')).toHaveAttribute('aria-label', /未能启用音效/);
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[data-player="1"]')).toHaveAttribute('data-hook-phase', 'extending');
    await page.getByRole('button', { name: 'Switch to English', exact: true }).click();
    await expect(page.locator('.warning-icon')).toHaveAttribute('aria-label', /Sound effects could not be started/);
    expect(errors).toEqual([]);
  });
}

test('restores background music after interaction and keeps all four audio combinations independent', async ({ page }) => {
  await monitorAudio(page);
  await openFixture(page);
  expect((await readAudio(page)).notes).toBe(0);
  await page.getByRole('button', { name: '开始单人游戏', exact: true }).click();
  await expect.poll(async () => (await readAudio(page)).decoded.length).toBe(10);
  await page.clock.runFor(620);
  expect((await readAudio(page)).notes).toBeGreaterThan(0);
  await page.locator('.ability-card').first().click();
  await page.keyboard.press('ArrowDown');
  expect(countSample(await readAudio(page), 16608)).toBe(1);

  await page.getByRole('button', { name: '关闭音效', exact: true }).click();
  await expect(page.getByRole('button', { name: '关闭背景音乐', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const musicOnly = await readAudio(page);
  await page.keyboard.press('ArrowUp');
  await page.clock.runFor(620);
  expect((await readAudio(page)).played).toEqual(musicOnly.played);
  expect((await readAudio(page)).notes).toBeGreaterThan(musicOnly.notes);

  await page.getByRole('button', { name: '关闭背景音乐', exact: true }).click();
  const silent = await readAudio(page);
  await page.clock.runFor(1000);
  expect((await readAudio(page)).notes).toBe(silent.notes);
  expect((await readAudio(page)).played).toEqual(silent.played);

  await page.getByRole('button', { name: '开启音效', exact: true }).click();
  await page.keyboard.press('ArrowUp');
  await expect.poll(async () => (await readAudio(page)).played.length).toBeGreaterThan(silent.played.length);
  await page.clock.runFor(620);
  expect((await readAudio(page)).notes).toBe(silent.notes);
  expect((await readAudio(page)).decoded).toHaveLength(10);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gold-miner.preferences.v1')!)))
    .toMatchObject({ sound: true, music: false });
  await page.reload();
  await expect(page.getByRole('button', { name: '关闭音效', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '开启背景音乐', exact: true })).toHaveAttribute('aria-pressed', 'false');
});

test('music-only playback skips sample downloads, pauses with the game and hidden tab, and survives language changes', async ({ page }) => {
  await monitorAudio(page);
  await page.addInitScript(() => {
    if (!localStorage.getItem('gold-miner.preferences.v1')) {
      localStorage.setItem('gold-miner.preferences.v1', JSON.stringify({
        sound: false, music: true, language: 'zh-CN', records: { solo: 750, coop: 1500 },
      }));
    }
  });
  await openFixture(page);
  await page.getByRole('button', { name: '开始单人游戏', exact: true }).click();
  await expect.poll(async () => (await readAudio(page)).running).toBe(true);
  await page.locator('.ability-card').first().click();
  await page.clock.runFor(620);
  const playing = await readAudio(page);
  expect(playing.notes).toBeGreaterThan(0);
  expect(playing.decoded).toHaveLength(0);
  expect(playing.played).toHaveLength(0);
  await page.keyboard.press('Escape');
  await page.clock.runFor(1000);
  expect((await readAudio(page)).notes).toBe(playing.notes);
  await page.getByRole('button', { name: '继续挖矿', exact: true }).click();
  await page.clock.runFor(620);
  const resumed = await readAudio(page);
  expect(resumed.notes).toBeGreaterThan(playing.notes);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(1000);
  expect((await readAudio(page)).notes).toBe(resumed.notes);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.getByRole('button', { name: '继续挖矿', exact: true }).click();
  await page.clock.runFor(620);
  expect((await readAudio(page)).notes).toBeGreaterThan(resumed.notes);
  await page.getByRole('button', { name: 'Switch to English', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mute background music', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Enable sound effects', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Mute background music', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enable sound effects', exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gold-miner.preferences.v1')!))).toEqual({
    sound: false, music: true, language: 'en', records: { solo: 750, coop: 1500 },
  });
  expect((await readAudio(page)).notes).toBe(0);
});
