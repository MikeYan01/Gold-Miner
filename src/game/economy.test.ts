import { describe, expect, it } from 'vitest';
import { originalCategory, originalLevelTarget, originalRoundValue, rollBagReward, rollOriginalBagReward, rollOriginalShop } from './economy';
import { GameEngine } from './engine';
import { applyRoundValue, createLevel, createShop, initialiseBag, makeEntity } from './levels';
import { originalResourceProfile, RESOURCE_KINDS } from './resource-profiles';

describe('original wallet goals and template categories', () => {
  it('matches the original twenty-stage target trace and late samples', () => {
    expect(Array.from({ length: 20 }, (_, index) => originalLevelTarget(index + 1))).toEqual([
      650, 1195, 2010, 3095, 4450, 6075, 7970, 10135, 12570, 15275,
      17980, 20685, 23390, 26095, 28800, 31505, 34210, 36915, 39620, 42325,
    ]);
    expect(originalLevelTarget(30)).toBe(69375);
    expect(originalLevelTarget(100)).toBe(258725);
    expect(originalLevelTarget(1000)).toBe(2693225);
    expect(originalLevelTarget(1_000_000)).toBe(2704988225);
  });

  it('cycles resource categories 4–10 after the tenth displayed stage', () => {
    expect(Array.from({ length: 20 }, (_, index) => originalCategory(index + 1))).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 4, 5, 6, 7, 8, 9, 10, 4, 5, 6,
    ]);
    expect(originalCategory(100)).toBe(9);
    expect(originalCategory(1000)).toBe(6);
  });
});

describe('original resource supply, without copied coordinates', () => {
  const faceValues = [
    [1562, 1612, 1612], [2263, 1763, 1763], [1713, 1713, 1713],
    [877, 1077, 1077], [4227, 3877, 3877], [3651, 3651, 3651],
    [2168, 2168, 2168], [6611, 6611, 5159], [7692, 7692, 4277],
    [4650, 7692, 7692],
  ];

  it('matches the nominal face value of all thirty source profiles', () => {
    for (let category = 1; category <= 10; category++) {
      for (let variant = 1; variant <= 3; variant++) {
        const counts = originalResourceProfile(category, variant);
        const value = RESOURCE_KINDS.reduce((total, kind) => total + counts[kind] * makeEntity(kind, 0, 0, 0).value, 0);
        expect(value, `${category}_${variant}`).toBe(faceValues[category - 1][variant - 1]);
        expect(RESOURCE_KINDS.reduce((sum, kind) => sum + counts[kind], 0)).toBeLessThanOrEqual(27);
      }
    }
  });

  it('preserves the actual rich/poor profile variation rather than filling to the target', () => {
    const poor = originalResourceProfile(11, 2);
    const fixed = RESOURCE_KINDS.reduce((sum, kind) => sum + poor[kind] * makeEntity(kind, 0, 0, 0).value, 0);
    expect(fixed).toBe(1077);
    expect(poor.bag).toBe(2);
    expect(fixed + poor.bag * 800).toBe(2677);
    expect(fixed + poor.bag * 800).toBeLessThan(originalLevelTarget(11) - originalLevelTarget(10));
    expect(originalResourceProfile(8, 1).diamond).toBe(8);
    expect(originalResourceProfile(8, 3)['rock-large']).toBe(9);
  });
});

