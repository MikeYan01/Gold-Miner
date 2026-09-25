import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { levelTarget } from '../src/game/levels';
import type { Mode } from '../src/game/types';
import { readGame } from './game-driver';

async function openCompletedStage(page: Page, mode: Mode, level = 12): Promise<void> {
  await page.clock.install({ time: new Date('2026-09-19T12:00:00Z') });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/tests/endless.html?mode=${mode}&level=${level}`);
  await page.getByRole('group', { name: '游戏已暂停' }).waitFor();
  await page.clock.pauseAt(new Date('2026-09-19T13:00:00Z'));
  await page.getByRole('button', { name: '关闭声音' }).click();
  await page.getByRole('button', { name: '继续挖矿' }).click();
}

for (const mode of ['solo', 'coop'] as const) {
  test(`${mode} clears stage 12, visits the real shop, and plays stage 13`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await openCompletedStage(page, mode);
    await expect(page.locator('.level-stat strong')).toHaveText('12');
    await expect(page.getByTestId('timer')).toHaveText(mode === 'coop' ? '40' : '60');
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuemax', String(levelTarget(12)));
    await page.getByRole('button', { name: '提前收工' }).click();
    await expect(page.getByRole('button', { name: '去补给商店' })).toBeVisible();
    await expect(page.getByRole('button', { name: '重新挑战' })).toHaveCount(0);
    await page.getByRole('button', { name: '去补给商店' }).click();
    await expect(page.locator('.level-stat')).toHaveText('13');
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuemax', String(levelTarget(13)));
    const drinkPrice = (await readGame(page)).shop.find((item) => item.id === 'strength')?.price;
    if (drinkPrice === null || drinkPrice === undefined) throw new Error('Expected a payable drink in the source-price fixture.');
    await page.getByRole('button', { name: /^购买大力水 / }).click();
    await page.getByRole('button', { name: '下一关', exact: true }).click();
    await expect(page.locator('.game-frame')).toHaveClass('game-frame phase-playing');
    await expect(page.getByTestId('timer')).toHaveText(mode === 'coop' ? '40' : '60');
    await expect(page.locator('.active-upgrade')).toHaveAttribute('data-upgrade', 'strength');
    await expect(page.locator('[data-player]')).toHaveCount(mode === 'solo' ? 1 : 2);
    await expect(page.getByTestId('score')).toHaveAttribute('title', `$${(levelTarget(12) - drinkPrice).toLocaleString('en-US')}`);
    await page.keyboard.press('ArrowDown');
    if (mode === 'coop') await page.keyboard.press('s');
    await page.clock.runFor(700);
    await page.screenshot({ path: testInfo.outputPath(`endless-${mode}.png`), animations: 'disabled' });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('group', { name: '游戏已暂停' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  for (const [level, target, nextTarget] of [
    [10, 15275, 18510],
    [19, 63450, 71450],
    [20, 71450, 79450],
  ] as const) {
    test(`${mode} stage ${level} uses the new targets across the shop and next mine`, async ({ page }) => {
      await openCompletedStage(page, mode, level);
      await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuemax', String(target));
      await page.getByRole('button', { name: '提前收工' }).click();
      await page.getByRole('button', { name: '去补给商店' }).click();
      await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuemax', String(nextTarget));
      await page.getByRole('button', { name: '下一关', exact: true }).click();
      expect(await readGame(page)).toMatchObject({
        level: level + 1, target: nextTarget, score: target, roundStartScore: target,
      });
      await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuemax', String(nextTarget));
      await expect(page.getByRole('button', { name: '提前收工' })).toHaveCount(0);
    });
  }
}

test('large stage numbers and money remain readable, and can still advance', async ({ page }) => {
  const level = 1_000_000;
  await page.setViewportSize({ width: 390, height: 844 });
  await openCompletedStage(page, 'solo', level);
  await expect(page.locator('.level-stat strong')).toHaveText(String(level));
  await expect(page.locator('.level-stat .stat-label')).toHaveCount(0);
  await expect(page.getByTestId('score')).toHaveText('$8B');
  await expect(page.getByTestId('score')).toHaveAttribute('title', `$${levelTarget(level).toLocaleString('en-US')}`);
  for (const stat of await page.locator('.hud-stat').all()) {
    const fits = await stat.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return Array.from(element.querySelectorAll('strong, .stat-label')).every((child) => {
        const rect = child.getBoundingClientRect();
        return rect.x >= bounds.x && rect.right <= bounds.right;
      });
    });
    expect(fits).toBe(true);
  }
  await page.getByRole('button', { name: '提前收工' }).click();
  await page.getByRole('button', { name: '去补给商店' }).click();
  await expect(page.locator('.level-stat strong')).toHaveText(String(level + 1));
  await page.getByRole('button', { name: '下一关', exact: true }).click();
  await expect(page.locator('.game-frame')).toHaveClass('game-frame phase-playing');
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuemax', String(levelTarget(level + 1)));
  await expect(page.getByTestId('timer')).toHaveText('60');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
