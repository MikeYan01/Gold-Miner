import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { catchAt, muteFixture, openFixture, readGame, settleHooks } from './game-driver';

async function openMuted(page: Page, path = '/tests/game.html'): Promise<void> {
  await muteFixture(page);
  await openFixture(page, path);
}

async function tapBlockedControl(page: Page, control: Locator): Promise<void> {
  expect(await control.evaluate((element) => {
    if (!(element instanceof HTMLButtonElement)) throw new Error('Expected a blocked game button.');
    element.focus();
    return document.activeElement === element;
  })).toBe(false);
  const bounds = await control.boundingBox();
  if (!bounds) throw new Error('The background game button is missing.');
  await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
}

test.describe('mobile landscape requirement', () => {
  test.use({ hasTouch: true });

  for (const portrait of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1024, height: 1366 },
  ]) {
    test(`portrait ${portrait.width}x${portrait.height} blocks entry until rotated, with localized guidance`, async ({ page }, testInfo) => {
      await page.setViewportSize(portrait);
      await openMuted(page);
      const initial = await readGame(page);
      await expect(page.getByRole('dialog', { name: '请横屏游玩', exact: true })).toBeVisible();
      await page.keyboard.press('Tab');
      expect(await page.locator('.game-frame').evaluate((frame) => frame.contains(document.activeElement))).toBe(false);
      await expect(page.locator('.game-frame')).toHaveAttribute('inert', '');
      expect(await page.locator('.rotate-notice').evaluate((dialog) => dialog.matches(':modal'))).toBe(true);
      await tapBlockedControl(page, page.getByRole('button', { name: '开始单人游戏', exact: true }));
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Escape');
      await page.keyboard.press('1');
      await page.clock.runFor(5000);
      expect(await readGame(page)).toEqual(initial);
      await expect(page.getByRole('dialog', { name: '请横屏游玩', exact: true })).toBeVisible();
      await page.getByRole('dialog').getByRole('button', { name: 'Switch to English', exact: true }).tap();
      await expect(page.getByRole('dialog', { name: 'Rotate to play', exact: true })).toContainText('Turn your phone or tablet sideways');
      expect(await readGame(page)).toEqual(initial);
      const notice = await page.locator('.rotate-notice').boundingBox();
      if (!notice) throw new Error('The rotation prompt is missing.');
      expect(notice).toEqual({ x: 0, y: 0, width: portrait.width, height: portrait.height });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`portrait-rotation-${portrait.width}.png`), animations: 'disabled' });

      await page.setViewportSize({ width: portrait.height, height: portrait.width });
      await expect(page.locator('.rotate-notice')).toHaveCount(0);
      await expect(page.locator('.game-frame')).not.toHaveAttribute('inert', '');
      await page.getByRole('button', { name: 'Start solo game', exact: true }).tap();
      const draft = await readGame(page);
      await expect(page.getByRole('dialog', { name: 'Choose an ability', exact: true })).toBeVisible();

      await page.setViewportSize(portrait);
      await expect(page.getByRole('dialog', { name: 'Rotate to play', exact: true })).toBeVisible();
      await expect(page.locator('.ability-dialog')).toHaveCount(0);
      await page.keyboard.press('1');
      await page.clock.runFor(5000);
      const blockedDraft = await readGame(page);
      expect(blockedDraft).toMatchObject({
        phase: 'draft', score: draft.score, abilities: draft.abilities, abilityOffers: draft.abilityOffers,
        offeredAbilities: draft.offeredAbilities, timeLeft: draft.timeLeft,
      });
      await page.setViewportSize({ width: portrait.height, height: portrait.width });
      await expect(page.getByRole('dialog', { name: 'Choose an ability', exact: true })).toBeVisible();
      expect((await readGame(page)).abilityOffers).toEqual(draft.abilityOffers);
      await page.locator('.ability-card:not([data-ability="time-rush"])').first().tap();
      await expect(page.locator('.game-frame')).toHaveClass('game-frame phase-playing');
      await expect(page.getByTestId('timer')).toHaveText('60');
      await page.clock.runFor(1100);
      expect((await readGame(page)).timeLeft).toBeLessThan(60);
    });
  }

  test('rotating a loaded co-op game to portrait pauses both miners and prevents resume or rewind', async ({ page }) => {
    await page.setViewportSize({ width: 932, height: 430 });
    await openMuted(page, '/tests/game.html?fixture=abilities&scenario=draft-language&ability=time-rewind&mode=coop');
    const card = page.getByRole('button', { name: '选择能力：时光倒流', exact: true });
    await expect(card).toContainText('（点击右上方时间按钮）');
    await card.tap();
    const cargo = await catchAt(page, ['gold-large', 'gold-medium', 'gold-small', 'gold-tiny'], 2);
    const before = await readGame(page);
    await page.setViewportSize({ width: 430, height: 932 });
    await expect(page.getByRole('dialog', { name: '请横屏游玩', exact: true })).toBeVisible();
    expect((await readGame(page)).phase).toBe('paused');
    await tapBlockedControl(page, page.locator('.rewind-button'));
    await tapBlockedControl(page, page.locator('.game-toolbar').getByRole('button', { name: '继续游戏', exact: true }));
    await page.getByRole('dialog').getByRole('button', { name: 'Switch to English', exact: true }).tap();
    await page.getByRole('dialog').tap({ position: { x: 10, y: 10 } });
    await page.keyboard.press('Escape');
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('s');
    await page.clock.runFor(5000);
    const paused = await readGame(page);
    expect(paused).toMatchObject({
      phase: 'paused', timeLeft: before.timeLeft, elapsed: before.elapsed, score: before.score,
      dynamite: before.dynamite, abilities: before.abilities, rewindUsed: false,
    });
    expect(paused.players[1].cargoId).toBe(cargo.id);
    await page.setViewportSize({ width: 932, height: 430 });
    await expect(page.locator('.rotate-notice')).toHaveCount(0);
    await expect(page.getByRole('group', { name: 'Game paused', exact: true })).toBeVisible();
    await page.clock.runFor(1000);
    expect((await readGame(page)).timeLeft).toBe(before.timeLeft);
    await page.getByRole('button', { name: 'Resume mining', exact: true }).tap();
    await settleHooks(page);
    expect((await readGame(page)).score).toBe(cargo.value);
  });

  test('a portrait shop cannot accept purchases or advance, and resumes with the same stock', async ({ page }) => {
    await page.setViewportSize({ width: 932, height: 430 });
    await openMuted(page, '/tests/game.html?fixture=abilities&scenario=thief-shop');
    const initial = await readGame(page);
    await page.setViewportSize({ width: 430, height: 932 });
    await expect(page.getByRole('dialog', { name: '请横屏游玩', exact: true })).toBeVisible();
    await tapBlockedControl(page, page.getByRole('button', { name: '下一关', exact: true }));
    await page.getByRole('dialog').tap({ position: { x: 10, y: 10 } });
    await page.keyboard.press('Enter');
    await page.clock.runFor(5000);
    const blocked = await readGame(page);
    expect(blocked).toMatchObject({
      phase: 'shop', score: initial.score, shop: initial.shop, shopStealsRemaining: initial.shopStealsRemaining,
      abilities: initial.abilities, pendingUpgrades: initial.pendingUpgrades,
    });
    await page.setViewportSize({ width: 932, height: 430 });
    await expect(page.getByRole('region', { name: '补给商店', exact: true })).toBeVisible();
    expect((await readGame(page)).shop).toEqual(initial.shop);
    await page.getByRole('button', { name: '免费偷取大力水', exact: true }).tap();
    expect((await readGame(page)).pendingUpgrades).toEqual(['strength']);
    expect((await readGame(page)).shopStealsRemaining).toBe(initial.shopStealsRemaining - 1);
  });
});

test('mouse-only portrait desktop windows can still enter and play', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openMuted(page);
  expect(await page.evaluate(() => matchMedia('(any-pointer: coarse)').matches)).toBe(false);
  await expect(page.locator('.rotate-notice')).toHaveCount(0);
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('dialog', { name: '选择能力', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '选择能力：射线', exact: true }).click();
  await expect(page.locator('.game-frame')).toHaveClass('game-frame phase-playing');
  await page.clock.runFor(1100);
  expect((await readGame(page)).timeLeft).toBeLessThan(60);
});