describe('original shops without compounding inflation', () => {
  it.each([1, 4, 10])('matches every item price endpoint in category %i', (category) => {
    const minimum = rollOriginalShop(category, 0, () => 0);
    expect(minimum.map((item) => item.price)).toEqual([1 + 2 * category, 100, 1 + 2 * category, 1, 201]);
    const draws = [0.999999, 0, 0.999999, 0, 0.999999, 0, 0.999999, 0, 0.999999];
    const maximum = rollOriginalShop(category, 0, () => draws.shift()!);
    expect(maximum.map((item) => item.price)).toEqual([300 + 2 * category, 399, 52 * category, 150, 200 + 100 * category]);
  });

  it('uses completed-stage category rather than the next stage or displayed stage count', () => {
    expect(rollOriginalShop(10, 0, () => 0)).toEqual(rollOriginalShop(17, 0, () => 0));
    expect(rollOriginalShop(11, 0, () => 0)).toEqual(rollOriginalShop(4, 0, () => 0));
  });

  it('uses the source appearance probabilities and permits an empty shop only once dynamite is stocked', () => {
    expect(rollOriginalShop(1, 4, () => 0.99).map((item) => item.id)).toEqual(['dynamite']);
    expect(rollOriginalShop(1, 5, () => 0.99)).toEqual([]);
    expect(rollOriginalShop(1, 5, () => 0.39).map((item) => item.id)).toEqual(['strength', 'luck', 'rockbook', 'polish']);
    expect(rollOriginalShop(1, 5, () => 0.4).map((item) => item.id)).toEqual(['rockbook', 'polish']);
    expect(rollOriginalShop(1, 5, () => 0.5).map((item) => item.id)).toEqual(['rockbook']);
    expect(rollOriginalShop(1, 5, () => 0.6)).toEqual([]);
  });

  it('keeps category-four quotes identical in opening and far-future shops', () => {
    for (const level of [4, 11, 18, 25, 700_004]) {
      const quotes = createShop(level, { random: () => 0.1 }).map(({ id, price, priceText }) => ({ id, price, priceText }));
      expect(quotes).toEqual([
        { id: 'dynamite', price: 39, priceText: '$39' },
        { id: 'strength', price: 130, priceText: '$130' },
        { id: 'luck', price: 29, priceText: '$29' },
        { id: 'rockbook', price: 16, priceText: '$16' },
        { id: 'polish', price: 241, priceText: '$241' },
      ]);
    }
  });

  it('uses a threefold rock book and adds $300 only to the diamond component', () => {
    expect(originalRoundValue('rock-small', 11, ['rockbook'])).toBe(33);
    expect(originalRoundValue('rock-large', 20, ['rockbook'])).toBe(60);
    expect(originalRoundValue('bone-large', 20, ['rockbook'])).toBe(20);
    expect(originalRoundValue('diamond', 600, ['polish'])).toBe(900);
    expect(originalRoundValue('mole-diamond', 602, ['polish'])).toBe(902);
    expect(originalRoundValue('mole', 2, ['polish'])).toBe(2);
  });
});

function draw(face: number, value = 0): () => number {
  const values = [(face - 0.5) / 6, value];
  return () => {
    const result = values.shift();
    if (result === undefined) throw new Error('The lottery consumed more random values than specified.');
    return result;
  };
}

