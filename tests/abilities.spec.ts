import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { catchAt, fireAt, readGame, settleHooks } from './game-driver';

async function freeze(page: Page, path: string): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('gold-miner.preferences.v1', JSON.stringify({ sound: false, records: { solo: 0, coop: 0 } }));
  });
  await page.clock.install({ time: new Date('2026-09-19T12:00:00Z') });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(path);
  await page.locator('.hud').waitFor();
  await page.clock.pauseAt(new Date('2026-09-19T13:00:00Z'));
}

test('requires one unique three-card choice before the shared countdown can start', async ({ page }, testInfo) => {
  await freeze(page, '/tests/game.html');
  await page.getByRole('button', { name: '开始双人游戏' }).click();
  const draft = page.getByRole('dialog', { name: '选择能力' });
  await expect(draft).toBeVisible();
  await expect(page.locator('.ability-card')).toHaveCount(3);
  const offers = await page.locator('.ability-card').evaluateAll((cards) => cards.map((card) => card.getAttribute('data-ability')));
  expect(new Set(offers).size).toBe(3);
  await expect(draft.getByRole('button')).toHaveCount(4);
  await expect(draft.locator('.ability-draft-actions, .ability-pick-count, .ability-card-select, .ability-draft-progress')).toHaveCount(0);
  await expect(draft.locator('[title]')).toHaveCount(0);
  await page.locator('.ability-card').first().focus();
  await page.clock.fastForward(300_000);
  await expect(page.getByTestId('timer')).toHaveText('—');
  await page.keyboard.press('Escape');
  await expect(draft).toBeVisible();
  await page.keyboard.press('s');
  await expect(page.locator('.ability-card').nth(1)).toBeFocused();
  await expect(page.locator('[data-player="1"]')).toHaveAttribute('data-hook-phase', 'swinging');
  await expect(page.locator('[data-player="2"]')).toHaveAttribute('data-hook-phase', 'swinging');
  await page.screenshot({ path: testInfo.outputPath('ability-draft.png'), animations: 'disabled' });
  await page.keyboard.press('Enter');
  await expect(draft).not.toBeVisible();
  await expect(page.locator('[data-owned-ability]')).toHaveCount(1);
  await expect(page.getByTestId('timer')).toHaveText('40');
  await page.clock.runFor(1200);
  await expect(page.getByTestId('timer')).toHaveText('39');
});

for (const mode of ['solo', 'coop'] as const) {
  test(`all four ${mode} drafts offer twelve different cards and restart restores skipped choices`, async ({ page }) => {
    if (mode === 'coop') await page.setViewportSize({ width: 390, height: 844 });
    await freeze(page, `/tests/abilities.html?scenario=draft-run&mode=${mode}`);
    const seen = new Set<string>();
    let firstOffers: string[] = [];
    for (let level = 1; level <= 10; level++) {
      if ([1, 4, 7, 10].includes(level)) {
        await expect(page.getByRole('dialog', { name: '选择能力' })).toBeVisible();
        await expect(page.locator('.ability-card')).toHaveCount(3);
        const offers = await page.locator('.ability-card').evaluateAll((cards) => cards.map((card) => {
          const id = card.getAttribute('data-ability');
          if (!id) throw new Error('A draft card is missing its ability ID.');
          return id;
        }));
        for (const id of offers) {
          expect(seen.has(id)).toBe(false);
          seen.add(id);
        }
        if (level === 1) firstOffers = offers;
        await page.locator('.ability-card').nth(mode === 'solo' ? 0 : 2).click();
        if (level > 1) await page.getByRole('button', { name: '下一关', exact: true }).click();
      }
      await expect(page.locator('.game-frame')).toHaveClass('game-frame phase-playing');
      if (level === 10) break;
      await page.getByRole('button', { name: '提前收工' }).click();
      await page.getByRole('button', { name: '去补给商店' }).click();
      if (![4, 7, 10].includes(level + 1)) {
        await page.getByRole('button', { name: '下一关', exact: true }).click();
      }
    }
    expect(seen.size).toBe(12);
    await expect(page.locator('[data-owned-ability]')).toHaveCount(4);
    await page.getByRole('button', { name: '暂停游戏' }).click();
    await page.getByRole('button', { name: '重新开始', exact: true }).click();
    await expect(page.locator('[data-owned-ability]')).toHaveCount(0);
    await expect(page.locator('.ability-card')).toHaveCount(3);
    expect(await page.locator('.ability-card').evaluateAll((cards) => cards.map((card) => card.getAttribute('data-ability'))))
      .toEqual(firstOffers);
  });
}

