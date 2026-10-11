import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Mode } from '../src/game/types';
import { createViewport } from '../src/game/viewport';
import { catchAt, collectGoal, muteFixture, openFixture, readGame, settleHooks } from './game-driver';

async function startRewind(page: Page, mode: Mode = 'solo'): Promise<void> {
  await muteFixture(page);
  await openFixture(page, `/tests/game.html?fixture=abilities&scenario=draft-language&ability=time-rewind&mode=${mode}`);
  await expect(page.locator('.rewind-button')).toHaveCount(0);
  await page.getByRole('button', { name: '选择能力：时光倒流', exact: true }).click();
}

for (const mode of ['solo', 'coop'] as const) {
  test(`Time Rewind is usable immediately, localized, and replenished only next ${mode} stage`, async ({ page }) => {
    await startRewind(page, mode);
    const initial = await readGame(page);
    await expect(page.getByRole('button', { name: '时光倒流：重新开始本关', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Switch to English', exact: true }).click();
    expect(await readGame(page)).toEqual(initial);
    await page.getByRole('button', { name: 'Time Rewind: restart this stage', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Time Rewind: used this stage', exact: true })).toBeDisabled();
    await expect(page.getByTestId('timer')).toHaveText(mode === 'solo' ? '60' : '40');
    await expect(page.locator('.sr-only[role="status"]')).toHaveText('Time rewound! Back to the start of this stage.');
    expect(await readGame(page)).toEqual({
      ...initial, rewindUsed: true, notice: expect.objectContaining({ tone: 'good' }),
    });
    await page.getByRole('button', { name: '切换到中文', exact: true }).click();
    await expect(page.getByRole('button', { name: '时光倒流：本关已使用', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('group', { name: '游戏已暂停' })).toBeVisible();
    await page.clock.runFor(5000);
    await expect(page.getByTestId('timer')).toHaveText(mode === 'solo' ? '60' : '40');
    await expect(page.locator('.rewind-button')).toBeDisabled();
    await page.keyboard.press('Escape');
    await collectGoal(page, initial.target);
    await page.getByRole('button', { name: '提前收工', exact: true }).click();
    await expect(page.locator('.rewind-button')).toHaveCount(0);
    await page.getByRole('button', { name: '去补给商店', exact: true }).click();
    await expect(page.locator('.rewind-button')).toHaveCount(0);
    const wallet = (await readGame(page)).score;
    await page.getByRole('button', { name: '下一关', exact: true }).click();
    await expect(page.getByRole('button', { name: '时光倒流：重新开始本关', exact: true })).toBeEnabled();
    expect((await readGame(page)).level).toBe(2);
    await page.locator('.rewind-button').click();
    expect((await readGame(page)).score).toBe(wallet);
    expect((await readGame(page)).level).toBe(2);
    await expect(page.locator('.rewind-button')).toBeDisabled();
  });

  test(`Time Rewind restores ${mode} earnings and loaded hooks from pause after resizing`, async ({ page }) => {
    await startRewind(page, mode);
    const initial = await readGame(page);
    await catchAt(page, ['gold-large', 'gold-medium', 'gold-small', 'gold-tiny']);
    await settleHooks(page);
    expect((await readGame(page)).score).toBeGreaterThan(initial.score);
    await catchAt(page, ['gold-large', 'gold-medium', 'gold-small', 'gold-tiny'], mode === 'coop' ? 2 : 1);
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 390, height: 844 });
    const canvas = await page.locator('.mine-canvas').boundingBox();
    if (!canvas) throw new Error('The resized mine is missing.');
    const originY = createViewport(canvas.width, canvas.height).originY;
    await expect.poll(async () => (await readGame(page)).players[0].origin.y).toBeCloseTo(originY);
    const paused = await readGame(page);
    expect(paused.players.some((player) => player.cargoId !== null)).toBe(true);
    await page.getByRole('button', { name: '时光倒流：重新开始本关', exact: true }).click();
    await expect(page.getByRole('group', { name: '游戏已暂停' })).toHaveCount(0);
    await expect(page.getByTestId('score')).toHaveText('$0');
    await expect(page.getByTestId('timer')).toHaveText(mode === 'solo' ? '60' : '40');
    expect(await readGame(page)).toEqual({
      ...initial,
      players: initial.players.map((player) => ({
        ...player, origin: { ...player.origin, y: originY },
      })),
      rewindUsed: true,
      notice: expect.objectContaining({ tone: 'good' }),
    });
    await expect(page.locator('.rewind-button')).toBeDisabled();
  });
}

for (const width of [320, 390, 1440]) {
  test(`Time Rewind fits the top-right toolbar without overlapping other controls at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await startRewind(page, 'coop');
    await page.clock.runFor(16);
    const rewind = page.locator('.game-toolbar .rewind-button');
    await expect(rewind).toBeVisible();
    await expect(rewind).toBeEnabled();
    const bounds = await rewind.boundingBox();
    if (!bounds) throw new Error('The rewind button is missing.');
    expect(bounds.x).toBeGreaterThanOrEqual(width / 2);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    for (const other of await page.locator('.game-toolbar .game-button:not(.rewind-button), .inventory, .ability-rack').all()) {
      const box = await other.boundingBox();
      if (!box) throw new Error('A game control is missing.');
      expect(bounds.x + bounds.width <= box.x || box.x + box.width <= bounds.x
        || bounds.y + bounds.height <= box.y || box.y + box.height <= bounds.y).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`time-rewind-toolbar-${width}.png`), animations: 'disabled' });
  });
}

test('Time Rewind is not shown without the selected ability', async ({ page }) => {
  await muteFixture(page);
  await openFixture(page, '/tests/game.html?fixture=abilities&scenario=draft-language&ability=might');
  await page.getByRole('button', { name: '选择能力：大力', exact: true }).click();
  await expect(page.locator('.rewind-button')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('group', { name: '游戏已暂停' })).toBeVisible();
  await expect(page.locator('.rewind-button')).toHaveCount(0);
});
