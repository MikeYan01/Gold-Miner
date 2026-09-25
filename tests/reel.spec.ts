import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readGame } from './game-driver';

interface PaintedFrame {
  time: number;
  x: number;
  y: number;
  cargo?: { x: number; y: number };
}

declare global {
  interface Window {
    getReelPaint?: () => PaintedFrame[];
  }
}

async function openReel(page: Page, query: string): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('gold-miner.preferences.v1', JSON.stringify({ sound: false, records: { solo: 0, coop: 0 } }));
  });
  await page.clock.install({ time: new Date('2026-09-21T12:00:00Z') });
  await page.goto(`/tests/reel.html?${query}`);
  await page.getByRole('group', { name: '游戏已暂停' }).waitFor();
  await page.clock.pauseAt(new Date('2026-09-21T13:00:00Z'));
  await page.getByRole('button', { name: '继续挖矿' }).click();
}

async function readPaint(page: Page): Promise<PaintedFrame[]> {
  const raw = await page.evaluate(() => {
    if (!window.getReelPaint) throw new Error('The rendered-rope probe is missing.');
    return window.getReelPaint();
  });
  return [...new Map(raw.map((frame) => [frame.time, frame])).values()];
}

for (const query of [
  'kind=empty', 'kind=gold-large', 'kind=diamond', 'kind=fast-gold', 'kind=mighty-gold',
  'kind=gold-large&mode=coop&player=2',
]) {
  test(`${query} return advances visibly on every display frame, not just physics ticks`, async ({ page }) => {
    await openReel(page, query);
    await page.clock.runFor(224);
    const frames = await readPaint(page);
    expect(frames.length).toBeGreaterThanOrEqual(12);
    const held = frames.slice(1).filter((frame, index) =>
      Math.hypot(frame.x - frames[index].x, frame.y - frames[index].y) < 0.0001,
    ).length;
    const largestFrameGap = Math.max(...frames.slice(1).map((frame, index) => frame.time - frames[index].time));
    expect(largestFrameGap).toBeLessThanOrEqual(18);
    expect(held, `${query}: ${frames.length} frames painted on time, but ${held} reused the previous hook position`).toBe(0);
    const distances = frames.slice(1).map((frame, index) => frames[index].y - frame.y);
    expect(distances.every((distance) => distance > 0)).toBe(true);
    const averageStep = distances.reduce((sum, distance) => sum + distance, 0) / distances.length;
    expect(Math.max(...distances) / averageStep).toBeLessThan(1.6);
    if (!query.includes('empty') && !query.includes('player=2')) {
      const offsets = frames.map((frame) => {
        if (!frame.cargo) throw new Error('The attached cargo was not painted with its hook.');
        return frame.cargo.y - frame.y;
      });
      for (const offset of offsets) {
        expect(Math.abs(offset - offsets[0]), 'cargo-to-hook separation in device pixels').toBeLessThan(0.01);
      }
    }
  });
}

test('pause freezes the interpolated pose and resume does not catch up paused wall time', async ({ page }) => {
  await openReel(page, 'kind=gold-large');
  await page.clock.runFor(144);
  const before = (await readPaint(page)).at(-1)!;
  await page.keyboard.press('Escape');
  const state = await readGame(page);
  await page.clock.runFor(10_000);
  expect((await readPaint(page)).at(-1)).toEqual(before);
  expect((await readGame(page)).players[0]).toEqual(state.players[0]);
  await page.keyboard.press('Escape');
  await page.clock.runFor(16);
  const after = (await readPaint(page)).at(-1)!;
  expect(before.y - after.y).toBeGreaterThan(0);
  expect(before.y - after.y).toBeLessThan(3);
});

test('destroying cargo switches to smooth empty reeling without a delayed frozen frame', async ({ page }) => {
  await openReel(page, 'kind=gold-large');
  await page.clock.runFor(144);
  await page.keyboard.press('ArrowUp');
  await expect(page.getByTestId('dynamite')).toHaveText('0');
  const before = (await readPaint(page)).length;
  await page.clock.runFor(160);
  const frames = (await readPaint(page)).slice(before);
  expect(frames.length).toBeGreaterThanOrEqual(8);
  for (let index = 1; index < frames.length; index++) expect(frames[index].y).toBeLessThan(frames[index - 1].y);
  expect((await readGame(page)).score).toBe(0);
});
