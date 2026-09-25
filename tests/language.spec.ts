import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { ABILITIES, getAbility } from '../src/game/abilities';
import type { Language } from '../src/game/i18n';
import { catchAt, fireAt, readGame, settleHooks } from './game-driver';

const preferenceKey = 'gold-miner.preferences.v1';

async function openFixture(page: Page, path = '/tests/game.html', language?: Language): Promise<void> {
  await page.addInitScript(({ key, language }) => {
    if (localStorage.getItem(key) === null) {
      localStorage.setItem(key, JSON.stringify({ sound: false, language, records: { solo: 750, coop: 1500 } }));
    }
  }, { key: preferenceKey, language });
  await page.clock.install({ time: new Date('2026-09-19T12:00:00Z') });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(path);
  await page.locator('.hud').waitFor();
  await page.clock.pauseAt(new Date('2026-09-19T13:00:00Z'));
}

async function expectFits(locator: Locator): Promise<void> {
  expect(await locator.evaluate((element) =>
    element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1,
  )).toBe(true);
}

test('switches with the keyboard, preserves old preferences, and remembers English after reload', async ({ page }) => {
  await openFixture(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  const before = await readGame(page);
  await page.getByRole('button', { name: 'Switch to English', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveTitle('Gold Miner');
  await expect(page.locator('.stat-label')).toHaveText(['Gold', 'Target', 'Time left']);
  await expect(page.getByRole('button', { name: 'Enable sound', exact: true })).toBeVisible();
  expect(await readGame(page)).toEqual(before);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), preferenceKey)).toEqual({
    sound: false, language: 'en', records: { solo: 750, coop: 1500 },
  });

  await page.reload();
  await expect(page.getByRole('button', { name: 'Start solo game', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page).toHaveTitle('Gold Miner');
  await page.getByRole('button', { name: '切换到中文', exact: true }).click();
  await expect(page).toHaveTitle('黄金矿工');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), preferenceKey)).toEqual({
    sound: false, language: 'zh-CN', records: { solo: 750, coop: 1500 },
  });
});

test('the modal has its own switch and keeps the exact ability offers and countdown', async ({ page }) => {
  await openFixture(page, '/tests/abilities.html?scenario=draft-risk');
  const before = await readGame(page);
  await page.getByRole('dialog').getByRole('button', { name: 'Switch to English', exact: true }).click();
  const draft = page.getByRole('dialog', { name: 'Choose an ability', exact: true });
  await expect(draft).toBeVisible();
  await expect(draft.getByRole('button', { name: 'Choose ability: Risk Reward', exact: true })).toContainText('50%');
  expect(await readGame(page)).toEqual(before);
  await page.keyboard.press('1');
  await expect(page.getByRole('region', { name: 'Supply shop', exact: true })).toBeVisible();
  await expect(page.locator('[data-owned-ability="risk-reward"]')).toHaveAccessibleName('View ability: Risk Reward');
  await expect(page.locator('.sr-only[role="status"]')).toHaveText('Acquired Risk Reward.');
});

test('changing language during a real co-op haul does not rebase the hooks or reset the mine', async ({ page }) => {
  await openFixture(page, '/tests/abilities.html?scenario=empowered-mine&mode=coop');
  await page.getByRole('button', { name: '继续挖矿', exact: true }).click();
  await catchAt(page, ['tnt'], 1);
  const before = await readGame(page);
  expect(before.players[0].cargoId).not.toBeNull();
  await page.getByRole('button', { name: 'Switch to English', exact: true }).click();
  expect(await readGame(page)).toEqual(before);
  await expect(page.locator('.mine-canvas')).toHaveAccessibleName(/^Gold Miner mine:/);
  await page.getByRole('button', { name: 'View ability: Wide Claw', exact: true }).hover();
  await expect(page.getByRole('tooltip')).toContainText('Claw width +100%');
  await page.getByRole('button', { name: '切换到中文', exact: true }).click();
  expect(await readGame(page)).toEqual(before);
});