test('a choice before stage 4 stays frozen and a newly chosen thief works in that shop', async ({ page }) => {
  await freeze(page, '/tests/abilities.html?scenario=draft-four&mode=coop');
  await expect(page.locator('.level-stat strong')).toHaveText('04');
  await expect(page.getByRole('dialog', { name: '选择能力' })).toBeVisible();
  await expect(page.locator('.ability-pick-count')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '选择能力：射线', exact: true })).toHaveCount(0);
  await page.clock.fastForward(180_000);
  await expect(page.getByTestId('timer')).toHaveText('—');
  await page.getByRole('button', { name: '选择能力：窃贼', exact: true }).click();
  await expect(page.getByRole('region', { name: '补给商店' })).toBeVisible();
  await expect(page.getByTestId('steals')).toHaveText('2');
  await expect(page.locator('[data-owned-ability]')).toHaveCount(2);
  const wallet = await page.getByTestId('score').innerText();
  await page.getByRole('button', { name: '免费偷取大力水' }).click();
  await page.getByRole('button', { name: '免费偷取钻石抛光剂' }).click();
  await expect(page.getByTestId('score')).toHaveText(wallet);
  await expect(page.getByTestId('steals')).toHaveText('0');
  await page.clock.fastForward(180_000);
  await expect(page.getByTestId('timer')).toHaveText('—');
  await page.getByRole('button', { name: '下一关', exact: true }).click();
  await expect(page.getByTestId('timer')).toHaveText('40');
  await expect(page.locator('.active-upgrade[data-upgrade="strength"]')).toHaveCount(1);
  await expect(page.locator('.active-upgrade[data-upgrade="polish"]')).toHaveCount(1);
});

test('steals chosen inventory units even without money, but only twice in one visit', async ({ page }, testInfo) => {
  await freeze(page, '/tests/abilities.html?scenario=thief-shop');
  await expect(page.getByTestId('score')).toHaveText('$0');
  await expect(page.getByRole('button', { name: /^购买一捆炸药 / })).toBeDisabled();
  await expect(page.getByRole('button', { name: '免费偷取一捆炸药' })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('thief-shop.png'), animations: 'disabled' });
  await page.getByRole('button', { name: '免费偷取一捆炸药' }).click();
  await expect(page.getByRole('button', { name: '免费偷取一捆炸药' })).toBeDisabled();
  await expect(page.getByTestId('steals')).toHaveText('1');
  await page.getByRole('button', { name: '免费偷取大力水' }).click();
  await expect(page.getByTestId('steals')).toHaveText('0');
  await expect(page.getByTestId('dynamite')).toHaveText('2');
  await expect(page.getByRole('button', { name: '免费偷取大力水' })).toBeDisabled();
  await page.getByRole('button', { name: '开启声音' }).click();
  await expect(page.getByTestId('steals')).toHaveText('0');
  await expect(page.getByTestId('score')).toHaveText('$0');
});

