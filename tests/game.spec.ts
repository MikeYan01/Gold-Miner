import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { parsePreferences } from '../src/game/storage';
import { createLevel } from '../src/game/levels';
import { catchAt, coins, collectGoal, fireAt, readGame, settleHooks } from './game-driver';

// The fixture keeps mine/shop seeds independent of ability drafts.
async function openTimedMenu(page: Page, seed = 523_260_012): Promise<void> {
  await page.clock.install({ time: new Date('2026-09-19T12:00:00Z') });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/tests/game.html?seed=${seed}`);
  await page.getByRole('button', { name: '开始单人游戏' }).waitFor();
  // install() alone still advances between Playwright actions; freeze before aiming.
  await page.clock.pauseAt(new Date('2026-09-19T13:00:00Z'));
}

async function launchMuted(page: Page, coop = false, seed = 523_260_012): Promise<void> {
  await openTimedMenu(page, seed);
  await page.getByRole('button', { name: '关闭声音' }).click();
  await page.getByRole('button', { name: coop ? '开始双人游戏' : '开始单人游戏' }).click();
  await page.getByRole('button', { name: '选择能力：射线', exact: true }).click();
  await page.clock.runFor(16);
}

async function openCargoFixture(page: Page, coop = false): Promise<void> {
  await page.clock.install({ time: new Date('2026-09-19T12:00:00Z') });
  await page.goto(`/tests/abilities.html?scenario=keyboard-cargo&mode=${coop ? 'coop' : 'solo'}`);
  await page.getByRole('group', { name: '游戏已暂停' }).waitFor();
  await page.clock.pauseAt(new Date('2026-09-19T13:00:00Z'));
  await page.getByRole('button', { name: '关闭声音' }).click();
  await page.getByRole('button', { name: '继续挖矿' }).click();
}

async function savedRecords(page: Page) {
  const raw = await page.evaluate(() => localStorage.getItem('gold-miner.preferences.v1'));
  if (!raw) throw new Error('The completed run was not saved.');
  return parsePreferences(raw).records;
}

async function expectUndistortedArt(page: Page, kind: 'gold' | 'sun' = 'gold'): Promise<void> {
  const hasFixture = await page.evaluate(() => Boolean(window.getMiningState));
  const entities = hasFixture ? (await readGame(page)).entities : createLevel(1, 'solo');
  const gold = entities.find((entity) => entity.kind === 'gold-large' && entity.active && entity.claimedBy === null);
  if (!gold) throw new Error('The visual gold fixture is missing.');
  const sprite = kind === 'gold'
    ? { x: gold.x, y: gold.y, radius: gold.radius, minRed: 205, minGreen: 170, maxBlue: 110, minRatio: 0.85, maxRatio: 1.18 }
    : { x: 1023, y: 51, radius: 34, minRed: 248, minGreen: 237, maxBlue: 180, minRatio: 0.9, maxRatio: 1.1 };
  await expect.poll(() => page.locator('.mine-canvas').evaluate((element) => {
    if (!(element instanceof HTMLCanvasElement)) throw new Error('Missing mine canvas.');
    return element.width * element.clientHeight / (element.height * element.clientWidth);
  })).toBeCloseTo(1, 3);
  const measure = () => page.locator('.mine-canvas').evaluate((element, sprite) => {
    if (!(element instanceof HTMLCanvasElement)) throw new Error('Missing mine canvas.');
    const context = element.getContext('2d');
    if (!context) throw new Error('Canvas 2D is unavailable.');
    const scaleX = element.width / 1200;
    const scaleY = element.height / 720;
    const margin = Math.ceil(sprite.radius * Math.min(scaleX, scaleY) * 1.5) + 10;
    const left = Math.max(0, Math.floor(sprite.x * scaleX - margin));
    const top = Math.max(0, Math.floor(sprite.y * scaleY - margin));
    const width = Math.min(element.width - left, margin * 2);
    const height = Math.min(element.height - top, margin * 2);
    const pixels = context.getImageData(left, top, width, height).data;
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4;
        if (pixels[offset] > sprite.minRed && pixels[offset + 1] > sprite.minGreen && pixels[offset + 2] < sprite.maxBlue) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
    return {
      width: Math.max(0, maxX - minX + 1) * element.clientWidth / element.width,
      height: Math.max(0, maxY - minY + 1) * element.clientHeight / element.height,
    };
  }, sprite);
  await expect.poll(async () => (await measure()).width).toBeGreaterThan(10);
  const bounds = await measure();
  expect(bounds.width / bounds.height, `${kind} aspect ratio`).toBeGreaterThan(sprite.minRatio);
  expect(bounds.width / bounds.height, `${kind} aspect ratio`).toBeLessThan(sprite.maxRatio);
}

async function expectSceneFillsStage(page: Page): Promise<void> {
  const stage = await page.locator('.game-stage').boundingBox();
  const canvas = await page.locator('.mine-canvas').boundingBox();
  if (!stage || !canvas) throw new Error('The mine was not laid out.');
  expect.soft(canvas.x).toBeCloseTo(stage.x, 3);
  expect.soft(canvas.y).toBeCloseTo(stage.y, 3);
  expect.soft(canvas.width).toBeCloseTo(stage.width, 3);
  expect.soft(canvas.height).toBeCloseTo(stage.height, 3);
  await page.locator('.mine-canvas').focus();
  expect(await page.locator('.mine-canvas').evaluate((canvas) => getComputedStyle(canvas).outlineStyle)).toBe('none');
}

async function expectSingleLineShopEffects(page: Page): Promise<void> {
  const descriptions = page.locator('.item-description');
  await expect(descriptions).toHaveText([
    '炸掉钩上的重物', '下关力量 +2', '下关布袋奖励更好', '下关石头售价 ×3', '下关钻石售价 +50%',
  ]);
  for (const description of await descriptions.all()) {
    await expect(description).toBeVisible();
    const dimensions = await description.evaluate((element) => ({
      width: element.clientWidth,
      scrollWidth: element.scrollWidth,
      height: element.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
    expect(dimensions.height).toBeLessThanOrEqual(dimensions.lineHeight + 1);
  }
}

test('shows only the three status labels and numeric stage, with an illustrated mine and icon-only entry', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.stat-label')).toHaveText(['我的金币', '本关目标', '剩余时间']);
  await expect(page.locator('.level-stat')).toHaveText('01');
  await expect(page.locator('.level-stat .stat-label')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '开始单人游戏' })).toBeVisible();
  await expect(page.getByRole('button', { name: '开始双人游戏' })).toBeVisible();
  expect((await page.locator('body').innerText()).match(/\p{Script=Han}+/gu)).toEqual([
    '我的金币', '本关目标', '剩余时间',
  ]);
  await expect(page.locator('h1, h2, h3, p, footer, .site-header, .game-notice')).toHaveCount(0);
  await expect.poll(() => page.locator('.mine-canvas').evaluate((element) => {
    if (!(element instanceof HTMLCanvasElement)) throw new Error('Missing game canvas.');
    const context = element.getContext('2d');
    if (!context) throw new Error('Canvas 2D is unavailable.');
    const pixels = context.getImageData(0, 0, element.width, element.height).data;
    const distinct = new Set<string>();
    for (let i = 0; i < pixels.length; i += 1600) distinct.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
    return distinct.size;
  })).toBeGreaterThan(50);
  await page.screenshot({ path: testInfo.outputPath('classic-menu.png'), animations: 'disabled' });
  expect(errors).toEqual([]);
});

for (const viewport of [
  { width: 1440, height: 900 }, { width: 1920, height: 1080 },
  { width: 2560, height: 1440 }, { width: 3440, height: 1440 },
]) {
  test(`the game fills a ${viewport.width}×${viewport.height} monitor without the old page chrome`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const frame = await page.locator('.game-frame').boundingBox();
    const stage = await page.locator('.game-stage').boundingBox();
    if (!frame || !stage) throw new Error('The mine was not laid out.');
    expect(frame.x).toBe(0);
    expect(frame.y).toBe(0);
    expect(frame.width).toBe(viewport.width);
    expect(frame.height).toBe(viewport.height);
    expect(stage.width).toBe(viewport.width);
    expect(stage.height / viewport.height).toBeGreaterThan(0.9);
    await expectSceneFillsStage(page);
    await expectUndistortedArt(page);
    await expectUndistortedArt(page, 'sun');
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('solo uses arrows, reports the original empty dynamite stock, and pauses time and aim', async ({ page }) => {
  await launchMuted(page);
  await expect(page.locator('.mine-canvas')).toHaveAttribute('aria-keyshortcuts', 'ArrowDown ArrowUp');
  await page.keyboard.press('s');
  await expect(page.locator('[data-player="1"]')).toHaveAttribute('data-hook-phase', 'swinging');
  await expect(page.locator('[data-player="2"]')).toHaveCount(0);
  await page.keyboard.press('ArrowUp');
  await expect(page.getByTestId('dynamite')).toHaveText('0');
  await expect(page.locator('.warning-icon')).toHaveAttribute('aria-label', /没有炸药/);
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[data-player="1"]')).toHaveAttribute('data-hook-phase', 'extending');
  await page.clock.runFor(400);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('group', { name: '游戏已暂停' })).toBeVisible();
  const time = await page.getByTestId('timer').innerText();
  const angle = await page.locator('[data-player="1"]').getAttribute('data-angle');
  await page.clock.runFor(8000);
  await expect(page.getByTestId('timer')).toHaveText(time);
  await expect(page.locator('[data-player="1"]')).toHaveAttribute('data-angle', angle!);
  await page.keyboard.press('Escape');
  await page.clock.runFor(1600);
  await expect(page.getByTestId('timer')).not.toHaveText(time);
});

test('Down opens the mandatory solo draft without starting the clock or launching', async ({ page }) => {
  await openTimedMenu(page);
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('dialog', { name: '选择能力' })).toBeVisible();
  await expect(page.locator('.game-frame')).toHaveClass('game-frame phase-draft');
  await page.clock.fastForward(120_000);
  await expect(page.getByTestId('timer')).toHaveText('—');
  await expect(page.locator('[data-player="1"]')).toHaveAttribute('data-hook-phase', 'swinging');
  await page.getByRole('button', { name: '选择能力：射线', exact: true }).click();
  await expect(page.locator('.game-frame')).toHaveClass('game-frame phase-playing');
  await expect(page.getByTestId('timer')).toHaveText('60');
  await expect(page.locator('[data-player="2"]')).toHaveCount(0);
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[data-player="1"]')).toHaveAttribute('data-hook-phase', 'extending');
});

test('resizing a paused, loaded hook fills the new stage without dropping cargo or stretching gold', async ({ page }) => {
  await launchMuted(page);
  const target = await catchAt(page, ['gold-large']);
  await page.keyboard.press('Escape');
  const hook = page.locator('[data-player="1"]');
  await expect(hook).toHaveAttribute('data-cargo', String(target.id));
  const time = await page.getByTestId('timer').innerText();
  for (const viewport of [
    { width: 3440, height: 1440 }, { width: 390, height: 844 }, { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await expectSceneFillsStage(page);
    await expectUndistortedArt(page);
    await expectUndistortedArt(page, 'sun');
    await expect(hook).toHaveAttribute('data-cargo', String(target.id));
    await expect(page.getByTestId('timer')).toHaveText(time);
  }
  await page.keyboard.press('Escape');
  await settleHooks(page);
  await expect(page.getByTestId('score')).toHaveText('$500');
  await expect(hook).toHaveAttribute('data-cargo', '');
});

for (const [playerId, bombKey] of [[1, 'w'], [2, 'ArrowUp']] as const) {
  test(`co-op maps S to player 1, Down to player 2, and ${bombKey} bombs only player ${playerId}'s cargo`, async ({ page }, testInfo) => {
    await openCargoFixture(page, true);
    await expect(page.getByTestId('dynamite')).toHaveText('1');
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '650');
    await expect(page.getByTestId('timer')).toHaveText('40');
    await expect(page.locator('.mine-canvas')).toHaveAttribute('aria-keyshortcuts', 'S W ArrowDown ArrowUp');
    const player1 = page.locator('[data-player="1"]');
    const player2 = page.locator('[data-player="2"]');
    await page.keyboard.down('s');
    await expect(player1).toHaveAttribute('data-hook-phase', 'extending');
    await expect(player2).toHaveAttribute('data-hook-phase', 'swinging');
    await page.keyboard.down('ArrowDown');
    await page.keyboard.up('s');
    await page.keyboard.up('ArrowDown');
    await expect(player1).toHaveAttribute('data-hook-phase', 'extending');
    await expect(player2).toHaveAttribute('data-hook-phase', 'extending');
    await expect(player1.locator('button').first()).toHaveAttribute('aria-keyshortcuts', 'S');
    await expect(player2.locator('button').first()).toHaveAttribute('aria-keyshortcuts', 'ArrowDown');
    await page.clock.runFor(850);
    await page.screenshot({ path: testInfo.outputPath('classic-co-op.png'), animations: 'disabled' });
    await expect(player1).not.toHaveAttribute('data-cargo', '');
    await expect(player2).not.toHaveAttribute('data-cargo', '');
    await page.keyboard.press(bombKey);
    await expect(page.getByTestId('dynamite')).toHaveText('0');
    await expect(playerId === 1 ? player1 : player2).toHaveAttribute('data-cargo', '');
    await expect(playerId === 1 ? player2 : player1).not.toHaveAttribute('data-cargo', '');
  });
}

