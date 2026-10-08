import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { hookTip } from '../src/game/engine';
import { REST_LENGTH } from '../src/game/levels';
import type { Point } from '../src/game/types';
import { muteFixture, openFixture, readGame, settleHooks } from './game-driver';

interface TurnDrawing {
  ropes: Point[][];
  guides: Point[][];
}

declare global {
  interface Window {
    getTurnPaint?: () => TurnDrawing;
  }
}

async function openTurning(page: Page, query = ''): Promise<void> {
  await muteFixture(page);
  await page.addInitScript(() => {
    const drawing: TurnDrawing = { ropes: [], guides: [] };
    const paths = new WeakMap<CanvasRenderingContext2D, Point[]>();
    const prototype = CanvasRenderingContext2D.prototype;
    const { beginPath, moveTo, lineTo, stroke, clearRect } = prototype;
    const record = (context: CanvasRenderingContext2D, x: number, y: number) => {
      if (!context.canvas.classList.contains('mine-canvas')) return;
      const transform = context.getTransform();
      paths.get(context)?.push({
        x: transform.a * x + transform.c * y + transform.e,
        y: transform.b * x + transform.d * y + transform.f,
      });
    };
    prototype.clearRect = function (x, y, width, height) {
      if (this.canvas.classList.contains('mine-canvas')) {
        drawing.ropes = [];
        drawing.guides = [];
      }
      return clearRect.call(this, x, y, width, height);
    };
    prototype.beginPath = function () {
      if (this.canvas.classList.contains('mine-canvas')) paths.set(this, []);
      return beginPath.call(this);
    };
    prototype.moveTo = function (x, y) {
      record(this, x, y);
      return moveTo.call(this, x, y);
    };
    prototype.lineTo = function (x, y) {
      record(this, x, y);
      return lineTo.call(this, x, y);
    };
    prototype.stroke = function (...args: [] | [Path2D]) {
      const points = paths.get(this);
      if (this.canvas.classList.contains('mine-canvas') && points && points.length >= 2) {
        if (this.strokeStyle === '#34382f') drawing.ropes.push([...points]);
        if (this.getLineDash().length > 0) drawing.guides.push([...points]);
      }
      Reflect.apply(stroke, this, args);
    };
    window.getTurnPaint = () => structuredClone(drawing);
  });
  await openFixture(page, `http://127.0.0.1:4173/tests/game.html?fixture=abilities&scenario=right-angle-turn&${query}`);
  await page.getByRole('group', { name: '游戏已暂停' }).waitFor();
  await page.getByRole('button', { name: '继续挖矿' }).click();
}

async function readDrawing(page: Page): Promise<TurnDrawing> {
  return page.evaluate(() => {
    if (!window.getTurnPaint) throw new Error('The right-angle drawing probe is missing.');
    return window.getTurnPaint();
  });
}

function direction(points: Point[]): Point {
  return { x: points.at(-1)!.x - points[0].x, y: points.at(-1)!.y - points[0].y };
}

function cosine(first: Point, second: Point): number {
  return (first.x * second.x + first.y * second.y) / Math.hypot(first.x, first.y) / Math.hypot(second.x, second.y);
}

async function reachTargetRow(page: Page): Promise<void> {
  for (let frame = 0; frame < 80; frame++) {
    const player = (await readGame(page)).players[0];
    expect(player.phase).toBe('extending');
    if (Math.abs(hookTip(player).y - 420) <= 5) return;
    await page.clock.runFor(16);
  }
  throw new Error('The straight claw never reached the turn target row.');
}

for (const [angle, turn, width, height] of [
  [-0.55, 'right', 1440, 1050],
  [0.55, 'left', 1800, 760],
  [-0.55, 'right', 390, 844],
  [0.55, 'left', 390, 844],
  [0, 'left', 1440, 1050],
  [0, 'right', 1440, 1050],
] as const) {
  test(`angle ${angle}, turn ${turn} at ${width}x${height} paints a live preview and a true right-angle rope`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await openTurning(page, `angle=${angle}&turn=${turn}`);
    const before = await readDrawing(page);
    expect(before.ropes).toHaveLength(1);
    expect(before.ropes[0]).toHaveLength(2);
    expect(before.guides).toHaveLength(1);
    expect(before.guides[0]).toHaveLength(2);
    expect(cosine(direction(before.ropes[0]), direction(before.guides[0]))).toBeCloseTo(1, 10);

    await page.keyboard.press('ArrowDown');
    await page.clock.runFor(160);
    const preview = await readDrawing(page);
    expect(preview.guides).toHaveLength(1);
    expect(preview.ropes[0]).toHaveLength(2);
    const previewDirection = direction(preview.guides[0]);
    // Allow subpixel Canvas transform rounding; simulation angles are checked separately.
    expect(cosine(direction(preview.ropes[0]), previewDirection)).toBeCloseTo(0, 6);
    expect(Math.sign(previewDirection.x)).toBe(turn === 'left' ? -1 : 1);
    if (width < 700) {
      await expect(page.getByRole('button', { name: '玩家1转弯', exact: true }))
        .toHaveClass(turn === 'left' ? /turn-left/ : /turn-ready$/);
    }
    await page.clock.runFor(64);
    const moved = await readDrawing(page);
    expect(moved.guides[0][0]).not.toEqual(preview.guides[0][0]);
    expect(cosine(direction(moved.guides[0]), previewDirection)).toBeCloseTo(1, 10);
    await page.screenshot({ path: testInfo.outputPath('live-turn-preview.png'), animations: 'disabled' });

    await page.keyboard.press('ArrowDown');
    await page.clock.runFor(160);
    const turned = await readDrawing(page);
    expect(turned.ropes[0]).toHaveLength(3);
    const firstLeg = direction(turned.ropes[0].slice(0, 2));
    const secondLeg = direction(turned.ropes[0].slice(1));
    expect(cosine(firstLeg, secondLeg)).toBeCloseTo(0, 6);
    expect(cosine(secondLeg, previewDirection)).toBeCloseTo(1, 10);
    expect(cosine(direction(turned.guides[0]), secondLeg)).toBeCloseTo(1, 10);
    const turnState = (await readGame(page)).players[0].turn;
    await page.keyboard.press('ArrowDown');
    await page.clock.runFor(32);
    expect((await readGame(page)).players[0].turn).toEqual(turnState);
    await page.screenshot({ path: testInfo.outputPath('right-angle-rope.png'), animations: 'disabled' });
  });
}