describe('original six-way mystery-bag rewards', () => {
  it.each([1, 2, 3])('draws 1–600 coins on normal face %i', (face) => {
    expect(rollOriginalBagReward(false, 0, draw(face))).toEqual({ kind: 'cash', value: 1 });
    expect(rollOriginalBagReward(false, 0, draw(face, 0.5))).toEqual({ kind: 'cash', value: 301 });
    expect(rollOriginalBagReward(false, 0, draw(face, 0.999999))).toEqual({ kind: 'cash', value: 600 });
  });

  describe('economy state transitions', () => {
    const start = () => {
      const engine = new GameEngine(() => 0);
      engine.start('solo');
      engine.state.abilityOffers = ['aim-line', 'might', 'thief'];
      engine.chooseAbility('aim-line');
      return engine;
    };

    it('deducts purchases from the cumulative wallet without rebasing the next target', () => {
      const engine = start();
      engine.state.score = 1000;
      engine.finishEarly();
      engine.openShop();
      expect(engine.buy('strength')).toBe(true);
      expect(engine.state.score).toBe(900);
      engine.nextLevel();
      expect(engine.state.target).toBe(1195);
      expect(engine.state.roundStartScore).toBe(900);
      expect(engine.state.activeUpgrades).toEqual(['strength']);
      engine.state.score = 1194;
      engine.state.timeLeft = 0.01;
      engine.tick(0.02);
      expect(engine.state.phase).toBe('gameover');
      expect(engine.state.result?.earned).toBe(294);
    });

    it('passes at exact cumulative equality and pays no arbitrary unused-time bonus', () => {
      const engine = start();
      engine.state.score = 650;
      engine.finishEarly();
      expect(engine.state.phase).toBe('results');
      expect(engine.state.score).toBe(650);
      expect(engine.state.timeLeft).toBe(60);
      engine.openShop();
      engine.nextLevel();
      engine.state.score = 1195;
      engine.state.timeLeft = 0.01;
      engine.tick(0.02);
      expect(engine.state.phase).toBe('results');
      expect(engine.state.result?.earned).toBe(545);
    });

    it('collects initialization-time diamond value even after flags are cleared, with no second multiplier', () => {
      const engine = start();
      const diamond = makeEntity('diamond', 600, 300, 1);
      applyRoundValue(diamond, ['polish']);
      engine.state.entities = [diamond, makeEntity('gold-tiny', 75, 650, 2)];
      engine.state.activeUpgrades = [];
      engine.state.players[0].angle = 0;
      engine.action(1, 'launch');
      for (let frame = 0; frame < 180; frame++) engine.tick(1 / 60);
      expect(engine.state.score).toBe(900);
      expect(engine.state.diamondsCollected).toBe(1);
    });

    it('applies purchased clover and polished values before the next mine is initialized', () => {
      const engine = new GameEngine(() => 0.37);
      engine.start('solo');
      engine.state.abilityOffers = ['aim-line', 'might', 'thief'];
      engine.chooseAbility('aim-line');
      engine.state.level = 7;
      engine.state.phase = 'shop';
      engine.state.pendingUpgrades = ['luck', 'polish'];
      engine.state.dynamite = 4;
      engine.nextLevel();
      expect(engine.state.pendingUpgrades).toEqual([]);
      expect(engine.state.entities.filter((entity) => entity.kind === 'diamond').every((entity) => entity.value === 900)).toBe(true);
      const bags = engine.state.entities.filter((entity) => entity.kind === 'bag');
      expect(bags).toHaveLength(1);
      expect(bags[0].bagReward).toEqual({ kind: 'cash', value: 411 });
    });

    it('retains the product no-debt constraint and does not grant absent or sold-out goods', () => {
      const engine = start();
      engine.state.score = 650;
      engine.finishEarly();
      engine.openShop();
      engine.state.score = 0;
      expect(engine.buy('strength')).toBe(false);
      expect(engine.state.score).toBe(0);
      engine.state.shop = [];
      engine.state.abilities = ['thief'];
      engine.state.shopStealsRemaining = 2;
      expect(engine.buy('strength')).toBe(false);
      expect(engine.steal('strength')).toBe(false);
      expect(engine.state.shopStealsRemaining).toBe(2);
      expect(engine.state.pendingUpgrades).toEqual([]);
      expect(engine.state.notice?.text).toContain('未上架');
    });
  });

  it('uses the fixed normal strength and 800-coin outcomes', () => {
    expect(rollOriginalBagReward(false, 0, draw(4))).toEqual({ kind: 'strength' });
    expect(rollOriginalBagReward(false, 0, draw(6))).toEqual({ kind: 'cash', value: 800 });
  });

  it('substitutes cash only above three stocked dynamites, using the initialization inventory', () => {
    expect(rollOriginalBagReward(false, 3, draw(5))).toEqual({ kind: 'dynamite', amount: 1 });
    expect(rollOriginalBagReward(false, 4, draw(5))).toEqual({ kind: 'cash', value: 100 });
    expect(rollOriginalBagReward(false, 4, draw(5, 0.999999))).toEqual({ kind: 'cash', value: 199 });
  });

  it.each([1, 2])('uses clover face %i for strength, not a longer timer', (face) => {
    expect(rollOriginalBagReward(true, 0, draw(face))).toEqual({ kind: 'strength' });
  });

  it.each([3, 4])('uses clover face %i for one dynamite or 300–599 coins', (face) => {
    expect(rollOriginalBagReward(true, 3, draw(face))).toEqual({ kind: 'dynamite', amount: 1 });
    expect(rollOriginalBagReward(true, 4, draw(face))).toEqual({ kind: 'cash', value: 300 });
    expect(rollOriginalBagReward(true, 4, draw(face, 0.999999))).toEqual({ kind: 'cash', value: 599 });
  });

  it.each([5, 6])('uses clover face %i for exactly 700 coins', (face) => {
    expect(rollOriginalBagReward(true, 0, draw(face))).toEqual({ kind: 'cash', value: 700 });
  });

  it('applies the base original table when no innovative loot ability is owned', () => {
    expect(rollBagReward({ lucky: false, dynamite: 0, abilities: [] }, draw(4))).toEqual({ kind: 'strength' });
    expect(rollBagReward({ lucky: true, dynamite: 0, abilities: ['aim-line'] }, draw(6))).toEqual({ kind: 'cash', value: 700 });
  });
});