test('an empty original shop stays empty and does not manufacture items for a thief', async ({ page }) => {
  await freeze(page, '/tests/abilities.html?scenario=empty-shop');
  await expect(page.locator('.shop-item')).toHaveCount(0);
  await expect(page.locator('.empty-shop')).toHaveText('本次暂无补给');
  await expect(page.getByTestId('steals')).toHaveText('2');
  await page.clock.fastForward(5000);
  await expect(page.locator('.shop-item')).toHaveCount(0);
  await page.getByRole('button', { name: '下一关', exact: true }).click();
  await expect(page.getByTestId('timer')).toHaveText('60');
});
test('far-future shops retain normal prices, paid purchases, and free thefts', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await freeze(page, '/tests/abilities.html?scenario=late-shop');
  await expect(page.locator('.shop-item')).toHaveCount(5);
  await expect(page.locator('.unpayable-price')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '购买大力水 $130' })).toBeEnabled();
  await page.getByRole('button', { name: '购买大力水 $130' }).click();
  await expect(page.getByTestId('score')).toHaveText('$870');
  await page.getByRole('button', { name: '免费偷取钻石抛光剂' }).click();
  await expect(page.getByTestId('steals')).toHaveText('1');
  await expect(page.getByTestId('score')).toHaveText('$870');
  await expect(page.locator('.active-upgrade[data-upgrade="strength"]')).toHaveCount(1);
  await expect(page.locator('.active-upgrade[data-upgrade="polish"]')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const [scenario, payout] of [
  ['empowered-mine', '$50'], ['alchemy', '$650'], ['diamond-vein', '$1,035'], ['moneybags', '$600'],
  ['risk-gold', '$975'], ['risk-gold-far', '$650'], ['risk-diamond', '$1,553'], ['risk-mole', '$1,555'],
] as const) {
  test(`${scenario} changes actual browser mining and pays ${payout}`, async ({ page }, testInfo) => {
    await freeze(page, `/tests/abilities.html?scenario=${scenario}`);
    await expect(page.locator('[data-owned-ability]')).toHaveCount(4);
    if (scenario === 'empowered-mine') {
      await expect(page.locator('[data-owned-ability="wide-claw"]')).not.toHaveAttribute('title');
      await expect(page.locator('[data-owned-ability="wide-claw"]')).toHaveAccessibleName('查看能力：深渊巨口');
    }
    await page.getByRole('button', { name: '继续挖矿' }).click();
    await page.keyboard.press('ArrowDown');
    await page.clock.runFor(350);
    if (scenario === 'diamond-vein') {
      expect((await readGame(page)).entities.find((entity) => entity.id === 1))
        .toMatchObject({ kind: 'diamond', weight: 2, radius: 18, value: 900, claimedBy: 1 });
    }
    await page.screenshot({ path: testInfo.outputPath(`${scenario}.png`), animations: 'disabled' });
    await page.clock.runFor(4500);
    await expect(page.getByTestId('score')).toHaveText(payout);
    await expect(page.getByTestId('dynamite')).toHaveText('1');
    await expect(page.getByTestId('bag-strength')).toHaveCount(0);
    await expect(page.locator('.game-frame')).toHaveClass('game-frame phase-playing');
  });
}

test('risk reward has its own artwork, description, and selectable permanent card', async ({ page }, testInfo) => {
  await freeze(page, '/tests/abilities.html?scenario=draft-risk');
  const card = page.getByRole('button', { name: '选择能力：富贵险中求', exact: true });
  await expect(card).toBeVisible();
  await expect(card).toContainText('50%');
  await page.screenshot({ path: testInfo.outputPath('risk-reward-card.png'), animations: 'disabled' });
  await card.click();
  await expect(page.locator('[data-owned-ability="risk-reward"]')).toHaveCount(1);
  await expect(page.getByRole('region', { name: '补给商店' })).toBeVisible();
  await page.getByRole('button', { name: '下一关', exact: true }).click();
  await expect(page.locator('[data-owned-ability="risk-reward"]')).toHaveCount(1);
  await page.getByRole('button', { name: '查看能力：富贵险中求', exact: true }).hover();
  await expect(page.getByRole('tooltip')).toContainText('价值增加50%');
  await expect(page.getByRole('tooltip')).toContainText('爆炸半径75%');
});

