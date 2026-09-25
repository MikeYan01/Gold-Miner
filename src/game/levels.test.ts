import { describe, expect, it } from 'vitest';
import {
  applyRoundValue, createLevel, createShop, getLevelInfo, HEIGHT, LEVELS, levelTarget, makeEntity,
  MAX_ANGLE, OPENING_LEVEL_COUNT, SURFACE, WIDTH,
} from './levels';
import { createRandom, shuffled } from './random';
import { originalCategory } from './economy';
import { GameEngine } from './engine';
import { originalResourceProfile, RESOURCE_KINDS } from './resource-profiles';
import type { AbilityId, EntityKind } from './types';

const DEEP_TREASURE: readonly EntityKind[] = ['gold-medium', 'gold-large', 'diamond', 'mole-diamond'];

describe('treasure denominations', () => {
  it('defines four gold tiers with increasing values, sizes, and weights', () => {
    const tiers = (['gold-tiny', 'gold-small', 'gold-medium', 'gold-large'] as const)
      .map((kind, index) => makeEntity(kind, 600, 400, index));
    expect(tiers.map((entity) => entity.value)).toEqual([50, 100, 250, 500]);
    for (let index = 1; index < tiers.length; index++) {
      expect(tiers[index].radius).toBeGreaterThan(tiers[index - 1].radius);
      expect(tiers[index].weight).toBeGreaterThan(tiers[index - 1].weight);
    }
  });

  it.each([
    ['rock-small', 11, 'gold-medium'],
    ['rock-large', 20, 'gold-large'],
    ['bone-small', 7, 'gold-tiny'],
    ['bone-large', 20, 'diamond'],
  ] as const)('values %s at %i coins and matches %s hauling weight', (kind, value, reference) => {
    const entity = makeEntity(kind, 600, 400, 0);
    expect(entity.value).toBe(value);
    expect(entity.weight).toBe(makeEntity(reference, 600, 400, 1).weight);
  });

  it('introduces the original resource types at the original categories', () => {
    const first = createLevel(1, 'solo', { random: () => 0 });
    expect(first.filter((entity) => entity.kind.startsWith('gold')).map((entity) => entity.value))
      .toEqual([50, 50, 50, 100, 100, 500, 500]);
    expect(first.some((entity) => entity.kind === 'diamond' || entity.kind.startsWith('bone'))).toBe(false);
    expect(createLevel(2, 'solo', { random: () => 0 }).filter((entity) => entity.kind === 'diamond')).toHaveLength(1);
    expect(createLevel(2, 'solo', { random: () => 0.5 }).filter((entity) => entity.kind === 'diamond')).toHaveLength(0);
    const seventh = createLevel(7, 'solo');
    expect(seventh.filter((entity) => entity.kind === 'bone-small')).toHaveLength(1);
    expect(seventh.filter((entity) => entity.kind === 'bone-large')).toHaveLength(1);
    expect(makeEntity('bone-large', 0, 0, 0).radius).toBeGreaterThan(makeEntity('bone-small', 0, 0, 1).radius);
  });

  it('applies original value upgrades once at initialization and retains the base denomination', () => {
    const diamond = makeEntity('diamond', 600, 400, 0);
    applyRoundValue(diamond, ['polish']);
    expect(diamond.value).toBe(900);
    expect(diamond.baseValue).toBe(600);
    applyRoundValue(diamond, ['polish']);
    expect(diamond.value).toBe(900);
    const mine = createLevel(8, 'solo', { random: () => 0.01, upgrades: ['polish', 'rockbook'] });
    expect(mine.filter((entity) => entity.kind === 'diamond').every((entity) => entity.value === 900)).toBe(true);
    expect(mine.filter((entity) => entity.kind === 'mole-diamond').every((entity) => entity.value === 902)).toBe(true);
  });
});