test('shop language changes keep prices, purchases, thefts, and existing notices intact', async ({ page }) => {
  await openFixture(page, '/tests/abilities.html?scenario=late-shop', 'en');
  const before = await readGame(page);
  const prices = await page.locator('.item-price').allTextContents();
  await page.getByRole('button', { name: 'Buy Strength Drink $130', exact: true }).click();
  await expect(page.locator('.sr-only[role="status"]')).toHaveText('Purchased Strength Drink. Active next stage.');
  await page.getByRole('button', { name: 'Steal Diamond Polish for free', exact: true }).click();
  const after = await readGame(page);
  expect(after.score).toBe(before.score - 130);
  expect(after.pendingUpgrades).toEqual(['strength', 'polish']);
  expect(after.shopStealsRemaining).toBe(before.shopStealsRemaining - 1);
  await expect(page.locator('.sr-only[role="status"]')).toHaveText('Stole Diamond Polish for free. Thefts remaining: 1.');
  await page.getByRole('button', { name: '切换到中文', exact: true }).click();
  expect(await readGame(page)).toEqual(after);
  await expect(page.getByRole('button', { name: '大力水已购买', exact: true })).toBeDisabled();
  await expect(page.locator('.sr-only[role="status"]')).toHaveText('已免费取得钻石抛光剂，剩余1次。');
  const unsold = after.shop.flatMap((item, index) => item.bought === 0 ? [index] : []);
  for (const index of unsold) await expect(page.locator('.item-price').nth(index)).toHaveText(prices[index]);
});