for (const [mode, cap, baseDuration, wallet] of [
  ['solo', 3000, 60, '$6,095'],
  ['coop', 2000, 40, '$5,095'],
] as const) {
  test(`time bank pays ${mode} early-finish cash without extending the next countdown`, async ({ page }, testInfo) => {
    if (mode === 'coop') await page.setViewportSize({ width: 390, height: 844 });
    await freeze(page, `/tests/abilities.html?scenario=draft-time-bank&mode=${mode}`);
    const card = page.getByRole('button', { name: '选择能力：时间银行', exact: true });
    await expect(card).toContainText('提前过关时，每剩余1秒获得50元');
    await expect(card).not.toContainText('带到下一关');
    expect(await card.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    const timeArt = await card.locator('canvas').evaluate((canvas) => {
      if (!(canvas instanceof HTMLCanvasElement)) throw new Error('The time bank artwork was not rendered.');
      return canvas.toDataURL();
    });
    const thiefArt = await page.locator('[data-ability="thief"] canvas').evaluate((canvas) => {
      if (!(canvas instanceof HTMLCanvasElement)) throw new Error('The thief artwork was not rendered.');
      return canvas.toDataURL();
    });
    expect(timeArt).not.toBe(thiefArt);
    await page.screenshot({ path: testInfo.outputPath(`time-bank-${mode}-card.png`), animations: 'disabled' });
    await card.click();
    const icon = page.getByRole('button', { name: '查看能力：时间银行', exact: true });
    await icon.focus();
    await expect(page.getByRole('tooltip')).toContainText(`最多${cap}元`);
    await expect(page.getByRole('tooltip')).toContainText('不再延长下一关');
    await page.screenshot({ path: testInfo.outputPath(`time-bank-${mode}-tooltip.png`), animations: 'disabled' });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '下一关', exact: true }).click();
    await expect(page.getByTestId('timer')).toHaveText(String(baseDuration));
    await page.getByRole('button', { name: '提前收工' }).click();
    await expect(page.getByTestId('score')).toHaveText(wallet);
    await expect(page.getByTestId('time-bank-bonus')).toHaveText(`时间银行 +$${cap.toLocaleString('en-US')}`);
    await page.screenshot({ path: testInfo.outputPath(`time-bank-${mode}-cash.png`), animations: 'disabled' });
    await page.getByRole('button', { name: '去补给商店' }).click();
    await page.clock.fastForward(180_000);
    await expect(page.getByTestId('timer')).toHaveText('—');
    await page.getByRole('button', { name: '下一关', exact: true }).click();
    await expect(page.getByTestId('timer')).toHaveText(String(baseDuration));
    await expect(page.getByTestId('score')).toHaveText(wallet);
    await expect(page.locator('[data-owned-ability="time-bank"]')).toHaveCount(1);
  });
}

for (const [id, name, effect, detail, mode, duration] of [
  ['gold-collector', '金块收藏家', '价值增加30%', '包括点石成金产生的黄金', 'solo', 60],
  ['diamond-collector', '钻石收藏家', '价值增加15%', '乘算至1035元', 'solo', 60],
  ['alchemy', '点石成金', '40%概率变成大金块', '也可继续触发璀璨胜金', 'solo', 60],
  ['diamond-vein', '璀璨胜金', '抓到任意黄金时，20%概率变成钻石', '价值和重量同步变为钻石', 'solo', 60],
  ['airy-moles', '透气的鼹鼠', '更容易出现在矿场中上层', '不再改变移动速度或回拉重量', 'solo', 60],
  ['slow-fuse', '慢燃引信', '延迟3秒爆炸', '与拆弹专家互斥', 'solo', 60],
  ['time-rush', '争分夺秒', '基础时间缩短20%，黄金和钻石价值增加40%', '不改变目标金币', 'solo', 48],
  ['time-rush', '争分夺秒', '基础时间缩短20%，黄金和钻石价值增加40%', '不改变目标金币', 'coop', 32],
  ['regular-customer', '老主顾', '必有大力水、三叶草和钻石抛光剂', '限购1件', 'solo', 60],
  ['archaeologist', '考古学家', '长骨140元、头骨400元，每关额外出现各1件', '重量保持不变', 'solo', 60],
  ['clone', '克隆', '最终收益翻倍', '全队共享1次', 'solo', 60],
  ['fossil-puzzle', '化石拼图', '额外获得500元', '全队共享每关1次', 'solo', 60],
  ['gold-growth', '黄金生长', '每5秒，随机一颗黄金长大一档', '每次仅1颗', 'solo', 60],
  ['gold-growth', '黄金生长', '每5秒，随机一颗黄金长大一档', '每次仅1颗', 'coop', 40],
  ['buzzer-delivery', '压哨交货', '钩上货物直接结算，金币价值乘2', '结算后再判断过关', 'solo', 60],
] as const) {
  test(`${id} has its own selectable artwork and complete ${mode} descriptions`, async ({ page }, testInfo) => {
    if (mode === 'coop' || id === 'airy-moles' || id === 'archaeologist') {
      await page.setViewportSize({ width: 390, height: 844 });
    }
    await freeze(page, `/tests/abilities.html?scenario=draft-new&ability=${id}&mode=${mode}`);
    const card = page.getByRole('button', { name: `选择能力：${name}`, exact: true });
    await expect(card).toContainText(effect);
    expect(await card.evaluate((element) => element.scrollWidth <= element.clientWidth + 1
      && element.scrollHeight <= element.clientHeight + 1)).toBe(true);
    const illustrations = await page.locator('.ability-card canvas').evaluateAll((canvases) => canvases.map((canvas) => {
      if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Ability artwork was not rendered.');
      return canvas.toDataURL();
    }));
    expect(new Set(illustrations).size).toBe(3);
    await page.screenshot({ path: testInfo.outputPath(`${id}-${mode}-card.png`), animations: 'disabled' });
    await card.click();
    const icon = page.getByRole('button', { name: `查看能力：${name}`, exact: true });
    await icon.focus();
    await expect(page.getByRole('tooltip')).toContainText(effect);
    await expect(page.getByRole('tooltip')).toContainText(detail);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '下一关', exact: true }).click();
    await expect(page.getByTestId('timer')).toHaveText(String(duration));
    await expect(page.locator(`[data-owned-ability="${id}"]`)).toHaveCount(1);
    if (id === 'archaeologist' || id === 'fossil-puzzle') {
      const entities = (await readGame(page)).entities;
      expect(entities.filter((entity) => entity.kind === 'bone-small')).toHaveLength(1);
      expect(entities.filter((entity) => entity.kind === 'bone-large')).toHaveLength(1);
    }
    if (id === 'airy-moles') {
      const moles = (await readGame(page)).entities.filter((entity) => entity.kind.startsWith('mole'));
      expect(moles.filter((entity) => entity.kind === 'mole').length).toBeGreaterThan(0);
      expect(moles.filter((entity) => entity.kind === 'mole-diamond')).toHaveLength(1);
      for (const mole of moles) {
        expect(mole.speed).toBeCloseTo(mole.kind === 'mole' ? 34 : 44);
        expect(mole.weight).toBe(mole.kind === 'mole' ? 3 : 5);
        expect(mole.y + mole.radius).toBeLessThanOrEqual(353.34);
      }
    }
  });
}