describe('shared target curve and endless metadata', () => {
  it('matches the approved stage 10–25 targets with individually rounded increments capped at 8,000', () => {
    const targets = Array.from({ length: 16 }, (_, index) => levelTarget(index + 10));
    expect(targets).toEqual([
      15275, 18510, 22274, 26568, 31391, 36744, 42626, 49038,
      55979, 63450, 71450, 79450, 87450, 95450, 103450, 111450,
    ]);
    expect(targets.slice(1).map((target, index) => target - targets[index])).toEqual([
      3235, 3764, 4294, 4823, 5353, 5882, 6412, 6941, 7471, 8000,
      8000, 8000, 8000, 8000, 8000,
    ]);
  });

  it('uses ten resource categories rather than a twelve-stage ending', () => {
    expect(OPENING_LEVEL_COUNT).toBe(10);
    expect(LEVELS).toHaveLength(10);
    expect(Array.from({ length: 10 }, (_, index) => levelTarget(index + 1))).toEqual([
      650, 1195, 2010, 3095, 4450, 6075, 7970, 10135, 12570, 15275,
    ]);
    expect(levelTarget(13)).toBe(26568);
    expect(levelTarget(14)).toBe(31391);
    expect(getLevelInfo(11, 'solo').name).toBe(LEVELS[3].name);
    expect(getLevelInfo(18, 'solo').name).toBe(LEVELS[3].name);
  });

  it('shares score targets while giving solo 60 seconds and co-op 40 seconds at every depth', () => {
    const stages = [...Array.from({ length: 200 }, (_, index) => index + 1), 1000, 10_000, 1_000_000];
    for (const level of stages) {
      const solo = getLevelInfo(level, 'solo');
      const coop = getLevelInfo(level, 'coop');
      expect(solo.target).toBe(levelTarget(level));
      expect(coop.target).toBe(solo.target);
      expect(solo.duration).toBe(60);
      expect(coop.duration).toBe(40);
      expect(solo.name).toBe(LEVELS[originalCategory(level) - 1].name);
      expect(solo.hint.length).toBeGreaterThan(0);
      if (level > 1) expect(solo.target).toBeGreaterThan(levelTarget(level - 1));
    }
  });

  it.each([
    [30, 151450],
    [100, 711450],
    [1000, 7911450],
    [1_000_000, 7_999_911_450],
  ])('keeps the increment capped for far-future stage %i', (level, expected) => {
    expect(levelTarget(level)).toBe(expected);
    expect(levelTarget(level + 1) - levelTarget(level)).toBe(8_000);
  });

  it('rejects targets beyond the safe-integer currency range without capping or overflowing them', () => {
    expect(levelTarget(1_125_899_906_853)).toBe(9_007_199_254_735_450);
    expect(() => levelTarget(1_125_899_906_854)).toThrow(RangeError);
    expect(() => levelTarget(Number.MAX_SAFE_INTEGER)).toThrow(RangeError);
  });

  it.each([0, -1, 1.5, 11.5, 20.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects an invalid stage number: %s', (level) => {
    expect(() => levelTarget(level)).toThrow(RangeError);
    expect(() => getLevelInfo(level, 'solo')).toThrow(RangeError);
    expect(() => createLevel(level, 'solo')).toThrow(RangeError);
    expect(() => createShop(level)).toThrow(RangeError);
  });
});