test('holding launch does not spend the turn, and pausing freezes the pending preview', async ({ page }) => {
  await openTurning(page);
  await page.keyboard.down('ArrowDown');
  await page.clock.runFor(160);
  await page.keyboard.down('ArrowDown');
  expect((await readGame(page)).players[0].turn?.atLength).toBeNull();
  await page.keyboard.up('ArrowDown');
  await page.keyboard.press('Escape');
  const state = await readGame(page);
  const drawing = await readDrawing(page);
  await page.keyboard.press('ArrowDown');
  await page.clock.runFor(2000);
  expect(await readGame(page)).toEqual(state);
  expect(await readDrawing(page)).toEqual(drawing);
  await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowDown');
  expect((await readGame(page)).players[0].turn?.atLength).not.toBeNull();
});

test('an empty turned hook reaches the boundary and retraces the painted corner before becoming ready', async ({ page }, testInfo) => {
  await openTurning(page);
  await page.keyboard.press('ArrowDown');
  await page.clock.runFor(224);
  await page.keyboard.press('ArrowDown');
  await page.clock.runFor(1120);
  expect((await readGame(page)).players[0].phase).toBe('retracting');
  const returning = await readDrawing(page);
  expect(returning.guides).toHaveLength(0);
  expect(returning.ropes[0]).toHaveLength(3);
  const corner = returning.ropes[0][1];
  let sawFirstLeg = false;
  for (let frame = 0; frame < 150; frame++) {
    const player = (await readGame(page)).players[0];
    if (player.phase === 'swinging') break;
    const drawing = await readDrawing(page);
    expect(drawing.guides).toHaveLength(0);
    if (drawing.ropes[0].length === 3) {
      expect(drawing.ropes[0][1].x).toBeCloseTo(corner.x, 8);
      expect(drawing.ropes[0][1].y).toBeCloseTo(corner.y, 8);
    } else {
      sawFirstLeg = true;
      expect(drawing.ropes[0]).toHaveLength(2);
    }
    await page.clock.runFor(16);
  }
  const player = (await readGame(page)).players[0];
  expect(sawFirstLeg).toBe(true);
  expect(player.phase).toBe('swinging');
  expect(player.length).toBe(REST_LENGTH);
  expect(player.turn).toBeNull();
  await expect(page.getByTestId('score')).toHaveText('$0');
  await page.screenshot({ path: testInfo.outputPath('empty-return-complete.png'), animations: 'disabled' });
});

for (const mode of ['solo', 'coop'] as const) {
  test(`${mode} keyboard controls turn independently and collect off-axis diamonds only after hauling`, async ({ page }, testInfo) => {
    await openTurning(page, `mode=${mode}&cargo=diamond`);
    if (mode === 'coop') await page.keyboard.press('s');
    await page.keyboard.press('ArrowDown');
    await reachTargetRow(page);
    if (mode === 'coop') {
      await page.keyboard.press('s');
      const state = await readGame(page);
      expect(state.players[0].turn?.atLength).not.toBeNull();
      expect(state.players[1].turn?.atLength).toBeNull();
    }
    await page.keyboard.press('ArrowDown');
    await page.clock.runFor(450);
    const state = await readGame(page);
    expect(state.players.every((player) => player.cargoId === player.id && player.phase === 'retracting')).toBe(true);
    expect(state.score).toBe(0);
    expect((await readDrawing(page)).guides).toHaveLength(0);
    await page.screenshot({ path: testInfo.outputPath(`turned-${mode}-cargo.png`), animations: 'disabled' });
    await settleHooks(page);
    await expect(page.getByTestId('score')).toHaveText(mode === 'coop' ? '$1,200' : '$600');
    expect((await readGame(page)).players.every((player) => player.turn === null)).toBe(true);
  });
}

test('the same mobile launch button becomes a localized turn control and then hauls normally', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await openTurning(page, 'cargo=diamond');
    await page.getByRole('button', { name: '玩家1下钩', exact: true }).tap();
    await expect(page.getByRole('button', { name: '玩家1转弯', exact: true })).toBeVisible();
    await reachTargetRow(page);
    const state = await readGame(page);
    await page.getByRole('button', { name: 'Switch to English', exact: true }).tap();
    expect(await readGame(page)).toEqual(state);
    await page.getByRole('button', { name: 'Player 1: turn claw', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Player 1: turn claw', exact: true })).toHaveCount(0);
    await page.clock.runFor(450);
    expect((await readGame(page)).players[0].cargoId).toBe(1);
    await settleHooks(page);
    await expect(page.getByTestId('score')).toHaveText('$600');
    await expect(page.getByRole('button', { name: 'Player 1: launch claw', exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});