test('co-op clears a shared goal and carries shared shop supplies into the next round', async ({ page }) => {
  test.setTimeout(60_000);
  await launchMuted(page, true, 600_722_910);
  const firstTarget = await catchAt(page, ['gold-large'], 1);
  const secondTarget = await fireAt(page, ['gold-large'], 2);
  expect(secondTarget.id).not.toBe(firstTarget.id);
  await settleHooks(page);
  await expect(page.getByTestId('score')).toHaveText('$1,000');
  await page.getByRole('button', { name: '提前收工' }).click();
  await expect(page.getByLabel('玩家1本关所得')).toContainText('$500');
  await expect(page.getByLabel('玩家2本关所得')).toContainText('$500');
  await page.getByRole('button', { name: '去补给商店' }).click();
  await page.getByRole('button', { name: '购买大力水 $223' }).click();
  await page.getByRole('button', { name: '购买一捆炸药 $116' }).click();
  await page.getByRole('button', { name: '下一关', exact: true }).click();
  await expect(page.getByTestId('score')).toHaveText('$661');
  await expect(page.getByTestId('dynamite')).toHaveText('1');
  await expect(page.locator('.active-upgrade')).toHaveAttribute('data-upgrade', 'strength');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '1195');
  await expect(page.getByTestId('timer')).toHaveText('40');
  await expect(page.locator('[data-player]')).toHaveCount(2);
  await page.reload();
  expect(await savedRecords(page)).toEqual({ solo: 0, coop: 1000 });
});

