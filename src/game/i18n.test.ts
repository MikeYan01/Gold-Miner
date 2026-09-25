import { describe, expect, it } from 'vitest';
import { ABILITIES, getAbility } from './abilities';
import { GameEngine, hookLabel } from './engine';
import { createShop, getLevelInfo } from './levels';
import { bilingual, getTranslator, localize } from './i18n';

describe('bilingual game text', () => {
  it('resolves both languages and preserves language-neutral currency text', () => {
    const text = bilingual('本关生力', 'Fast hauling');
    expect(localize(text, 'zh-CN')).toBe('本关生力');
    expect(localize(text, 'en')).toBe('Fast hauling');
    expect(localize('+$500', 'en')).toBe('+$500');
    expect(getTranslator('zh-CN')('我的金币', 'Gold')).toBe('我的金币');
    expect(getTranslator('en')('我的金币', 'Gold')).toBe('Gold');
  });

  it.each(ABILITIES.map((ability) => ability.id))('provides complete Chinese and English text for %s', (id) => {
    for (const mode of ['solo', 'coop'] as const) {
      const chinese = getAbility(id, mode, 'zh-CN');
      const english = getAbility(id, mode, 'en');
      expect(chinese).toEqual(getAbility(id, mode));
      expect(english.id).toBe(id);
      for (const key of ['name', 'description', 'detail'] as const) {
        expect(chinese[key]).toMatch(/\p{Script=Han}/u);
        expect(english[key].trim().length).toBeGreaterThan(0);
        expect(english[key]).not.toMatch(/\p{Script=Han}/u);
      }
    }
  });

  it('keeps the current balance and co-op details in the English descriptions', () => {
    expect(getAbility('gold-collector', 'solo', 'en').description).toContain('30%');
    expect(getAbility('diamond-collector', 'solo', 'en').detail).toContain('$1,035');
    expect(getAbility('risk-reward', 'solo', 'en').detail).toContain('75%');
    expect(getAbility('might', 'solo', 'en').detail).toContain('normal prizes');
    expect(getAbility('might', 'solo', 'en').description).toContain('50%');
    expect(getAbility('alchemy', 'solo', 'en').description).toContain('40%');
    expect(getAbility('diamond-vein', 'solo', 'en').description).toContain('20%');
    expect(getAbility('diamond-vein', 'solo', 'en').detail).toContain('One roll at capture');
    expect(getAbility('time-rush', 'solo', 'en').description).toContain('40%');
    expect(getAbility('gold-growth', 'solo', 'en').description).toContain('5 seconds');
    expect(getAbility('buzzer-delivery', 'solo', 'en').description).toContain('2x');
    expect(getAbility('archaeologist', 'solo', 'en').detail).toContain('Adds one long bone and one skull');
    expect(getAbility('fossil-puzzle', 'solo', 'en').detail).toContain('Adds one long bone and one skull');
    expect(getAbility('time-bank', 'solo', 'en').detail).toContain('$3,000');
    expect(getAbility('time-bank', 'coop', 'en').detail).toContain('Shared in co-op.');
    expect(getAbility('time-bank', 'coop', 'en').detail).toContain('$2,000');
  });

  it('keeps all stage and shop copy bilingual, including endless resource categories', () => {
    for (const level of [...Array.from({ length: 20 }, (_, index) => index + 1), 1_000_000]) {
      const info = getLevelInfo(level, 'solo');
      for (const text of [info.name, info.hint]) {
        expect(text['zh-CN']).toMatch(/\p{Script=Han}/u);
        expect(text.en.trim().length).toBeGreaterThan(0);
        expect(text.en).not.toMatch(/\p{Script=Han}/u);
      }
    }
    const shop = createShop(1, { random: () => 0.1 });
    expect(shop).toHaveLength(5);
    for (const item of shop) {
      for (const text of [item.name, item.description, item.tag]) {
        expect(text['zh-CN']).toMatch(/\p{Script=Han}/u);
        expect(text.en.trim().length).toBeGreaterThan(0);
        expect(text.en).not.toMatch(/\p{Script=Han}/u);
      }
    }
    expect(shop.find((item) => item.id === 'strength')?.description.en).toContain('+2');
  });

  it('retains both translations of an existing notice without changing the simulation', () => {
    const engine = new GameEngine(() => 0.1);
    engine.start('solo');
    engine.state.abilityOffers = ['gold-collector', 'might', 'thief'];
    engine.chooseAbility('gold-collector');
    expect(engine.state.notice?.text).toEqual(bilingual('已获得金块收藏家。', 'Acquired Gold Collector.'));
    engine.action(1, 'bomb');
    const before = structuredClone(engine.state);
    const notice = engine.state.notice;
    if (!notice) throw new Error('Expected a no-dynamite warning.');
    expect(localize(notice.text, 'en')).toContain('No dynamite left');
    expect(localize(notice.text, 'zh-CN')).toContain('没有炸药');
    expect(engine.state).toEqual(before);
  });

  it.each(['swinging', 'extending', 'retracting'] as const)('translates the %s hook label', (phase) => {
    expect(hookLabel(phase)).toMatch(/\p{Script=Han}/u);
    expect(hookLabel(phase, 'en')).not.toMatch(/\p{Script=Han}/u);
  });
});
