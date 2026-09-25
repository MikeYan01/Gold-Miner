import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { createReelMotion, interpolatedReelDistance, MATERIAL_WEIGHTS, ORIGINAL_FRAME_RATE, ORIGINAL_STAGE_HEIGHT, originalReelDistance, REEL_POSITIONS_TWIPS, rollOriginalBagWeight, stepOriginalReel } from './hauling';
import { createRandom } from './random';
import { GameEngine } from './engine';
import { HEIGHT, makeEntity, REST_LENGTH } from './levels';
import type { AbilityId, EntityKind } from './types';

describe('original material parameters', () => {
  it('matches both authenticated original builds, including the distinct bone weights', () => {
    expect(MATERIAL_WEIGHTS).toEqual({
      'gold-tiny': 3, 'gold-small': 7, 'gold-medium': 8, 'gold-large': 9,
      'rock-small': 8, 'rock-large': 9,
      'bone-small': 3, 'bone-large': 2,
      diamond: 2, mole: 3, 'mole-diamond': 5, tnt: 2,
    });
  });

  it('reproduces every branch and endpoint of the original bag-weight draw', () => {
    for (let index = 0; index < 9; index++) {
      const values = [0.1, (index + 0.5) / 9];
      expect(rollOriginalBagWeight(() => values.shift()!)).toBe(index + 1);
    }
    for (let index = 0; index < 5; index++) {
      const values = [0.3, (index + 0.5) / 5];
      expect(rollOriginalBagWeight(() => values.shift()!)).toBe(-index - 1);
    }
    expect(rollOriginalBagWeight(() => 0.6)).toBe(9);
    expect(rollOriginalBagWeight(() => 0.9)).toBe(-1);
  });

  it('has the original discrete, nonuniform distribution rather than clamped positive weights', () => {
    const random = createRandom(91);
    const samples = 100_000;
    const counts = new Map<number, number>();
    for (let sample = 0; sample < samples; sample++) {
      const weight = rollOriginalBagWeight(random);
      counts.set(weight, (counts.get(weight) ?? 0) + 1);
    }
    expect(counts.has(0)).toBe(false);
    expect(counts.size).toBe(14);
    expect(counts.get(-1)! / samples).toBeCloseTo(0.3, 2);
    expect(counts.get(9)! / samples).toBeCloseTo(5 / 18, 2);
    for (const weight of [-5, -4, -3, -2]) expect(counts.get(weight)! / samples).toBeCloseTo(0.05, 2);
    for (let weight = 1; weight <= 8; weight++) expect(counts.get(weight)! / samples).toBeCloseTo(1 / 36, 2);
  });
});