test('the up arrow destroys the first player’s actual cargo', async ({ page }) => {
  await openCargoFixture(page);
  await page.keyboard.press('ArrowDown');
  await page.clock.runFor(500);
  const hook = page.locator('[data-player="1"]');
  await expect(hook).not.toHaveAttribute('data-cargo', '');
  await page.keyboard.press('ArrowUp');
  await expect(hook).toHaveAttribute('data-cargo', '');
  await expect(page.getByTestId('dynamite')).toHaveText('0');
  await expect(page.getByTestId('score')).toHaveText('$0');
});

test('the added $100 gold nugget can be aimed at, hauled, and paid out', async ({ page }) => {
  await launchMuted(page);
  await fireAt(page, ['gold-small']);
  await settleHooks(page);
  await expect(page.getByTestId('score')).toHaveText('$100');
  await expect(page.locator('[data-player="1"]')).toHaveAttribute('data-cargo', '');
  await expect(page.locator('.game-frame')).toHaveClass('game-frame phase-playing');
});

test('plays a winning round with equal result actions, brief shop effects, and working purchases', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await launchMuted(page, false, 600_722_910);
  const wallet = await collectGoal(page);
  await page.screenshot({ path: testInfo.outputPath('classic-mining.png'), animations: 'disabled' });
  await page.getByRole('button', { name: '提前收工' }).click();
  await expect(page.getByRole('region', { name: '过关', exact: true })).toBeVisible();
  const home = await page.getByRole('button', { name: '返回营地', exact: true }).boundingBox();
  const shop = await page.getByRole('button', { name: '去补给商店' }).boundingBox();
  if (!home || !shop) throw new Error('Result actions were not laid out.');
  expect.soft(home.width).toBe(shop.width);
  expect.soft(home.height).toBe(shop.height);
  await page.screenshot({ path: testInfo.outputPath('result-actions.png'), animations: 'disabled' });
  await page.getByRole('button', { name: '去补给商店' }).click();
  await expect(page.getByRole('region', { name: '补给商店' })).toBeVisible();
  await expect(page.locator('.shop-scene h1, .shop-scene h2, .shop-scene h3, .shop-scene p')).toHaveCount(0);
  await expectSingleLineShopEffects(page);
  await page.screenshot({ path: testInfo.outputPath('classic-shop.png'), animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expectSingleLineShopEffects(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('mobile-shop.png'), animations: 'disabled' });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.getByRole('button', { name: '购买大力水 $223' }).click();
  await expect(page.getByTestId('score')).toHaveText(coins(wallet - 223));
  await expect(page.getByRole('button', { name: '大力水已购买' })).toBeDisabled();
  await page.getByRole('button', { name: '购买一捆炸药 $116' }).click();
  await expect(page.getByTestId('dynamite')).toHaveText('1');
  await expect(page.getByTestId('score')).toHaveText(coins(wallet - 339));
  await page.getByRole('button', { name: '下一关', exact: true }).click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '1195');
  await expect(page.locator('.active-upgrade')).toHaveAttribute('data-upgrade', 'strength');
  await expect(page.getByTestId('score')).toHaveText(coins(wallet - 339));
  await expect(page.locator('.level-stat')).toHaveText('02');
  await page.reload();
  expect(await savedRecords(page)).toEqual({ solo: wallet, coop: 0 });
  await expect(page.getByRole('button', { name: '开启声音' })).toBeVisible();
});