test('co-op results and bank bonuses switch without paying rewards a second time', async ({ page }) => {
  await openFixture(page, '/tests/abilities.html?scenario=draft-time-bank&mode=coop', 'en');
  await page.getByRole('button', { name: 'Choose ability: Time Bank', exact: true }).click();
  await page.getByRole('button', { name: 'Next stage', exact: true }).click();
  await page.getByRole('button', { name: 'Finish early', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Stage cleared', exact: true })).toBeVisible();
  await expect(page.getByTestId('time-bank-bonus')).toHaveText('Time Bank +$2,000');
  await expect(page.getByLabel('Player 2 earnings this stage', { exact: true })).toBeVisible();
  const before = await readGame(page);
  await page.getByRole('button', { name: '切换到中文', exact: true }).click();
  await expect(page.getByTestId('time-bank-bonus')).toHaveText('时间银行 +$2,000');
  expect(await readGame(page)).toEqual(before);
});

test('fossil rewards and existing warnings are translated rather than re-created', async ({ page }) => {
  await openFixture(page, '/tests/abilities.html?scenario=fossil-puzzle', 'en');
  await page.getByRole('button', { name: 'Resume mining', exact: true }).click();
  await fireAt(page, ['bone-large']);
  await settleHooks(page);
  await fireAt(page, ['bone-small']);
  await settleHooks(page);
  await page.getByRole('button', { name: 'Finish early', exact: true }).click();
  await expect(page.getByTestId('fossil-bonus')).toHaveText('Fossil Puzzle +$500');
  await page.getByRole('button', { name: 'Back to camp', exact: true }).click();
  await page.getByRole('button', { name: 'Start solo game', exact: true }).click();
  await page.locator('.ability-card').first().click();
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('.warning-icon')).toHaveAttribute('aria-label', /No dynamite left/);
  const before = await readGame(page);
  await page.getByRole('button', { name: '切换到中文', exact: true }).click();
  await expect(page.locator('.warning-icon')).toHaveAttribute('aria-label', /没有炸药/);
  expect(await readGame(page)).toEqual(before);
});

test('the empty shop and failed-run controls work in English', async ({ page }) => {
  await openFixture(page, '/tests/abilities.html?scenario=empty-shop', 'en');
  await expect(page.locator('.empty-shop')).toHaveText('No supplies this visit');
  await page.getByRole('button', { name: 'Next stage', exact: true }).click();
  await page.clock.fastForward(60_000);
  await expect(page.getByRole('region', { name: 'Run over', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Choose an ability', exact: true })).toBeVisible();
});

test('an existing canvas reward switches language as well as its inventory badge', async ({ page }) => {
  await page.addInitScript(() => {
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
      if (this.canvas.classList.contains('mine-canvas') && (text === '本关生力' || text === 'Fast hauling')) {
        document.documentElement.dataset.rewardText = text;
      }
      return maxWidth === undefined ? fillText.call(this, text, x, y) : fillText.call(this, text, x, y, maxWidth);
    };
  });
  await openFixture(page, '/tests/abilities.html?scenario=bag-strength&ability=might');
  await page.getByRole('button', { name: '继续挖矿', exact: true }).click();
  await catchAt(page, ['bag']);
  await settleHooks(page);
  await expect(page.locator('html')).toHaveAttribute('data-reward-text', '本关生力');
  await page.getByRole('button', { name: 'Switch to English', exact: true }).click();
  await page.clock.runFor(32);
  await expect(page.locator('html')).toHaveAttribute('data-reward-text', 'Fast hauling');
  await expect(page.getByTestId('bag-strength')).toHaveText('Fast');
  await page.getByRole('button', { name: '切换到中文', exact: true }).click();
  await page.clock.runFor(32);
  await expect(page.locator('html')).toHaveAttribute('data-reward-text', '本关生力');
});

for (const issue of ['storage', 'audio'] as const) {
  test(`${issue} errors remain explicit and follow the selected language`, async ({ page }) => {
    await page.addInitScript(({ key, issue }) => {
      localStorage.setItem(key, JSON.stringify({ sound: true, language: 'en', records: { solo: 0, coop: 0 } }));
      if (issue === 'storage') {
        Storage.prototype.setItem = () => { throw new DOMException('Blocked by test', 'SecurityError'); };
      } else {
        Object.defineProperty(window, 'AudioContext', {
          value: class { constructor() { throw new Error('Audio blocked by test'); } },
        });
      }
    }, { key: preferenceKey, issue });
    await page.goto('/');
    if (issue === 'audio') await page.getByRole('button', { name: 'Start solo game', exact: true }).click();
    const warning = page.locator('.warning-icon');
    if (issue === 'audio') await page.locator('.ability-card').first().click();
    await expect(warning).toHaveAttribute('aria-label', issue === 'storage' ? /Local saving is unavailable/ : /Audio could not be started/);
    await page.getByRole('button', { name: '切换到中文', exact: true }).click();
    await expect(warning).toHaveAttribute('aria-label', issue === 'storage' ? /未允许本地存档/ : /未能启用声音/);
  });
}

for (const ability of ABILITIES) {
  test(`English ${ability.id} cards fit the narrow three-choice layout`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await openFixture(page, `/tests/abilities.html?scenario=draft-language&ability=${ability.id}`, 'en');
    const copy = getAbility(ability.id, 'solo', 'en');
    const card = page.getByRole('button', { name: `Choose ability: ${copy.name}`, exact: true });
    await expect(card).toContainText(copy.description);
    await expectFits(card);
    await expectFits(card.locator('strong'));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('dialog').getByRole('button', { name: '切换到中文', exact: true }).click();
    await expect(page.locator(`[data-ability="${ability.id}"] > strong`)).toHaveText(ability.name['zh-CN']);
    if (ability.id === 'archaeologist') {
      await page.getByRole('dialog').getByRole('button', { name: 'Switch to English', exact: true }).click();
      await page.screenshot({ path: testInfo.outputPath('english-narrow-draft.png'), animations: 'disabled' });
    }
  });
}

for (const width of [320, 390]) {
  test(`the language entry stays clear of full inventory and ability icons at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await openFixture(page, '/tests/abilities.html?scenario=empowered-mine&mode=coop&inventory=full', 'en');
    await page.getByRole('button', { name: 'Resume mining', exact: true }).click();
    const toggle = page.getByRole('button', { name: '切换到中文', exact: true });
    await expect(toggle).toBeVisible();
    const button = await toggle.boundingBox();
    if (!button) throw new Error('Missing language control.');
    for (const selector of ['.inventory', '.ability-rack']) {
      const other = await page.locator(selector).boundingBox();
      if (!other) throw new Error(`Missing ${selector}.`);
      expect(button.x + button.width <= other.x || other.x + other.width <= button.x
        || button.y + button.height <= other.y || other.y + other.height <= button.y).toBe(true);
    }
    await expectFits(toggle);
    await page.screenshot({ path: testInfo.outputPath(`english-inventory-${width}.png`), animations: 'disabled' });
    await toggle.click();
    await expect(page.getByRole('button', { name: 'Switch to English', exact: true })).toBeVisible();
  });
}