describe('ability-aware bag rewards', () => {
  it.each([false, true])('keeps Might on the ordinary six-way draw with clover=%s', (lucky) => {
    for (const dynamite of [0, 3, 4, 20]) {
      for (let face = 1; face <= 6; face++) {
        for (const cashDraw of [0, 0.5, 0.999999]) {
          expect(rollBagReward({ lucky, dynamite, abilities: ['might'] }, draw(face, cashDraw)))
            .toEqual(rollOriginalBagReward(lucky, dynamite, draw(face, cashDraw)));
        }
      }
    }
  });

  it.each([
    [false, 0.55],
    [true, 0.25],
  ] as const)('generates strength bags with Might and clover=%s', (lucky, roll) => {
    const bags = createLevel(1, 'solo', {
      abilities: ['might'], upgrades: lucky ? ['luck'] : [], random: () => roll,
    }).filter((entity) => entity.kind === 'bag');
    expect(bags.length).toBeGreaterThan(0);
    expect(bags.every((bag) => bag.bagReward?.kind === 'strength')).toBe(true);
  });

  describe('bag initialization in the actual mine', () => {
    it('initializes every generated reward with the next round effects and entry inventory', () => {
      const mine = createLevel(1, 'solo', {
        random: () => 0.6,
        upgrades: ['luck'],
        dynamite: 4,
      });
      const bags = mine.filter((entity) => entity.kind === 'bag');
      expect(bags.length).toBeGreaterThan(0);
      for (const bag of bags) {
        expect(bag.bagReward).toEqual({ kind: 'cash', value: 480 });
        expect(bag.weight).toBe(9);
      }
    });

    it('does not re-roll a stored prize when inventory changes or the bag is collected', () => {
      let draws = 0;
      const random = () => { draws++; return 0.8; };
      const engine = new GameEngine(random);
      engine.start('solo');
      engine.state.abilityOffers = ['aim-line', 'might', 'thief'];
      engine.chooseAbility('aim-line');
      const bag = makeEntity('bag', 600, 300, 1);
      initialiseBag(bag, { lucky: false, dynamite: 3, abilities: [] }, random);
      expect(bag.bagReward).toEqual({ kind: 'dynamite', amount: 1 });
      engine.state.entities = [bag, makeEntity('gold-tiny', 75, 650, 2)];
      engine.state.dynamite = 10;
      engine.state.players[0].angle = 0;
      const before = draws;
      engine.action(1, 'launch');
      for (let frame = 0; frame < 300; frame++) engine.tick(1 / 60);
      expect(engine.state.collected).toBe(1);
      expect(engine.state.dynamite).toBe(11);
      expect(engine.state.score).toBe(0);
      expect(draws).toBe(before);
    });
  });

  it('keeps Moneybags cash-only, random and clover-compatible even when Might is also owned', () => {
    const context = { lucky: false, dynamite: 0, abilities: ['moneybags', 'might'] as const };
    expect(rollBagReward(context, () => 0)).toEqual({ kind: 'cash', value: 100 });
    expect(rollBagReward(context, () => 0.999999)).toEqual({ kind: 'cash', value: 450 });
    expect(rollBagReward({ ...context, lucky: true }, () => 0)).toEqual({ kind: 'cash', value: 400 });
    expect(rollBagReward({ ...context, lucky: true }, () => 0.999999)).toEqual({ kind: 'cash', value: 800 });
  });
});