test('fossil puzzle pays a shared $500 completion bonus on top of both archaeological bones', async ({ page }, testInfo) => {
  await freeze(page, '/tests/abilities.html?scenario=fossil-puzzle');
  await page.getByRole('button', { name: '继续挖矿' }).click();
  await fireAt(page, ['bone-large']);
  await settleHooks(page);
  await expect(page.getByTestId('score')).toHaveText('$400');
  await fireAt(page, ['bone-small']);
  await settleHooks(page);
  await expect(page.getByTestId('score')).toHaveText('$1,040');
  await page.getByRole('button', { name: '提前收工' }).click();
  await expect(page.getByRole('region', { name: '过关', exact: true })).toBeVisible();
  await expect(page.getByTestId('fossil-bonus')).toHaveText('化石拼图 +$500');
  await page.screenshot({ path: testInfo.outputPath('fossil-puzzle-result.png'), animations: 'disabled' });
});

for (const mode of ['solo', 'coop'] as const) {
  test(`gold growth changes only one real ${mode} nugget each five seconds and pauses with the mine`, async ({ page }, testInfo) => {
    await freeze(page, `/tests/abilities.html?scenario=gold-growth&mode=${mode}`);
    await page.getByRole('button', { name: '继续挖矿' }).click();
    await page.clock.runFor(4950);
    expect((await readGame(page)).entities.map((entity) => entity.value)).toEqual([50, 100, 250, 500]);
    await page.clock.runFor(100);
    expect((await readGame(page)).entities.map((entity) => entity.value)).toEqual([50, 250, 250, 500]);
    await page.screenshot({ path: testInfo.outputPath(`gold-growth-${mode}.png`), animations: 'disabled' });
    await page.getByRole('button', { name: '暂停游戏' }).click();
    await page.clock.fastForward(20_000);
    expect((await readGame(page)).entities.map((entity) => entity.value)).toEqual([50, 250, 250, 500]);
    await page.getByRole('button', { name: '继续挖矿' }).click();
    await page.clock.runFor(5000);
    expect((await readGame(page)).entities.map((entity) => entity.value)).toEqual([50, 500, 250, 500]);
  });
}