describe('original reel timeline', () => {
  it('matches all 250 measured positions rather than rounding an approximate constant speed', () => {
    expect(REEL_POSITIONS_TWIPS).toHaveLength(250);
    expect(REEL_POSITIONS_TWIPS[0]).toBe(8137);
    expect(REEL_POSITIONS_TWIPS[249]).toBe(249);
    const hash = createHash('sha256').update(REEL_POSITIONS_TWIPS.join(',')).digest('hex');
    expect(hash).toBe('87b913f6e51337d128621258ac24f65d3a7c0db04ba33955637a8e65ae59d1ff');
    expect(REEL_POSITIONS_TWIPS.slice(241).map((value) => value / 20))
      .toEqual([25.1, 23.55, 21.95, 20.35, 18.8, 17.2, 15.6, 14.05, 12.45]);
  });

  it.each([
    [9, false, false, [121, 122, 123, 124, 125]],
    [9, true, false, [123, 126, 129, 132, 135]],
    [null, false, false, [136, 152, 168, 184, 200]],
    [9, false, true, [135, 151, 167, 183, 199]],
    [9, true, true, [135, 151, 167, 183, 199]],
    [-5, false, false, [136, 151, 166, 181, 196]],
    [-5, true, false, [138, 155, 172, 189, 206]],
    [-1, true, false, [136, 152, 168, 184, 200]],
  ] as const)('replays weight=%s, drink=%s, bagStrength=%s with the original frame order', (weight, drink, strength, expected) => {
    const motion = createReelMotion(originalReelDistance(120), weight);
    expect(motion.cursor).toBe(120);
    const frames: number[] = [];
    for (let index = 0; index < expected.length; index++) {
      stepOriginalReel(motion, weight, drink, strength);
      frames.push(motion.cursor);
    }
    expect(frames).toEqual(expected);
  });

  it('preserves the natural-play acceleration in the final ordinary frames', () => {
    const motion = createReelMotion(originalReelDistance(285), 9);
    const frames: number[] = [];
    while (motion.alive) {
      stepOriginalReel(motion, 9, false, false);
      frames.push(motion.cursor);
    }
    expect(frames).toEqual([286, 288, 290, 292, 293]);
  });

  it.each([
    [280, true, 9, false, true, 296],
    [285, true, 9, false, true, 301],
    [286, true, 9, false, true, 302],
    [285, false, -5, true, false, 302],
    [286, true, -5, true, false, 304],
    [292, true, 9, false, true, 293],
    [292, false, 9, false, true, 307],
    [292, false, -5, true, false, 309],
  ] as const)('settles frame %i with playing=%s at its true target, not an invented frame-293 clamp', (cursor, playing, weight, drink, strength, expected) => {
    const motion = createReelMotion(originalReelDistance(cursor), weight);
    motion.playing = playing;
    stepOriginalReel(motion, weight, drink, strength);
    expect(motion.alive).toBe(false);
    expect(motion.cursor).toBe(expected);
    stepOriginalReel(motion, weight, drink, strength);
    expect(motion.cursor).toBe(expected);
  });

  it('round-trips arbitrary rope distances without teleporting to a nearby timeline sample', () => {
    for (const distance of [0, 0.01, 3, 150.123, 200, 394.4, 500]) {
      const motion = createReelMotion(distance, 9);
      expect(originalReelDistance(motion.cursor) + motion.offset).toBeCloseTo(distance, 10);
    }
    expect(ORIGINAL_FRAME_RATE).toBe(18);
  });
});

function reelingFixture(kind: EntityKind, abilities: AbilityId[] = []): GameEngine {
  const engine = new GameEngine(() => 0.5);
  engine.start('solo');
  engine.state.abilityOffers = ['aim-line', 'might', 'thief'];
  engine.chooseAbility('aim-line');
  engine.state.abilities = abilities;
  const item = makeEntity(kind, 600, 500, 1);
  if (kind === 'bag') item.bagReward = { kind: 'cash', value: 275 };
  item.claimedBy = 1;
  engine.state.entities = [item, makeEntity('gold-tiny', 80, 650, 2)];
  const player = engine.state.players[0];
  player.angle = 0;
  player.length = REST_LENGTH + originalReelDistance(120) * HEIGHT / ORIGINAL_STAGE_HEIGHT;
  player.phase = 'retracting';
  player.cargoId = item.id;
  player.reel = null;
  return engine;
}

describe('original physics in the running engine', () => {
  it('runs nine original reel cycles in half a second regardless of caller frame rate', () => {
    const lengths: number[] = [];
    for (const frames of [1, 9, 15, 30, 120]) {
      const engine = reelingFixture('gold-large');
      for (let frame = 0; frame < frames; frame++) engine.tick(0.5 / frames);
      expect(engine.state.players[0].reel?.cursor).toBe(129);
      lengths.push(engine.state.players[0].length);
    }
    for (const length of lengths) expect(length).toBeCloseTo(lengths[0], 10);
  });

  it('uses force 12 with a drink, while bag strength replaces rather than adds to that mode', () => {
    const drink = reelingFixture('gold-large');
    drink.state.activeUpgrades = ['strength'];
    drink.tick(0.5);
    expect(drink.state.players[0].reel?.cursor).toBe(147);

    const fast = reelingFixture('gold-large');
    fast.state.bagStrength = true;
    fast.tick(0.5);
    expect(fast.state.players[0].reel?.cursor).toBe(263);
    const both = reelingFixture('gold-large');
    both.state.bagStrength = true;
    both.state.activeUpgrades = ['strength'];
    both.tick(0.5);
    expect(both.state.players[0].length).toBe(fast.state.players[0].length);
  });

  it('gives Might exactly 35% more reel work without changing source force or weight', () => {
    const normal = reelingFixture('gold-large');
    const mighty = reelingFixture('gold-large', ['might']);
    normal.tick(20 / ORIGINAL_FRAME_RATE);
    mighty.tick(20 / ORIGINAL_FRAME_RATE);
    expect(normal.state.players[0].reel?.cursor).toBe(140);
    expect(mighty.state.players[0].reel?.cursor).toBe(147);
    expect(mighty.state.entities[0].weight).toBe(9);
  });

  it('settles a large nugget at the sourced final-frame timing', () => {
    const engine = reelingFixture('gold-large');
    for (let frame = 0; frame < 169; frame++) engine.tick(1 / ORIGINAL_FRAME_RATE);
    expect(engine.state.score).toBe(0);
    expect(engine.state.players[0].reel?.cursor).toBe(292);
    engine.tick(1 / ORIGINAL_FRAME_RATE);
    expect(engine.state.score).toBe(500);
    expect(engine.state.players[0].phase).toBe('swinging');
  });

  it.each([-5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7, 8, 9])(
    'collects a weight-%s bag as a real item, including fast negative-weight bags',
    (weight) => {
      const engine = reelingFixture('bag');
      engine.state.entities[0].weight = weight;
      for (let frame = 0; frame < 200 && engine.state.players[0].cargoId !== null; frame++) {
        engine.tick(1 / ORIGINAL_FRAME_RATE);
      }
      expect(engine.state.players[0].cargoId).toBeNull();
      expect(engine.state.collected).toBe(1);
      expect(engine.state.score).toBe(275);
    },
  );
});