describe('balanced original supply with independent positions and explicit ability overlays', () => {
  it.each([
    [8, 'solo', 0.01, 3],
    [8, 'coop', 0.01, 4],
    [2, 'solo', 0.25, 1],
    [2, 'solo', 0.75, 0],
    [13, 'solo', 0.25, 0],
    [13, 'coop', 0.25, 1],
  ] as const)('halves direct diamonds in stage %i %s, including co-op supply and odd-count rounding', (level, mode, roll, expected) => {
    let first = true;
    const mine = createLevel(level, mode, {
      random: () => {
        if (!first) return roll;
        first = false;
        return 0;
      },
    });
    expect(mine.filter((entity) => entity.kind === 'diamond')).toHaveLength(expected);
  });

  it('reduces all thirty baseline mine totals while retaining their resource types and increasing TNT floors', () => {
    for (let category = 1; category <= 10; category++) {
      for (let variant = 1; variant <= 3; variant++) {
        const baseline = originalResourceProfile(category, variant);
        let first = true;
        const mine = createLevel(category, 'solo', {
          random: () => {
            if (!first) return 0.37;
            first = false;
            return (variant - 0.5) / 3;
          },
        });
        for (const kind of RESOURCE_KINDS) {
          const count = mine.filter((entity) => entity.kind === kind).length;
          if (kind === 'bag') expect(count).toBe(1);
          else if (kind === 'tnt') expect(count).toBe(Math.max(baseline.tnt, category < 4 ? 3 : 4));
          else if (kind === 'diamond') expect(count).toBe(Math.ceil(Math.round(baseline.diamond * 0.8) / 2));
          else expect(count, `${category}_${variant}: ${kind}`)
            .toBe(Math.round(baseline[kind] * (DEEP_TREASURE.includes(kind) ? 0.8 : 0.65)));
        }
        const previousTotal = Object.values(baseline).reduce((sum, count) => sum + count, 0)
          - baseline.bag - baseline.tnt + 1 + Math.max(baseline.tnt, category < 4 ? 1 : 2);
        expect(mine.length, `${category}_${variant}: total density`).toBeLessThan(previousTotal);
      }
    }
  });

  it.each(['solo', 'coop'] as const)('keeps medium/large %s gold and loose diamonds below the upper 40%, including conversions', (mode) => {
    const abilitySets: AbilityId[][] = [[], ['diamond-vein', 'diamond-moles']];
    for (const abilities of abilitySets) {
      for (const level of [...Array.from({ length: 100 }, (_, index) => index + 1), 1000, 1_000_000]) {
        const mine = createLevel(level, mode, { abilities, random: createRandom(level * 71) });
        const treasure = mine.filter((entity) => DEEP_TREASURE.includes(entity.kind) && entity.kind !== 'mole-diamond');
        expect(mine.some((entity) => DEEP_TREASURE.includes(entity.kind))).toBe(true);
        for (const entity of treasure) {
          expect(entity.y - entity.radius, `${mode} ${level}: ${entity.kind}`)
            .toBeGreaterThanOrEqual(SURFACE + (HEIGHT - SURFACE) * 0.4);
        }
      }
    }
  });

  it.each([[1, 3], [3, 3], [4, 4], [24, 4], [25, 5], [1000, 5]] as const)(
    'keeps stage %i at a minimum of %i TNT without reducing denser original hazards',
    (level, minimum) => {
      for (let seed = 0; seed < 30; seed++) {
        const mine = createLevel(level, 'solo', { random: createRandom(seed), abilities: ['bomb-expert'] });
        const tnt = mine.filter((entity) => entity.kind === 'tnt');
        expect(tnt.length).toBeGreaterThanOrEqual(minimum);
        expect(tnt.every((entity) => entity.value === 50 && entity.weight === 3)).toBe(true);
      }
    },
  );

  it.each(['solo', 'coop'] as const)('puts %s diamonds low and gives ordinary and airy moles a genuine upper/middle preference', (mode) => {
    const middle = SURFACE + (HEIGHT - SURFACE) / 3;
    const lower = SURFACE + (HEIGHT - SURFACE) * 2 / 3;
    let diamonds = 0, lowDiamonds = 0, moles = 0, upperMoles = 0;
    let carriers = 0, upperCarriers = 0, airyCarriers = 0, upperAiry = 0, surfaceAiry = 0;
    for (let seed = 0; seed < 120; seed++) {
      const level = seed % 30 + 1;
      for (const airy of [false, true]) {
        const mine = createLevel(level, mode, {
          abilities: airy ? ['airy-moles'] : [],
          random: createRandom(Math.imul(seed + 1, 104729)),
        });
        for (const entity of mine) {
          const top = entity.y - entity.radius;
          const bottom = entity.y + entity.radius;
          if (!airy && entity.kind === 'diamond') {
            diamonds++;
            lowDiamonds += Number(top >= lower);
          } else if (!airy && entity.kind === 'mole') {
            moles++;
            upperMoles += Number(bottom <= lower);
          } else if (entity.kind === 'mole-diamond') {
            if (airy) {
              airyCarriers++;
              upperAiry += Number(bottom <= lower);
              surfaceAiry += Number(bottom <= middle);
            } else {
              expect(top).toBeGreaterThanOrEqual(middle);
              carriers++;
              upperCarriers += Number(bottom <= lower);
            }
          }
        }
      }
    }
    expect(lowDiamonds / diamonds).toBeGreaterThanOrEqual(0.8);
    expect(upperMoles / moles).toBeGreaterThanOrEqual(0.8);
    expect(upperAiry / airyCarriers).toBeGreaterThanOrEqual(0.8);
    expect(surfaceAiry / airyCarriers).toBeGreaterThanOrEqual(0.25);
    expect(upperAiry / airyCarriers - upperCarriers / carriers).toBeGreaterThanOrEqual(0.25);
  });

  it.each([
    ['solo', 1200, 720],
    ['solo', 2400, 720],
    ['solo', 390, 774],
    ['coop', 1200, 720],
    ['coop', 2400, 720],
    ['coop', 390, 774],
  ] as const)('keeps %s chain reactions local at %i by %i instead of routinely detonating every charge', (mode, width, height) => {
    const engine = new GameEngine(createRandom(9));
    engine.start(mode);
    engine.state.abilityOffers = ['slow-fuse', 'aim-line', 'might'];
    engine.chooseAbility('slow-fuse');
    let completeChains = 0, localChains = 0, destroyedShare = 0;
    for (let seed = 0; seed < 120; seed++) {
      const mine = createLevel(seed % 30 + 1, mode, { random: createRandom(Math.imul(seed + 1, 104729)) });
      const charges = mine.filter((entity) => entity.kind === 'tnt');
      const resources = mine.filter((entity) => entity.kind !== 'tnt');
      engine.state.entities = mine;
      engine.state.phase = 'playing';
      engine.state.timeLeft = 60;
      engine.state.particles = [];
      engine.state.texts = [];
      engine.state.result = null;
      engine.setViewport(width, height);
      charges[seed % charges.length].fuseRemaining = 0.001;
      engine.tick(0.001);
      const share = resources.filter((entity) => !entity.active).length / resources.length;
      const detonated = charges.filter((entity) => !entity.active).length;
      completeChains += Number(detonated === charges.length);
      localChains += Number(detonated > 1 && detonated < charges.length);
      destroyedShare += share;
    }
    expect(completeChains).toBeLessThanOrEqual(12);
    expect(localChains).toBeGreaterThan(0);
    expect(destroyedShare / 120).toBeLessThan(0.75);
  });

  it.each(['solo', 'coop'] as const)('keeps %s mines in bounds, reachable and separated even with every extra spawn', (mode) => {
    const stages = [...Array.from({ length: 150 }, (_, index) => index + 1), 1000, 10_000, 1_000_000];
    const abilities: AbilityId[] = ['moneybags', 'diamond-moles', 'bomb-expert', 'risk-reward'];
    for (const level of stages) {
      const entities = createLevel(level, mode, { abilities });
      expect(entities.length).toBeLessThanOrEqual(32);
      expect(new Set(entities.map((entity) => entity.id)).size).toBe(entities.length);
      const origins = mode === 'solo' ? [600] : [360, 840];
      for (const [index, entity] of entities.entries()) {
        expect(entity.active).toBe(true);
        expect(entity.claimedBy).toBeNull();
        expect(entity.x - entity.radius).toBeGreaterThan(0);
        expect(entity.x + entity.radius).toBeLessThan(WIDTH);
        expect(entity.y - entity.radius).toBeGreaterThan(SURFACE + 20);
        expect(entity.y + entity.radius).toBeLessThan(HEIGHT);
        expect(origins.some((x) => Math.abs(Math.atan2(entity.x - x, entity.y - SURFACE)) <= MAX_ANGLE)).toBe(true);
        expect(entity.speed).toBeLessThanOrEqual(77);
        if (entity.kind === 'bag') expect(entity.bagReward).not.toBeNull();
        for (const other of entities.slice(index + 1)) {
          expect(Math.hypot(entity.x - other.x, entity.y - other.y)).toBeGreaterThan(entity.radius + other.radius + 10);
        }
      }
    }
  });

  it('generates repeatable but varied layouts without reusing mutable entities', () => {
    const fingerprints = new Set<string>();
    for (let level = 13; level < 113; level++) {
      const original = createLevel(level, 'solo');
      const repeat = createLevel(level, 'solo');
      expect(repeat).toEqual(original);
      expect(repeat[0]).not.toBe(original[0]);
      fingerprints.add(JSON.stringify(original));
      original[0].active = false;
      expect(createLevel(level, 'solo')[0].active).toBe(true);
    }
    expect(fingerprints.size).toBe(100);
  });

  it('preserves co-op gold additions and halves diamond additions without changing the common goal', () => {
    for (const level of [1, 2, 3, 8, 12, 13, 25, 100, 1_000_000]) {
      const solo = createLevel(level, 'solo', { random: () => 0.37 });
      const coop = createLevel(level, 'coop', { random: () => 0.37 });
      if (level < 3) {
        expect(coop.filter((entity) => entity.kind === 'gold-medium').length)
          .toBe(solo.filter((entity) => entity.kind === 'gold-medium').length + 1);
        expect(coop.filter((entity) => entity.kind === 'gold-large').length)
          .toBe(solo.filter((entity) => entity.kind === 'gold-large').length + 1);
      } else if (level <= 12) {
        expect(coop.filter((entity) => entity.kind === 'gold-large').length)
          .toBe(solo.filter((entity) => entity.kind === 'gold-large').length + 1);
        const extraDiamonds = coop.filter((entity) => entity.kind === 'diamond').length
          - solo.filter((entity) => entity.kind === 'diamond').length;
        expect([0, 1]).toContain(extraDiamonds);
      } else {
        expect(coop.filter((entity) => entity.kind === 'diamond').length)
          .toBe(solo.filter((entity) => entity.kind === 'diamond').length + 1);
      }
      expect(getLevelInfo(level, 'coop').target).toBe(getLevelInfo(level, 'solo').target);
    }
  });
});

describe('shared seeded randomness', () => {
  it('keeps the existing generator sequence and never mutates a shuffled input', () => {
    const random = createRandom(0);
    expect(random()).toBe(1013904223 / 4294967296);
    const first = createRandom(2026);
    const second = createRandom(2026);
    expect(Array.from({ length: 100 }, first)).toEqual(Array.from({ length: 100 }, second));
    const input = [1, 2, 3, 4, 5];
    expect(shuffled(input, createRandom(42))).toEqual(shuffled(input, createRandom(42)));
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
});