test('buzzer delivery credits a heavy cloned nugget still on the hook at zero', async ({ page }, testInfo) => {
  await freeze(page, '/tests/abilities.html?scenario=buzzer-delivery');
  await page.getByRole('button', { name: '继续挖矿' }).click();
  await catchAt(page, ['gold-large']);
  await expect(page.getByTestId('score')).toHaveText('$0');
  await page.clock.runFor(1000);
  await expect(page.getByTestId('timer')).toHaveText('00');
  await expect(page.getByTestId('score')).toHaveText('$2,600');
  await expect(page.getByRole('region', { name: '过关', exact: true })).toBeVisible();
  await expect(page.getByTestId('time-bank-bonus')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('buzzer-delivery-result.png'), animations: 'disabled' });
});

test('cloning a polished collector diamond visibly pays $2070', async ({ page }, testInfo) => {
  await freeze(page, '/tests/abilities.html?scenario=clone-diamond');
  await page.getByRole('button', { name: '继续挖矿' }).click();
  const diamond = await catchAt(page, ['diamond']);
  expect((await readGame(page)).clonedEntityId).toBe(diamond.id);
  await page.screenshot({ path: testInfo.outputPath('cloned-diamond-cargo.png'), animations: 'disabled' });
  await settleHooks(page);
  await expect(page.getByTestId('score')).toHaveText('$2,070');
});

test('archaeologist pays $400 for a skull and $140 for a long bone in actual mining', async ({ page }) => {
  await freeze(page, '/tests/abilities.html?scenario=archaeology');
  await page.getByRole('button', { name: '继续挖矿' }).click();
  await fireAt(page, ['bone-large']);
  await settleHooks(page);
  await expect(page.getByTestId('score')).toHaveText('$400');
  await fireAt(page, ['bone-small']);
  await settleHooks(page);
  await expect(page.getByTestId('score')).toHaveText('$540');
});

test('regular customer guarantees three supplies without giving the shared thief a third theft', async ({ page }) => {
  await freeze(page, '/tests/abilities.html?scenario=regular-shop&mode=coop');
  await expect(page.locator('.shop-item')).toHaveCount(3);
  await expect(page.getByRole('button', { name: '购买大力水 $397' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '购买钻石抛光剂 $300' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '购买幸运四叶草 $52' })).toBeDisabled();
  await page.getByRole('button', { name: '免费偷取大力水' }).click();
  await page.getByRole('button', { name: '免费偷取幸运四叶草' }).click();
  await expect(page.getByRole('button', { name: '免费偷取钻石抛光剂' })).toBeDisabled();
  await expect(page.getByTestId('steals')).toHaveText('0');
  await expect(page.getByTestId('score')).toHaveText('$0');
  await page.getByRole('button', { name: '下一关', exact: true }).click();
  await expect(page.locator('.active-upgrade')).toHaveCount(2);
  await expect(page.locator('.active-upgrade[data-upgrade="luck"]')).toBeVisible();
});

test('slow fuse visibly counts down, freezes on pause, and lets a cloned risk reward escape', async ({ page }, testInfo) => {
  await freeze(page, '/tests/abilities.html?scenario=fuse-clone');
  await page.getByRole('button', { name: '继续挖矿' }).click();
  await fireAt(page, ['tnt']);
  let state = await readGame(page);
  for (let frame = 0; frame < 60 && state.entities[0].fuseRemaining === null; frame++) {
    await page.clock.runFor(16);
    state = await readGame(page);
  }
  expect(state.entities[0].fuseRemaining).toBeGreaterThan(2.9);
  expect(state.players[0].phase).toBe('extending');
  expect(state.clonedEntityId).toBeNull();
  await page.keyboard.press('Escape');
  await page.clock.runFor(2000);
  expect((await readGame(page)).entities[0].fuseRemaining).toBe(state.entities[0].fuseRemaining);
  await page.keyboard.press('Escape');
  await page.clock.runFor(400);
  expect((await readGame(page)).clonedEntityId).toBe(2);
  await page.screenshot({ path: testInfo.outputPath('slow-fuse-and-clone.png'), animations: 'disabled' });
  await settleHooks(page);
  await expect(page.getByTestId('score')).toHaveText('$150');
  await page.clock.runFor(3500);
  expect((await readGame(page)).entities[0].active).toBe(false);
  await expect(page.getByTestId('score')).toHaveText('$150');
});