describe('display-frame reel interpolation', () => {
  it.each([
    [null, false, false],
    [9, false, false],
    [9, true, false],
    [9, false, true],
    [2, false, false],
    [-1, false, false],
    [-5, true, false],
  ] as const)('smooths weight=%s, drink=%s, bagStrength=%s without mutating the source motion', (weight, drink, bagStrength) => {
    const motion = createReelMotion(originalReelDistance(120) + 0.012, weight);
    const next = { ...motion };
    stepOriginalReel(next, weight, drink, bagStrength);
    const start = originalReelDistance(motion.cursor) + motion.offset;
    const end = originalReelDistance(next.cursor) + next.offset;
    for (const fraction of [0, 0.15, 0.3, 0.5, 0.8, 0.99]) {
      motion.elapsed = fraction / ORIGINAL_FRAME_RATE;
      const snapshot = { ...motion };
      expect(interpolatedReelDistance(motion, weight, drink, bagStrength))
        .toBeCloseTo(start + (end - start) * fraction, 10);
      expect(motion).toEqual(snapshot);
    }
  });

  it('meets the next authoritative position continuously across a physics boundary', () => {
    const motion = createReelMotion(originalReelDistance(120), null);
    motion.elapsed = (1 - 1e-8) / ORIGINAL_FRAME_RATE;
    const before = interpolatedReelDistance(motion, null, false, false);
    stepOriginalReel(motion, null, false, false);
    motion.elapsed = 0;
    const after = interpolatedReelDistance(motion, null, false, false);
    expect(before).toBeCloseTo(after, 5);
  });

  it('interpolates toward the surface but does not settle or credit cargo early', () => {
    const engine = reelingFixture('gold-large');
    const player = engine.state.players[0];
    player.reel = createReelMotion(originalReelDistance(292), 9);
    player.reel.elapsed = 0.99 / ORIGINAL_FRAME_RATE;
    player.length = REST_LENGTH + originalReelDistance(292) * HEIGHT / ORIGINAL_STAGE_HEIGHT;
    const snapshot = JSON.stringify(engine.state);
    const distance = interpolatedReelDistance(player.reel, 9, false, false);
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(originalReelDistance(292));
    expect(JSON.stringify(engine.state)).toBe(snapshot);
    engine.tick(0.011 / ORIGINAL_FRAME_RATE);
    expect(engine.state.score).toBe(500);
    expect(player.phase).toBe('swinging');
  });

  it('remains frozen during pause and unaffected by how often the display samples it', () => {
    const engine = reelingFixture('gold-large', ['might']);
    engine.tick(0.01);
    engine.pause();
    const motion = engine.state.players[0].reel!;
    const expected = interpolatedReelDistance(motion, 9, false, false);
    const snapshot = JSON.stringify(engine.state);
    for (let index = 0; index < 120; index++) {
      engine.tick(1 / 60);
      expect(interpolatedReelDistance(motion, 9, false, false)).toBe(expected);
    }
    expect(JSON.stringify(engine.state)).toBe(snapshot);
  });
});