test('buying diamond polish raises the next real diamond from $600 to $900', async ({ page }) => {
  test.setTimeout(60_000);
  await launchMuted(page, false, 3_784_642_556);
  const wallet = await collectGoal(page);
  await page.getByRole('button', { name: '提前收工' }).click();
  await page.getByRole('button', { name: '去补给商店' }).click();
  await page.getByRole('button', { name: '购买钻石抛光剂 $270' }).click();
  await expect(page.getByTestId('score')).toHaveText(coins(wallet - 270));
  await page.getByRole('button', { name: '下一关', exact: true }).click();
  await expect(page.locator('.active-upgrade')).toHaveAttribute('data-upgrade', 'polish');
  await fireAt(page, ['diamond']);
  await settleHooks(page);
  await expect(page.getByTestId('score')).toHaveText(coins(wallet - 270 + 900));
});

for (const [mode, seconds] of [['solo', 60], ['coop', 40]] as const) {
  test(`${mode} expires after ${seconds} seconds and restarting restores its timer`, async ({ page }) => {
    test.setTimeout(90_000);
    await launchMuted(page, mode === 'coop');
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '650');
    await expect(page.getByTestId('timer')).toHaveText(String(seconds));
    await page.clock.runFor(seconds * 1000 - 100);
    await expect(page.locator('.game-frame')).toHaveClass('game-frame phase-playing');
    await expect(page.getByTestId('timer')).toHaveText('01');
    await page.clock.runFor(200);
    await expect(page.getByTestId('timer')).toHaveText('00');
    await expect(page.getByRole('region', { name: '挑战结束' })).toBeVisible();
    await page.getByRole('button', { name: '重新挑战' }).click();
    await expect(page.getByRole('dialog', { name: '选择能力' })).toBeVisible();
    await page.locator('.ability-card').first().click();
    await expect(page.getByTestId('timer')).toHaveText(String(seconds));
    await expect(page.getByTestId('score')).toHaveText('$0');
    await expect(page.locator('[data-player="1"]')).toHaveAttribute('data-hook-phase', 'swinging');
    await expect(page.locator('[data-player]')).toHaveCount(mode === 'coop' ? 2 : 1);
  });
}