test('a local chain explosion returns a one-dollar fragment and leaves distant TNT intact', async ({ page }, testInfo) => {
  await freeze(page, '/tests/abilities.html?scenario=tnt-fragment');
  await page.getByRole('button', { name: '继续挖矿' }).click();
  const charge = await catchAt(page, ['tnt']);
  const state = await readGame(page);
  expect(state.entities.find((entity) => entity.id === charge.id)).toMatchObject({
    kind: 'tnt-fragment', value: 1, weight: 2, claimedBy: 1,
  });
  expect(state.entities.filter((entity) => entity.kind === 'tnt' && entity.active).map((entity) => entity.id)).toEqual([6]);
  expect(state.particles.filter((particle) => particle.kind === 'blast').map((particle) => particle.size)).toEqual([250, 250]);
  expect(state.entities.find((entity) => entity.id === 5)?.active).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('tnt-fragment-cargo.png'), animations: 'disabled' });
  await settleHooks(page);
  await expect(page.getByTestId('score')).toHaveText('$1');
});

for (const ability of ['aim-line', 'might'] as const) {
  test(`a strength bag with ${ability} activates on collection, lasts beyond 25 seconds, and clears in the shop`, async ({ page }) => {
    await freeze(page, `/tests/abilities.html?scenario=bag-strength&ability=${ability}`);
    expect((await readGame(page)).abilities).toContain(ability);
    await page.getByRole('button', { name: '继续挖矿' }).click();
    await page.keyboard.press('ArrowDown');
    await page.clock.runFor(500);
    await expect(page.getByTestId('bag-strength')).toHaveCount(0);
    await page.clock.runFor(3000);
    await expect(page.getByTestId('bag-strength')).toBeVisible();
    await expect(page.getByTestId('bag-strength')).toHaveText('快');
    await page.clock.fastForward(30_000);
    await expect(page.getByTestId('bag-strength')).toBeVisible();
    await page.getByRole('button', { name: '提前收工' }).click();
    await page.getByRole('button', { name: '去补给商店' }).click();
    await expect(page.getByTestId('bag-strength')).toHaveCount(0);
    await page.getByRole('button', { name: '下一关', exact: true }).click();
    await expect(page.getByTestId('bag-strength')).toHaveCount(0);
  });
}

test('stones and bones have distinct artwork, and both bone variants can be collected', async ({ page }, testInfo) => {
  await freeze(page, '/tests/abilities.html?scenario=loot-art');
  await page.getByRole('button', { name: '继续挖矿' }).click();
  await page.clock.runFor(16);
  await page.screenshot({ path: testInfo.outputPath('stone-bone-variants.png'), animations: 'disabled' });
  const hook = page.locator('[data-player="1"]');
  for (const [degrees, score] of [[55, '$20'], [27, '$27']] as const) {
    let launched = false;
    for (let frame = 0; frame < 500; frame++) {
      const angle = Number(await hook.getAttribute('data-angle'));
      if (await hook.getAttribute('data-hook-phase') === 'swinging' && Math.abs(angle - degrees) <= 2) {
        await page.keyboard.press('ArrowDown');
        launched = true;
        break;
      }
      await page.clock.runFor(16);
    }
    expect(launched).toBe(true);
    await page.clock.runFor(4000);
    await expect(page.getByTestId('score')).toHaveText(score);
  }
});

test('mobile ability cards are all readable and selectable before the first countdown', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await freeze(page, '/tests/game.html');
  await page.getByRole('button', { name: '开始单人游戏' }).click();
  await expect(page.locator('.ability-card')).toHaveCount(3);
  for (const card of await page.locator('.ability-card').all()) {
    await expect(card).toBeVisible();
    const fits = await card.evaluate((element) => element.scrollWidth <= element.clientWidth + 1);
    expect(fits).toBe(true);
  }
  await page.screenshot({ path: testInfo.outputPath('mobile-ability-draft.png'), animations: 'disabled' });
  await page.getByRole('button', { name: '选择能力：射线', exact: true }).click();
  await expect(page.getByTestId('timer')).toHaveText('60');
  await page.getByRole('button', { name: '玩家1下钩' }).click();
  await expect(page.locator('[data-player="1"]')).toHaveAttribute('data-hook-phase', 'extending');
});

test('the simplified draft has only three choices and a language switch, without progress chrome or badges', async ({ page }, testInfo) => {
  await freeze(page, '/tests/abilities.html?scenario=draft-clean');
  const draft = page.getByRole('dialog', { name: '选择能力' });
  await expect(draft.getByRole('button')).toHaveCount(4);
  await expect(draft.locator('.ability-card')).toHaveCount(3);
  await expect(draft.getByRole('button', { name: 'Switch to English', exact: true })).toBeVisible();
  await expect(draft.locator('svg, .ability-draft-actions, .ability-pick-count, .ability-card-select, .ability-draft-progress')).toHaveCount(0);
  const greenBadgePixels = await draft.locator('[data-ability="bomb-expert"] canvas').evaluate((element) => {
    if (!(element instanceof HTMLCanvasElement)) throw new Error('The card artwork was not rendered.');
    const context = element.getContext('2d');
    if (!context) throw new Error('Card Canvas 2D is unavailable.');
    const pixels = context.getImageData(0, 0, element.width, element.height).data;
    let green = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] > 100 && pixels[index + 1] > pixels[index] + 10 && pixels[index + 1] > pixels[index + 2] + 30) green++;
    }
    return green;
  });
  expect(greenBadgePixels).toBe(0);
  await page.screenshot({ path: testInfo.outputPath('simplified-ability-draft.png'), animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath('simplified-mobile-draft.png'), animations: 'disabled' });
  await page.keyboard.press('2');
  await expect(draft).not.toBeVisible();
  await expect(page.locator('[data-owned-ability="wide-claw"]')).toHaveCount(1);
});

test('owned ability tooltips use the game style, stay hoverable, and dismiss without pausing', async ({ page }, testInfo) => {
  await freeze(page, '/tests/abilities.html?scenario=empowered-mine');
  await page.getByRole('button', { name: '继续挖矿' }).click();
  const icon = page.getByRole('button', { name: '查看能力：深渊巨口', exact: true });
  await expect(icon).not.toHaveAttribute('title');
  await icon.hover();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toBeVisible();
  await expect(tooltip.locator('strong')).toHaveText('深渊巨口');
  await expect(tooltip).toContainText('宽度增加100%');
  await expect(tooltip).toContainText('最先碰到的一个目标');
  await expect(icon).toHaveAttribute('aria-describedby', (await tooltip.getAttribute('id'))!);
  await tooltip.hover();
  await expect(tooltip).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('custom-ability-tooltip.png'), animations: 'disabled' });
  await page.mouse.move(700, 500);
  await expect(tooltip).toHaveCount(0);
  await icon.hover();
  await page.keyboard.press('Escape');
  await expect(tooltip).toHaveCount(0);
  await expect(page.locator('.game-frame')).toHaveClass('game-frame phase-playing');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('group', { name: '游戏已暂停' })).toBeVisible();
});

test('keyboard-focused tooltips show full ability details and stay inside a narrow viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await freeze(page, '/tests/abilities.html?scenario=empowered-mine');
  await page.getByRole('button', { name: '继续挖矿' }).click();
  const icon = page.getByRole('button', { name: '查看能力：深渊巨口', exact: true });
  await icon.focus();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await expect(icon).toHaveAccessibleDescription(/钩子宽度增加100%/);
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    const bounds = await page.getByRole('tooltip').boundingBox();
    if (!bounds) throw new Error('The focused ability tooltip is missing.');
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath('mobile-ability-tooltip.png'), animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(page.locator('.game-frame')).toHaveClass('game-frame phase-playing');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('tooltip').locator('strong')).toHaveText('射线');
  await page.locator('.mine-canvas').click({ position: { x: 300, y: 500 } });
  await expect(page.getByRole('tooltip')).toHaveCount(0);
});

test('touch users can tap an owned icon and dismiss its custom tooltip by tapping outside', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await freeze(page, 'http://127.0.0.1:4173/tests/abilities.html?scenario=empowered-mine');
    await page.getByRole('button', { name: '继续挖矿' }).tap();
    await page.getByRole('button', { name: '查看能力：大力', exact: true }).tap();
    await expect(page.getByRole('tooltip').locator('strong')).toHaveText('大力');
    await expect(page.getByRole('tooltip')).toContainText('50%');
    await page.locator('.mine-canvas').tap({ position: { x: 300, y: 500 } });
    await expect(page.getByRole('tooltip')).toHaveCount(0);
  } finally {
    await context.close();
  }
});