test('starts synthesized audio after interaction and stops generating notes when muted', async ({ page }) => {
  await page.addInitScript(() => {
    const createOscillator = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      const count = Number(document.documentElement.dataset.audioNotes || 0);
      document.documentElement.dataset.audioNotes = String(count + 1);
      return createOscillator.call(this);
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: '开始单人游戏' }).click();
  await page.locator('.ability-card').first().click();
  await expect.poll(() => page.locator('html').getAttribute('data-audio-notes')).not.toBeNull();
  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => Number(await page.locator('html').getAttribute('data-audio-notes'))).toBeGreaterThan(2);
  await page.getByRole('button', { name: '关闭声音' }).click();
  const notes = await page.locator('html').getAttribute('data-audio-notes');
  await page.waitForTimeout(800);
  await expect(page.locator('html')).toHaveAttribute('data-audio-notes', notes!);
});

test('mobile retains working two-player touch controls without text panels or page overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await launchMuted(page, true);
  await expectSceneFillsStage(page);
  await expectUndistortedArt(page);
  await expectUndistortedArt(page, 'sun');
  await page.getByRole('button', { name: '玩家1下钩', exact: true }).click();
  await page.getByRole('button', { name: '玩家2下钩', exact: true }).click();
  await expect(page.locator('[data-player="1"]')).toHaveAttribute('data-hook-phase', 'extending');
  await expect(page.locator('[data-player="2"]')).toHaveAttribute('data-hook-phase', 'extending');
  await page.clock.runFor(500);
  await page.screenshot({ path: testInfo.outputPath('mobile-co-op.png'), animations: 'disabled' });
  await page.getByRole('button', { name: '暂停游戏' }).click();
  await expect(page.getByRole('button', { name: '继续挖矿' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  await expect(page.locator('h1, h2, h3, p, footer')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('mobile-paused.png'), animations: 'disabled' });
});

test.describe('touchscreen virtual controls', () => {
  test.use({ hasTouch: true });

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 932, height: 430 },
    { width: 1024, height: 768 },
    { width: 1366, height: 1024 },
  ]) {
    for (const coop of [false, true]) {
      test(`${coop ? 'co-op' : 'solo'} can launch and use dynamite by touch at ${viewport.width}x${viewport.height}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await openCargoFixture(page, coop);
        expect(await page.evaluate(() => matchMedia('(any-pointer: coarse)').matches)).toBe(true);
        const buttons = page.locator('.touch-button:visible');
        await expect(buttons).toHaveCount(coop ? 4 : 2);
        for (const button of await buttons.all()) {
          const bounds = await button.boundingBox();
          if (!bounds) throw new Error('A virtual control is missing.');
          expect(bounds.width).toBeGreaterThanOrEqual(44);
          expect(bounds.height).toBeGreaterThanOrEqual(44);
          expect(bounds.x).toBeGreaterThanOrEqual(15);
          expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width - 15);
          expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height - 17);
        }
        const before = await readGame(page);
        for (const player of before.players) {
          await page.getByRole('button', { name: `玩家${player.id}下钩`, exact: true }).tap();
          await expect(page.locator(`[data-player="${player.id}"]`)).toHaveAttribute('data-hook-phase', 'extending');
        }
        await page.clock.runFor(500);
        const loaded = await readGame(page);
        expect(loaded.players.every((player) => player.cargoId !== null)).toBe(true);
        const bomber = coop ? 2 : 1;
        const cargoId = loaded.players[bomber - 1].cargoId;
        await page.getByRole('button', { name: `玩家${bomber}使用炸药`, exact: true }).tap();
        const after = await readGame(page);
        expect(after.dynamite).toBe(before.dynamite - 1);
        expect(after.players[bomber - 1].cargoId).toBeNull();
        expect(after.entities.find((entity) => entity.id === cargoId)?.active).toBe(false);
        expect(after.score).toBe(before.score);
        if (coop) expect(after.players[0].cargoId).toBe(loaded.players[0].cargoId);
        await page.getByRole('button', { name: `玩家${bomber}使用炸药`, exact: true }).tap();
        expect((await readGame(page)).dynamite).toBe(0);
        await expect(page.locator('.warning-icon')).toHaveAttribute('aria-label', /没有炸药/);

        await page.getByRole('button', { name: '暂停游戏', exact: true }).tap();
        await expect(page.locator('.touch-button:visible')).toHaveCount(0);
        for (const button of await page.locator('.touch-button').all()) await expect(button).toBeDisabled();
        await page.getByRole('button', { name: '继续挖矿', exact: true }).tap();
        await expect(page.locator('.touch-button:visible')).toHaveCount(coop ? 4 : 2);
      });
    }
  }

  test('tablet rotation retains the virtual keys and English touch actions', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await openCargoFixture(page);
    const before = await readGame(page);
    for (const viewport of [{ width: 1024, height: 768 }, { width: 1366, height: 1024 }]) {
      await page.setViewportSize(viewport);
      await expect(page.locator('.touch-button:visible')).toHaveCount(2);
      expect(await readGame(page)).toMatchObject({ phase: 'playing', level: before.level, score: before.score, abilities: before.abilities });
    }
    await page.getByRole('button', { name: 'Switch to English', exact: true }).tap();
    await page.getByRole('button', { name: 'Player 1: launch claw', exact: true }).tap();
    await page.clock.runFor(500);
    expect((await readGame(page)).players[0].cargoId).not.toBeNull();
    await page.getByRole('button', { name: 'Player 1: use dynamite', exact: true }).tap();
    expect((await readGame(page)).dynamite).toBe(0);
    expect((await readGame(page)).players[0].cargoId).toBeNull();
    await page.screenshot({ path: testInfo.outputPath('tablet-virtual-controls.png'), animations: 'disabled' });
  });
});

test('mouse-only desktops keep keyboard controls and the existing narrow-window fallback', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  await openCargoFixture(page);
  expect(await page.evaluate(() => matchMedia('(any-pointer: coarse)').matches)).toBe(false);
  await expect(page.locator('.touch-button:visible')).toHaveCount(0);
  await page.keyboard.press('ArrowDown');
  await page.clock.runFor(500);
  expect((await readGame(page)).players[0].cargoId).not.toBeNull();
  await page.keyboard.press('ArrowUp');
  expect((await readGame(page)).dynamite).toBe(0);
  expect((await readGame(page)).players[0].cargoId).toBeNull();
  await page.setViewportSize({ width: 800, height: 900 });
  await expect(page.locator('.touch-button:visible')).toHaveCount(2);
});
