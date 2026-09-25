import { describe, expect, it } from 'vitest';
import { ABILITIES, BAG_COUNTS, drawAbilityOffers, getAbility, haulingMultiplier, hookRadius, MONEYBAGS_COUNTS, needsAbilityChoice, rollBagCount } from './abilities';
import { canEarnRiskReward, GameEngine, findHookHit, hookTip, inTntBlast } from './engine';
import { applyRoundValue, createLevel, createShop, HEIGHT, initialiseBag, makeEntity, MAX_ANGLE, SURFACE, WIDTH } from './levels';
import { rollOriginalShop } from './economy';
import { createRandom } from './random';
import type { AbilityId, EntityKind, Mode, Upgrade } from './types';
import { createViewport, DEFAULT_VIEWPORT } from './viewport';

function start(abilities: AbilityId[] = [], random: () => number = createRandom(71), mode: Mode = 'solo'): GameEngine {
  const engine = new GameEngine(random);
  engine.start(mode);
  engine.state.abilityOffers = ['aim-line', 'thief', 'might'];
  engine.chooseAbility('aim-line');
  engine.state.abilities = abilities;
  return engine;
}

function mining(kind: EntityKind, abilities: AbilityId[], random: () => number = createRandom(72), upgrades: Upgrade[] = []): GameEngine {
  const engine = start(abilities, random);
  engine.state.dynamite = 1;
  engine.state.activeUpgrades = upgrades;
  engine.state.entities = [makeEntity(kind, 600, 390, 1), makeEntity('gold-tiny', 75, 650, 2)];
  applyRoundValue(engine.state.entities[0], upgrades);
  if (kind === 'bag') {
    initialiseBag(engine.state.entities[0], {
      abilities, lucky: upgrades.includes('luck'), dynamite: engine.state.dynamite,
    }, random);
  }
  engine.state.players[0].angle = 0;
  return engine;
}

function advance(engine: GameEngine, seconds: number): void {
  for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 60) {
    engine.tick(Math.min(1 / 60, seconds - elapsed));
  }
}

function haul(engine: GameEngine): void {
  engine.action(1, 'launch');
  advance(engine, 8);
}

function openShop(engine: GameEngine, score = 2000): void {
  engine.state.score = score;
  engine.finishEarly();
  engine.openShop();
  if (engine.state.phase === 'draft') engine.chooseAbility(engine.state.abilityOffers[0]);
  expect(engine.state.phase).toBe('shop');
}

describe('the shared four-pick draft', () => {
  it('has twenty-two distinct abilities and offers three unowned choices without upgrades', () => {
    expect(ABILITIES).toHaveLength(22);
    expect(new Set(ABILITIES.map((ability) => ability.id)).size).toBe(22);
    expect(ABILITIES.map((ability) => ability.id)).toEqual(expect.arrayContaining([
      'time-bank', 'airy-moles', 'slow-fuse', 'time-rush', 'regular-customer', 'archaeologist', 'clone',
      'fossil-puzzle', 'gold-growth', 'buzzer-delivery',
    ]));
    const owned: AbilityId[] = ['might', 'thief', 'alchemy'];
    const offers = drawAbilityOffers(owned, createRandom(17));
    expect(offers).toHaveLength(3);
    expect(new Set(offers).size).toBe(3);
    expect(offers.every((id) => !owned.includes(id))).toBe(true);
    expect(drawAbilityOffers([...owned, 'aim-line'], Math.random)).toEqual([]);
  });

  describe('risk reward', () => {
    it('is selectable from the same limited, non-upgradable ability pool', () => {
      expect(getAbility('risk-reward', 'solo').name).toBe('富贵险中求');
      expect(getAbility('risk-reward', 'solo').description).toContain('50%');
      expect(getAbility('risk-reward', 'solo').detail).toContain('爆炸半径75%');
      const offers = Array.from({ length: 50 }, (_, seed) => drawAbilityOffers([], createRandom(seed))).flat();
      expect(offers).toContain('risk-reward');
      expect(drawAbilityOffers(['risk-reward'], createRandom(8))).not.toContain('risk-reward');
    });

    it.each([
      [1200, 720, 831.5, 390],
      [2400, 720, 715.75, 390],
      [1200, 1440, 600, 505.75],
    ])('limits risk reward to a 187.5-radius inner blast at %i by %i', (width, height, x, y) => {
      const engine = mining('gold-large', ['risk-reward']);
      const gold = engine.state.entities[0];
      const tnt = makeEntity('tnt', x, y, 3);
      const viewport = createViewport(width, height);
      engine.state.entities.push(tnt);
      expect(canEarnRiskReward(gold, engine.state, viewport)).toBe(true);
      tnt.x += 0.01;
      tnt.y += 0.01;
      expect(canEarnRiskReward(gold, engine.state, viewport)).toBe(false);
      expect(inTntBlast(tnt, gold, viewport)).toBe(true);
    });

    it.each([
      [1200, 720, 894, 390],
      [2400, 720, 747, 390],
      [1200, 1440, 600, 537],
    ])('uses a 250-radius blast without extra viewport enlargement at %i by %i', (width, height, x, y) => {
      const engine = mining('gold-large', ['risk-reward']);
      const gold = engine.state.entities[0];
      const tnt = makeEntity('tnt', x, y, 3);
      const viewport = createViewport(width, height);
      engine.state.entities.push(tnt);
      expect(inTntBlast(tnt, gold, viewport)).toBe(true);
      expect(canEarnRiskReward(gold, engine.state, viewport)).toBe(false);
      tnt.x += 0.01;
      tnt.y += 0.01;
      expect(inTntBlast(tnt, gold, viewport)).toBe(false);
      expect(canEarnRiskReward(gold, engine.state, viewport)).toBe(false);
    });

    it.each([
      ['gold-tiny', [], false, 75],
      ['gold-small', [], false, 150],
      ['gold-medium', [], false, 375],
      ['gold-large', [], false, 750],
      ['gold-tiny', ['gold-collector'], false, 98],
      ['gold-small', ['gold-collector'], false, 195],
      ['gold-medium', ['gold-collector'], false, 488],
      ['gold-large', ['gold-collector'], false, 975],
      ['diamond', [], false, 900],
      ['diamond', [], true, 1350],
      ['diamond', ['diamond-collector'], false, 1035],
      ['diamond', ['diamond-collector'], true, 1553],
      ['mole-diamond', [], false, 902],
      ['mole-diamond', ['diamond-collector'], true, 1555],
    ] as const)('pays the correct risk-adjusted value for %s with %j and polish=%s', (kind, otherAbilities, polished, expected) => {
      const engine = mining(kind, ['risk-reward', ...otherAbilities], createRandom(72), polished ? ['polish'] : []);
      engine.state.entities[0].speed = 0;
      engine.state.entities.push(makeEntity('tnt', 700, 410, 3));
      haul(engine);
      expect(engine.state.score).toBe(expected);
      expect(engine.state.players[0].earned).toBe(expected);
      expect(Number.isSafeInteger(engine.state.score)).toBe(true);
    });

    it('locks the bonus at contact and retains it after a teammate harvests safe TNT', () => {
      const engine = start(['risk-reward', 'bomb-expert'], createRandom(12), 'coop');
      const gold = makeEntity('gold-large', 600, 390, 1);
      const tnt = makeEntity('tnt', 680, 400, 2);
      engine.state.entities = [gold, tnt, makeEntity('gold-tiny', 75, 650, 3)];
      const first = engine.state.players[0];
      first.angle = Math.atan2(gold.x - first.origin.x, gold.y - first.origin.y);
      engine.action(1, 'launch');
      advance(engine, 0.8);
      expect(first.cargoId).toBe(gold.id);
      expect(gold.riskBonus).toBe(true);
      expect(engine.state.score).toBe(0);
      const second = engine.state.players[1];
      second.angle = Math.atan2(tnt.x - second.origin.x, tnt.y - second.origin.y);
      engine.action(2, 'launch');
      advance(engine, 8);
      expect(tnt.active).toBe(false);
      expect(first.roundEarned).toBe(750);
      expect(second.roundEarned).toBe(50);
      expect(engine.state.score).toBe(800);
    });

    it('does not grant a bonus when a captured item merely passes near TNT during return', () => {
      const engine = mining('gold-large', ['risk-reward']);
      engine.state.entities[0].y = 600;
      engine.state.entities.push(makeEntity('tnt', 710, 250, 3));
      haul(engine);
      expect(engine.state.entities[0].riskBonus).toBe(false);
      expect(engine.state.score).toBe(500);
    });

    it('ignores destroyed or already-carried TNT and requires the ability', () => {
      const engine = mining('gold-large', ['risk-reward']);
      const tnt = makeEntity('tnt', 700, 410, 3);
      engine.state.entities.push(tnt);
      tnt.active = false;
      expect(canEarnRiskReward(engine.state.entities[0], engine.state, DEFAULT_VIEWPORT)).toBe(false);
      tnt.active = true;
      tnt.claimedBy = 2;
      expect(canEarnRiskReward(engine.state.entities[0], engine.state, DEFAULT_VIEWPORT)).toBe(false);
      tnt.claimedBy = null;
      engine.state.abilities = [];
      haul(engine);
      expect(engine.state.score).toBe(500);
    });

    it('stacks with newly transmuted gold rather than treating it as stone-book income', () => {
      const engine = mining('rock-small', ['risk-reward', 'alchemy', 'gold-collector', 'bomb-expert'], () => 0.1);
      engine.state.activeUpgrades = ['rockbook'];
      engine.state.entities.push(makeEntity('tnt', 700, 410, 3));
      haul(engine);
      expect(engine.state.entities[0].kind).toBe('gold-large');
      expect(engine.state.score).toBe(975);
    });

    it.each(['rock-small', 'rock-large', 'bone-small', 'bone-large', 'bag', 'mole', 'tnt'] as const)(
      'does not mark %s as risk-eligible treasure',
      (kind) => {
        const engine = mining(kind, ['risk-reward']);
        engine.state.entities.push(makeEntity('tnt', 700, 410, 3));
        expect(canEarnRiskReward(engine.state.entities[0], engine.state, DEFAULT_VIEWPORT)).toBe(false);
      },
    );

    it.each([['bone-small', 7], ['bone-large', 20]] as const)('does not transmute or apply stone/gold/diamond/risk bonuses to %s', (kind, expected) => {
      const engine = mining(kind, ['alchemy', 'gold-collector', 'diamond-collector', 'risk-reward'], () => 0.1);
      engine.state.activeUpgrades = ['rockbook', 'polish'];
      engine.state.entities.push(makeEntity('tnt', 700, 410, 3));
      haul(engine);
      expect(engine.state.entities[0].kind).toBe(kind);
      expect(engine.state.score).toBe(expected);
    });
  });

  it.each(['solo', 'coop'] as const)('freezes %s until a valid first choice, and rejects duplicate clicks', (mode) => {
    const engine = new GameEngine(createRandom(7));
    engine.start(mode);
    expect(engine.state.phase).toBe('draft');
    expect(engine.state.draftLevel).toBe(1);
    expect(engine.state.entities).toEqual([]);
    const clock = engine.state.timeLeft;
    engine.tick(500);
    engine.action(1, 'launch');
    engine.pause();
    engine.resume();
    engine.nextLevel();
    expect(engine.state.phase).toBe('draft');
    expect(engine.state.timeLeft).toBe(clock);
    expect(engine.state.players.every((player) => player.phase === 'swinging')).toBe(true);
    const offer = engine.state.abilityOffers[0];
    expect(engine.chooseAbility(offer)).toBe(true);
    expect(engine.state.phase).toBe('playing');
    expect(engine.state.timeLeft).toBe(mode === 'coop' ? 40 : 60);
    expect(engine.chooseAbility(offer)).toBe(false);
    expect(engine.state.abilities).toEqual([offer]);
    expect(engine.state.entities.length).toBeGreaterThan(0);
  });

  it('drafts only before stages 1, 4, 7, 10, then continues indefinitely without more cards', () => {
    const engine = new GameEngine(createRandom(44));
    engine.start('solo');
    const seen: number[] = [engine.state.draftLevel!];
    engine.chooseAbility(engine.state.abilityOffers[0]);
    for (let level = 1; level <= 25; level++) {
      const abilities = [...engine.state.abilities];
      engine.state.score = engine.state.target;
      engine.finishEarly();
      engine.openShop();
      if (engine.state.phase === 'draft') {
        seen.push(engine.state.draftLevel!);
        const time = engine.state.timeLeft;
        engine.tick(300);
        expect(engine.state.timeLeft).toBe(time);
        expect(engine.state.abilityOffers.every((id) => !abilities.includes(id))).toBe(true);
        engine.chooseAbility(engine.state.abilityOffers[0]);
      }
      expect(engine.state.phase).toBe('shop');
      engine.tick(300);
      engine.nextLevel();
      expect(engine.state.phase).toBe('playing');
      expect(engine.state.timeLeft).toBe(engine.state.abilities.includes('time-rush') ? 48 : 60);
    }
    expect(seen).toEqual([1, 4, 7, 10]);
    expect(new Set(engine.state.abilities).size).toBe(4);
    expect(engine.state.level).toBe(26);
    expect(needsAbilityChoice(13, 4)).toBe(false);
    engine.start('coop');
    expect(engine.state.abilities).toEqual([]);
    expect(engine.state.phase).toBe('draft');
    engine.menu();
    expect(engine.state.abilities).toEqual([]);
  });

  it.each(['solo', 'coop'] as const)('offers twelve distinct %s abilities across four drafts, never repeating skipped cards', (mode) => {
    for (const pickIndex of [0, 1, 2]) {
      const engine = new GameEngine(() => 0.2);
      engine.start(mode);
      const offered: AbilityId[] = [];
      const draftLevels: number[] = [];
      for (let level = 1; level <= 10; level++) {
        if (engine.state.phase === 'draft') {
          const choices = [...engine.state.abilityOffers];
          expect(choices).toHaveLength(3);
          expect(new Set(choices).size).toBe(3);
          expect(choices.every((id) => !offered.includes(id))).toBe(true);
          offered.push(...choices);
          draftLevels.push(engine.state.draftLevel!);
          expect(engine.chooseAbility(choices[pickIndex])).toBe(true);
        }
        if (engine.state.phase === 'shop') engine.nextLevel();
        expect(engine.state.level).toBe(level);
        engine.state.score = engine.state.target;
        engine.finishEarly();
        engine.openShop();
      }
      expect(draftLevels).toEqual([1, 4, 7, 10]);
      expect(offered).toHaveLength(12);
      expect(new Set(offered).size).toBe(12);
      expect(engine.state.abilities).toHaveLength(4);
      expect(engine.state.phase).toBe('shop');
    }
  });

  it.each([
    ['solo', 'solo', false],
    ['coop', 'coop', false],
    ['solo', 'coop', true],
    ['coop', 'solo', true],
  ] as const)('makes skipped %s cards available again in a new %s run', (mode, nextMode, returnToCamp) => {
    const engine = new GameEngine(() => 0.2);
    engine.start(mode);
    const firstOffers = [...engine.state.abilityOffers];
    engine.chooseAbility(firstOffers[0]);
    for (let level = 1; level <= 3; level++) {
      engine.state.score = engine.state.target;
      engine.finishEarly();
      engine.openShop();
      if (level < 3) engine.nextLevel();
    }
    expect(engine.state.phase).toBe('draft');
    expect(engine.state.abilityOffers.every((id) => !firstOffers.includes(id))).toBe(true);
    if (returnToCamp) {
      engine.menu();
      engine.preview(nextMode);
    }
    engine.start(nextMode);
    expect(engine.state.abilities).toEqual([]);
    expect(engine.state.abilityOffers).toEqual(firstOffers);
  });

  it.each([
    ['bomb-expert', 'slow-fuse'],
    ['slow-fuse', 'bomb-expert'],
  ] as const)('still offers three fresh cards after nine seen cards and owning %s', (ownedTntAbility, excludedTntAbility) => {
    const owned: AbilityId[] = [ownedTntAbility, 'might', 'gold-collector'];
    const previouslyOffered: AbilityId[] = [
      ...owned, 'diamond-collector', 'alchemy', 'aim-line', 'wide-claw', 'diamond-vein', 'diamond-moles',
    ];
    for (let seed = 0; seed < 30; seed++) {
      const offers = drawAbilityOffers(owned, createRandom(seed), previouslyOffered);
      expect(offers).toHaveLength(3);
      expect(new Set(offers).size).toBe(3);
      expect(offers.every((id) => !previouslyOffered.includes(id))).toBe(true);
      expect(offers).not.toContain(excludedTntAbility);
    }
  });

  it('does not grant a choice that was not offered', () => {
    const engine = new GameEngine(createRandom(50));
    engine.start('solo');
    const notOffered = ABILITIES.find((ability) => !engine.state.abilityOffers.includes(ability.id))!;
    const offers = [...engine.state.abilityOffers];
    expect(engine.chooseAbility(notOffered.id)).toBe(false);
    expect(engine.state.phase).toBe('draft');
    expect(engine.state.abilities).toEqual([]);
    expect(engine.state.abilityOffers).toEqual(offers);
    expect(engine.state.notice?.tone).toBe('warning');
  });
});

describe('time bank', () => {
  it.each([
    ['solo', 60, 3000, 3650],
    ['coop', 40, 2000, 2650],
    ['solo', 16.25, 850, 1500],
    ['coop', 16, 800, 1450],
    ['solo', 0.25, 50, 700],
  ] as const)('pays displayed remaining %s seconds once at 50 coins per second', (mode, remaining, bonus, wallet) => {
    const engine = start(['time-bank'], createRandom(71), mode);
    engine.tick(engine.state.duration - remaining);
    engine.state.score = engine.state.target;
    engine.finishEarly();
    expect(engine.state.phase).toBe('results');
    expect(engine.state.score).toBe(wallet);
    expect(engine.state.result).toMatchObject({ earned: wallet, timeBankBonus: bonus });
    engine.finishEarly();
    expect(engine.state.score).toBe(wallet);
    engine.openShop();
    engine.tick(300);
    expect(engine.state.score).toBe(wallet);
    engine.nextLevel();
    expect(engine.state.timeLeft).toBe(mode === 'solo' ? 60 : 40);
    expect(engine.state.duration).toBe(mode === 'solo' ? 60 : 40);
  });

  it.each([
    ['solo', 60],
    ['coop', 40],
  ] as const)('does not retroactively pay for %s time from before the ability was chosen', (mode, baseDuration) => {
    const engine = start([], createRandom(71), mode);
    engine.state.level = 2;
    engine.state.phase = 'shop';
    engine.nextLevel();
    engine.state.score = engine.state.target;
    engine.finishEarly();
    const wallet = engine.state.score;
    engine.openShop();
    expect(engine.state.phase).toBe('draft');
    engine.state.abilityOffers = ['time-bank', 'might', 'thief'];
    engine.tick(300);
    expect(engine.chooseAbility('time-bank')).toBe(true);
    expect(engine.state.score).toBe(wallet);
    engine.tick(300);
    engine.nextLevel();
    expect(engine.state.level).toBe(4);
    expect(engine.state.timeLeft).toBe(baseDuration);
  });

  it.each([
    ['solo', 'solo', 60],
    ['coop', 'coop', 40],
    ['solo', 'coop', 40],
    ['coop', 'solo', 60],
  ] as const)('clears %s bonus money when restarting or returning to camp for a %s run', (mode, nextMode, baseDuration) => {
    const engine = start(['time-bank'], createRandom(71), mode);
    openShop(engine, engine.state.target);
    if (mode !== nextMode) engine.menu();
    engine.start(nextMode);
    expect(engine.state.abilities).toEqual([]);
    engine.state.abilityOffers = ['time-bank', 'might', 'thief'];
    engine.chooseAbility('time-bank');
    expect(engine.state.score).toBe(0);
    expect(engine.state.timeLeft).toBe(baseDuration);
    expect(engine.state.duration).toBe(baseDuration);
  });

  it.each([
    ['solo', true, 2950],
    ['coop', true, 1950],
    ['solo', false, 0],
    ['coop', false, 0],
  ] as const)('pays an exhausted %s mine only when the round passed=%s', (mode, passed, expectedBonus) => {
    const engine = start(['time-bank'], createRandom(71), mode);
    engine.state.score = passed ? engine.state.target : 0;
    engine.state.entities = [];
    engine.tick(1.25);
    expect(engine.state.phase).toBe(passed ? 'results' : 'gameover');
    expect(engine.state.result?.timeBankBonus).toBe(expectedBonus);
  });

  it('does not rescue a failed round or reward a round that used its whole timer', () => {
    const engine = start(['time-bank']);
    engine.finishEarly();
    expect(engine.state.phase).toBe('playing');
    expect(engine.state.score).toBe(0);
    engine.state.score = engine.state.target;
    engine.tick(60);
    expect(engine.state.result?.timeBankBonus).toBe(0);
    expect(engine.state.score).toBe(650);
  });
});

describe('mining ability effects', () => {
  it('keeps Might as an extra 50% speed effect outside the original strength calculation', () => {
    expect(haulingMultiplier([])).toBe(1);
    expect(haulingMultiplier(['might'])).toBe(1.5);
    const normal = mining('gold-large', []);
    const strong = mining('gold-large', ['might']);
    strong.state.activeUpgrades = ['strength'];
    for (const engine of [normal, strong]) {
      engine.action(1, 'launch');
      advance(engine, 0.5);
    }
    const normalBefore = normal.state.players[0].length;
    const strongBefore = strong.state.players[0].length;
    normal.tick(0.2);
    strong.tick(0.2);
    expect(strongBefore - strong.state.players[0].length).toBeGreaterThan((normalBefore - normal.state.players[0].length) * 3);
  });

  it.each([
    ['gold-tiny', ['gold-collector'], false, 65],
    ['gold-small', ['gold-collector'], false, 130],
    ['gold-medium', ['gold-collector'], false, 325],
    ['gold-large', ['gold-collector'], false, 650],
    ['diamond', ['diamond-collector'], false, 690],
    ['diamond', ['diamond-collector'], true, 1035],
    ['mole-diamond', ['diamond-collector'], false, 692],
    ['mole-diamond', ['diamond-collector'], true, 1037],
    ['mole', ['diamond-collector', 'gold-collector'], true, 2],
  ] as const)('settles %s with collectors and polish=%s correctly', (kind, abilities, polished, expected) => {
    const engine = mining(kind, [...abilities], createRandom(72), polished ? ['polish'] : []);
    engine.state.entities[0].speed = 0;
    haul(engine);
    expect(engine.state.score).toBe(expected);
  });

  it.each([['gold-collector', '30%'], ['diamond-collector', '15%']] as const)('describes the %s bonus as %s', (id, bonus) => {
    expect(getAbility(id, 'solo').description).toContain(bonus);
  });

  it('transmutes stone at contact, changes its picture/weight/value, and uses only the gold collector', () => {
    const engine = mining('rock-small', ['alchemy', 'gold-collector', 'diamond-collector'], () => 0.1);
    engine.state.activeUpgrades = ['rockbook'];
    engine.action(1, 'launch');
    advance(engine, 0.5);
    const cargo = engine.state.entities[0];
    expect(cargo.kind).toBe('gold-large');
    expect(cargo.radius).toBe(44);
    expect(cargo.weight).toBe(9);
    expect(cargo.value).toBe(500);
    expect(engine.state.score).toBe(0);
    advance(engine, 6);
    expect(engine.state.score).toBe(650);
    expect(engine.state.goldCollected).toBe(1);
  });

  it.each(['rock-small', 'rock-large'] as const)('uses a strict 40%% Alchemy chance for %s', (kind) => {
    for (const [roll, expectedKind, expectedValue] of [
      [0.399999, 'gold-large', 500],
      [0.4, kind, makeEntity(kind, 0, 0, 0).value],
    ] as const) {
      const engine = mining(kind, ['alchemy'], () => roll);
      haul(engine);
      expect(engine.state.entities[0].kind).toBe(expectedKind);
      expect(engine.state.entities[0].weight).toBe(makeEntity(expectedKind, 0, 0, 0).weight);
      expect(engine.state.score).toBe(expectedValue);
    }
  });

  it('does not retry a failed stone roll on subsequent reeling frames or aim queries', () => {
    let rolls = 0;
    const engine = mining('rock-small', ['alchemy', 'aim-line'], () => { rolls++; return 0.8; });
    rolls = 0;
    for (let i = 0; i < 100; i++) {
      findHookHit({ x: 600, y: 190 }, { x: 600, y: 690 }, engine.state.entities, DEFAULT_VIEWPORT, engine.state.abilities);
    }
    expect(rolls).toBe(0);
    haul(engine);
    expect(rolls).toBe(1);
    expect(engine.state.entities[0].kind).toBe('rock-small');
    expect(engine.state.score).toBe(11);
  });

  it('doubles only the hook width and captures a first target beyond the former +50% reach', () => {
    expect(hookRadius([])).toBe(7);
    expect(hookRadius(['wide-claw'])).toBe(14);
    expect(getAbility('wide-claw', 'solo').description).toContain('100%');
    const engine = mining('diamond', ['wide-claw', 'aim-line']);
    engine.state.entities[0].x = 628;
    engine.state.entities.push(makeEntity('gold-large', 600, 550, 3));
    const player = engine.state.players[0];
    const from = hookTip(player);
    const end = { x: 600, y: 690 };
    expect(findHookHit(from, end, engine.state.entities, DEFAULT_VIEWPORT, [])?.entity.id).toBe(3);
    expect(findHookHit(from, end, engine.state.entities, DEFAULT_VIEWPORT, engine.state.abilities)?.entity.id).toBe(1);
    engine.action(1, 'launch');
    engine.tick(0.9);
    expect(player.cargoId).toBe(1);
    expect(engine.state.entities[2].claimedBy).toBeNull();
    advance(engine, 4);
    expect(engine.state.score).toBe(600);
  });

  it('safely hauls TNT for $50 at tiny-gold weight, without gold-collector bonuses or collateral damage', () => {
    const engine = mining('tnt', ['bomb-expert', 'gold-collector']);
    engine.state.entities.push(makeEntity('tnt', 650, 405, 3), makeEntity('diamond', 685, 430, 4));
    engine.action(1, 'launch');
    advance(engine, 0.5);
    expect(engine.state.entities[0].weight).toBe(3);
    expect(engine.state.entities[0].value).toBe(50);
    expect(engine.state.players[0].cargoId).toBe(1);
    advance(engine, 5);
    expect(engine.state.score).toBe(50);
    expect(engine.state.entities[2].active).toBe(true);
    expect(engine.state.entities[3].active).toBe(true);
    expect(engine.state.dynamite).toBe(1);
  });

  it('keeps active dynamite usable while TNT immunity is owned', () => {
    const engine = mining('tnt', ['bomb-expert']);
    engine.action(1, 'launch');
    advance(engine, 0.5);
    engine.action(1, 'bomb');
    expect(engine.state.dynamite).toBe(0);
    expect(engine.state.entities[0].active).toBe(false);
    expect(engine.state.score).toBe(0);
  });
});

describe('diamond vein', () => {
  it.each(['gold-tiny', 'gold-small', 'gold-medium', 'gold-large'] as const)(
    'rolls exactly once at capture with a strict 20%% chance for %s',
    (kind) => {
      for (const roll of [0.199999, 0.2]) {
        let rolls = 0;
        const engine = mining(kind, ['diamond-vein', 'gold-collector', 'diamond-collector'], () => {
          rolls++;
          return roll;
        }, ['polish']);
        rolls = 0;
        for (let i = 0; i < 10; i++) {
          findHookHit({ x: 600, y: 190 }, { x: 600, y: 690 }, engine.state.entities, DEFAULT_VIEWPORT, engine.state.abilities);
        }
        expect(rolls).toBe(0);
        expect(engine.state.entities[0].kind).toBe(kind);
        engine.action(1, 'launch');
        engine.tick(0.5);
        const converted = roll < 0.2;
        const expected = makeEntity(converted ? 'diamond' : kind, 0, 0, 1);
        expect(engine.state.entities[0]).toMatchObject({
          kind: expected.kind, weight: expected.weight, radius: expected.radius, baseValue: expected.baseValue,
          value: converted ? 900 : expected.value, claimedBy: 1,
        });
        expect(engine.state.score).toBe(0);
        advance(engine, 8);
        expect(engine.state.score).toBe(converted ? 1035 : Math.round(expected.value * 1.3));
        expect(engine.state.goldCollected).toBe(converted ? 0 : 1);
        expect(engine.state.diamondsCollected).toBe(converted ? 1 : 0);
        expect(rolls).toBe(1);
      }
    },
  );

  it('can convert alchemized gold and applies polish and only the diamond collector', () => {
    const engine = mining('rock-small', ['alchemy', 'diamond-vein', 'gold-collector', 'diamond-collector'], () => 0.1, ['rockbook', 'polish']);
    engine.action(1, 'launch');
    engine.tick(0.5);
    expect(engine.state.entities[0]).toMatchObject({ kind: 'diamond', baseValue: 600, value: 900, weight: 2, radius: 18 });
    advance(engine, 8);
    expect(engine.state.score).toBe(1035);
    expect(engine.state.goldCollected).toBe(0);
    expect(engine.state.diamondsCollected).toBe(1);
  });

  it('can convert grown gold while keeping its capture-locked clone', () => {
    const engine = mining('gold-tiny', ['diamond-vein', 'gold-growth', 'diamond-collector', 'clone'], () => 0.1, ['polish']);
    engine.tick(5);
    expect(engine.state.entities[0].kind).toBe('gold-small');
    engine.state.players[0].angle = 0;
    haul(engine);
    expect(engine.state.entities[0]).toMatchObject({ kind: 'diamond', value: 900, weight: 2 });
    expect(engine.state.clonedEntityId).toBe(1);
    expect(engine.state.score).toBe(2070);
  });

  it('keeps capture-time risk and rush bonuses on a converted diamond', () => {
    const engine = mining('gold-large', ['diamond-vein', 'diamond-collector', 'risk-reward', 'time-rush'], () => 0.1, ['polish']);
    engine.state.entities.push(makeEntity('tnt', 700, 410, 3));
    haul(engine);
    expect(engine.state.entities[0]).toMatchObject({ kind: 'diamond', riskBonus: true, weight: 2 });
    expect(engine.state.score).toBe(2174);
  });

  it.each(['rock-small', 'bone-small', 'bone-large', 'diamond', 'mole', 'mole-diamond', 'bag'] as const)(
    'does not roll or convert non-gold %s',
    (kind) => {
      let rolls = 0;
      const engine = mining(kind, ['diamond-vein'], () => { rolls++; return 0.1; });
      engine.state.entities[0].speed = 0;
      rolls = 0;
      haul(engine);
      expect(engine.state.entities[0].kind).toBe(kind);
      expect(rolls).toBe(0);
    },
  );

  it('converts both co-op catches independently', () => {
    const engine = start(['diamond-vein'], () => 0.1, 'coop');
    engine.state.entities = engine.state.players.map((player) => makeEntity('gold-large', player.origin.x, 500, player.id));
    for (const player of engine.state.players) {
      player.angle = 0;
      engine.action(player.id, 'launch');
    }
    advance(engine, 8);
    expect(engine.state.entities.every((entity) => entity.kind === 'diamond' && entity.weight === 2)).toBe(true);
    expect(engine.state.players.map((player) => player.roundEarned)).toEqual([600, 600]);
  });
});

describe('TNT fragments', () => {
  it.each([
    [[], 1],
    [['clone'], 2],
    [['gold-collector', 'diamond-collector', 'risk-reward', 'time-rush'], 1],
  ] as const)('returns a one-dollar fragment after direct detonation with %j', (abilities, payout) => {
    const engine = start([...abilities]);
    const charge = makeEntity('tnt', 600, 350, 1);
    const lostGold = makeEntity('gold-large', 850, 370, 2);
    engine.state.entities = [charge, lostGold, makeEntity('diamond', 75, 650, 3)];
    engine.state.players[0].angle = 0;
    engine.action(1, 'launch');
    engine.tick(0.25);
    expect(lostGold.active).toBe(false);
    expect(charge).toMatchObject({ kind: 'tnt-fragment', value: 1, weight: 2, active: true, claimedBy: 1, riskBonus: false });
    expect(engine.state.players[0].cargoId).toBe(charge.id);
    expect(engine.state.score).toBe(0);
    advance(engine, 4);
    expect(engine.state.score).toBe(payout);
    expect(engine.state.players[0].cargoId).toBeNull();
  });
});

describe('cloning', () => {
  it('doubles only the first captured polished diamond after its collector bonus', () => {
    const engine = mining('diamond', ['clone', 'diamond-collector'], createRandom(72), ['polish']);
    haul(engine);
    expect(engine.state.score).toBe(2070);
    expect(engine.state.players[0].roundEarned).toBe(2070);
    const second = makeEntity('diamond', 600, 390, 3);
    applyRoundValue(second, ['polish']);
    engine.state.entities.push(second);
    engine.state.players[0].angle = 0;
    haul(engine);
    expect(engine.state.score).toBe(3105);
    expect(engine.state.players[0].roundEarned).toBe(3105);
  });

  it.each([
    ['cash', ['moneybags'], [], 0.5, 550, 1, false],
    ['dynamite', ['might'], [], 0.8, 0, 3, false],
    ['lucky dynamite', ['might'], ['luck'], 0.4, 0, 3, false],
    ['strength', [], [], 0.55, 0, 1, true],
    ['Might strength', ['might'], [], 0.55, 0, 1, true],
    ['lucky Might strength', ['might'], ['luck'], 0.2, 0, 1, true],
  ] as const)('copies the stored %s bag reward without stacking the stage-long strength mode', (_label, otherAbilities, upgrades, roll, cash, dynamite, strength) => {
    const engine = mining('bag', ['clone', ...otherAbilities], () => roll, [...upgrades]);
    haul(engine);
    expect(engine.state.score).toBe(cash);
    expect(engine.state.dynamite).toBe(dynamite);
    expect(engine.state.bagStrength).toBe(strength);
  });

  it.each([
    ['mole-diamond', ['diamond-collector'], ['polish'], 2074],
    ['gold-large', ['gold-collector', 'risk-reward'], [], 1950],
    ['diamond', ['diamond-collector', 'risk-reward', 'time-rush'], ['polish'], 4348],
    ['mole-diamond', ['diamond-collector', 'risk-reward', 'time-rush'], ['polish'], 4352],
    ['bone-small', ['archaeologist', 'time-rush'], ['rockbook', 'polish'], 280],
    ['bone-large', ['archaeologist', 'time-rush'], [], 800],
    ['rock-small', [], ['rockbook'], 66],
    ['rock-small', ['alchemy', 'gold-collector', 'time-rush'], ['rockbook'], 1820],
    ['mole', [], [], 4],
    ['tnt', ['bomb-expert', 'time-rush', 'gold-collector'], [], 100],
  ] as const)('doubles the complete final %s payout after all applicable bonuses', (kind, otherAbilities, upgrades, expectedValue) => {
    const engine = mining(kind, ['clone', ...otherAbilities], () => 0.1, [...upgrades]);
    engine.state.entities[0].speed = 0;
    engine.state.entities.push(makeEntity('tnt', 700, 410, 3));
    haul(engine);
    expect(engine.state.score).toBe(expectedValue);
    expect(engine.state.players[0].roundEarned).toBe(expectedValue);
    expect(Number.isSafeInteger(engine.state.score)).toBe(true);
  });

  it.each([1, 2] as const)('locks the shared clone to player %i first capture even when the teammate collects sooner', (firstPlayerId) => {
    const engine = start(['clone'], createRandom(71), 'coop');
    const first = engine.state.players[firstPlayerId - 1];
    const second = engine.state.players[2 - firstPlayerId];
    const gold = makeEntity('gold-large', first.origin.x, 600, 1);
    const diamond = makeEntity('diamond', second.origin.x, 300, 2);
    engine.state.entities = [gold, diamond, makeEntity('gold-tiny', 75, 650, 3)];
    first.angle = 0;
    engine.action(first.id, 'launch');
    engine.tick(0.8);
    expect(first.cargoId).toBe(gold.id);
    second.angle = 0;
    engine.action(second.id, 'launch');
    advance(engine, 2.5);
    expect(second.roundEarned).toBe(600);
    expect(first.cargoId).toBe(gold.id);
    expect(first.roundEarned).toBe(0);
    advance(engine, 12);
    expect(first.roundEarned).toBe(1000);
    expect(second.roundEarned).toBe(600);
    expect(engine.state.score).toBe(1600);
  });

  it('ignores empty hooks, consumes the chance when its first cargo is destroyed, and resets next round', () => {
    const engine = mining('rock-large', ['clone']);
    engine.state.players[0].angle = -1.1;
    haul(engine);
    expect(engine.state.clonedEntityId).toBeNull();
    engine.state.players[0].angle = 0;
    engine.action(1, 'launch');
    advance(engine, 0.5);
    expect(engine.state.players[0].cargoId).toBe(1);
    engine.action(1, 'bomb');
    advance(engine, 3);
    expect(engine.state.score).toBe(0);
    engine.state.entities.push(makeEntity('diamond', 600, 390, 3));
    engine.state.players[0].angle = 0;
    haul(engine);
    expect(engine.state.score).toBe(600);
    openShop(engine, engine.state.target);
    engine.nextLevel();
    engine.state.entities = [makeEntity('diamond', 600, 390, 4), makeEntity('gold-tiny', 75, 650, 5)];
    engine.state.players[0].angle = 0;
    haul(engine);
    expect(engine.state.players[0].roundEarned).toBe(1200);
    expect(engine.state.score).toBe(1850);
  });

  it('does not spend the clone on ignited TNT and doubles the treasure caught behind it instead', () => {
    const engine = start(['clone', 'slow-fuse', 'risk-reward']);
    const charge = makeEntity('tnt', 600, 350, 1);
    const treasure = makeEntity('gold-tiny', 600, 460, 2);
    engine.state.entities = [charge, treasure, makeEntity('gold-tiny', 75, 650, 3)];
    engine.state.players[0].angle = 0;
    engine.action(1, 'launch');
    engine.tick(0.25);
    expect(charge.fuseRemaining).toBe(3);
    expect(engine.state.clonedEntityId).toBeNull();
    engine.tick(0.25);
    expect(engine.state.clonedEntityId).toBe(treasure.id);
    advance(engine, 3);
    expect(engine.state.score).toBe(150);
  });
});

describe('slow fuse', () => {
  it('passes through TNT, captures treasure behind it, and detonates exactly three seconds after ignition', () => {
    const engine = start(['slow-fuse', 'risk-reward']);
    const charge = makeEntity('tnt', 600, 350, 1);
    const gold = makeEntity('gold-tiny', 600, 460, 2);
    engine.state.entities = [charge, gold, makeEntity('gold-tiny', 75, 650, 3)];
    engine.state.players[0].angle = 0;
    engine.action(1, 'launch');
    engine.tick(0.25);
    expect(charge.active).toBe(true);
    expect(charge.fuseRemaining).toBe(3);
    expect(engine.state.players[0].phase).toBe('extending');
    expect(engine.state.players[0].cargoId).toBeNull();
    engine.tick(0.25);
    expect(engine.state.players[0].cargoId).toBe(gold.id);
    expect(gold.riskBonus).toBe(true);
    engine.tick(2.5);
    expect(charge.active).toBe(true);
    expect(charge.fuseRemaining).toBe(0.25);
    expect(engine.state.score).toBe(75);
    engine.tick(0.25);
    expect(charge.active).toBe(false);
    expect(engine.state.score).toBe(75);
  });

  it.each([
    ['slow-fuse', 'bomb-expert'],
    ['bomb-expert', 'slow-fuse'],
  ] as const)('excludes %s and %s from the same run, including stale offers', (owned, excluded) => {
    for (let seed = 0; seed < 50; seed++) {
      const offers = drawAbilityOffers([owned], createRandom(seed));
      expect(offers).toHaveLength(3);
      expect(offers).not.toContain(excluded);
      expect(offers).not.toContain(owned);
    }
    const engine = start([owned]);
    engine.state.level = 3;
    engine.state.score = engine.state.target;
    engine.finishEarly();
    engine.openShop();
    engine.state.abilityOffers = [excluded, 'might', 'thief'];
    expect(engine.chooseAbility(excluded)).toBe(false);
    expect(engine.state.phase).toBe('draft');
    expect(engine.state.abilities).toEqual([owned]);
    expect(engine.state.notice?.tone).toBe('warning');
  });

  it('pauses the shared fuse and does not restart it when a teammate passes through the same charge', () => {
    const engine = start(['slow-fuse'], createRandom(71), 'coop');
    const charge = makeEntity('tnt', 600, 350, 1);
    engine.state.entities = [charge, makeEntity('gold-tiny', 75, 650, 2)];
    const [first, second] = engine.state.players;
    first.angle = Math.atan2(charge.x - first.origin.x, charge.y - first.origin.y);
    engine.action(1, 'launch');
    engine.tick(0.5);
    expect(charge.fuseRemaining).toBe(3);
    engine.pause();
    const remainingRoundTime = engine.state.timeLeft;
    engine.tick(60);
    expect(charge.fuseRemaining).toBe(3);
    expect(engine.state.timeLeft).toBe(remainingRoundTime);
    engine.resume();
    second.angle = Math.atan2(charge.x - second.origin.x, charge.y - second.origin.y);
    engine.action(2, 'launch');
    engine.tick(0.5);
    expect(second.phase).toBe('extending');
    expect(second.cargoId).toBeNull();
    expect(charge.fuseRemaining).toBe(2.5);
    engine.tick(2.5);
    expect(charge.active).toBe(false);
  });

  it('still detonates neighboring TNT immediately in the chain reaction and leaves distant charges intact', () => {
    const engine = start(['slow-fuse']);
    const first = makeEntity('tnt', 600, 350, 1);
    const chained = makeEntity('tnt', 740, 350, 2);
    const distant = makeEntity('tnt', 1080, 650, 3);
    const treasure = makeEntity('diamond', 840, 400, 4);
    engine.state.entities = [first, chained, distant, treasure];
    engine.state.players[0].angle = 0;
    engine.action(1, 'launch');
    engine.tick(0.25);
    expect(first.fuseRemaining).toBe(3);
    expect(chained.fuseRemaining).toBeNull();
    engine.tick(3);
    expect(first.active).toBe(false);
    expect(chained.active).toBe(false);
    expect(treasure.active).toBe(false);
    expect(distant.active).toBe(true);
    expect(distant.fuseRemaining).toBeNull();
  });

  it('protects caught cargo from delayed chain reactions without preventing manual dynamite', () => {
    const engine = start(['slow-fuse', 'clone'], createRandom(71), 'coop');
    const first = makeEntity('tnt', 600, 350, 1);
    const chained = makeEntity('tnt', 800, 350, 2);
    const cargo = makeEntity('gold-large', 840, 520, 3);
    const loose = makeEntity('rock-small', 920, 450, 4);
    engine.state.entities = [first, chained, cargo, loose, makeEntity('diamond', 70, 650, 5)];
    const [trigger, carrier] = engine.state.players;
    carrier.angle = 0;
    engine.action(carrier.id, 'launch');
    engine.tick(0.6);
    expect(carrier.cargoId).toBe(cargo.id);
    trigger.angle = Math.atan2(first.x - trigger.origin.x, first.y - trigger.origin.y);
    engine.action(trigger.id, 'launch');
    engine.tick(0.5);
    expect(first.fuseRemaining).toBe(3);
    advance(engine, 3);
    expect(first.active).toBe(false);
    expect(chained.active).toBe(false);
    expect(loose.active).toBe(false);
    expect(cargo.active).toBe(true);
    expect(carrier.cargoId).toBe(cargo.id);
    expect(engine.state.clonedEntityId).toBe(cargo.id);
    engine.state.dynamite = 1;
    engine.action(carrier.id, 'bomb');
    expect(cargo.active).toBe(false);
    expect(carrier.cargoId).toBeNull();
    expect(engine.state.dynamite).toBe(0);
    expect(engine.state.score).toBe(0);
  });
});

describe('time rush', () => {
  it.each([
    ['solo', 48],
    ['coop', 32],
  ] as const)('shortens the %s base countdown by exactly 20%', (mode, duration) => {
    const engine = start(['time-rush'], createRandom(71), mode);
    openShop(engine, engine.state.target);
    engine.nextLevel();
    expect(engine.state.duration).toBe(duration);
    expect(engine.state.timeLeft).toBe(duration);
    engine.tick(duration - 0.25);
    expect(engine.state.phase).toBe('playing');
    expect(engine.state.timeLeft).toBe(0.25);
    engine.tick(0.25);
    expect(engine.state.phase).toBe('gameover');
    expect(engine.state.result?.timeUsed).toBe(duration);
  });

  it.each([
    ['gold-tiny', [], [], 70],
    ['gold-small', [], [], 140],
    ['gold-medium', ['gold-collector'], [], 455],
    ['gold-large', ['gold-collector', 'risk-reward'], [], 1365],
    ['diamond', [], [], 840],
    ['diamond', ['diamond-collector', 'risk-reward'], ['polish'], 2174],
    ['mole-diamond', ['diamond-collector', 'risk-reward'], ['polish'], 2176],
    ['rock-small', [], ['rockbook'], 33],
    ['bone-large', ['archaeologist'], ['rockbook'], 400],
    ['mole', [], [], 2],
    ['tnt', ['bomb-expert'], [], 50],
    ['bag', ['moneybags'], [], 135],
  ] as const)('pays %s with the 40% treasure bonus, preserving other multipliers and exclusions', (kind, otherAbilities, upgrades, expectedValue) => {
    const engine = mining(kind, ['time-rush', ...otherAbilities], () => 0.1, [...upgrades]);
    engine.state.entities[0].speed = 0;
    engine.state.entities.push(makeEntity('tnt', 700, 410, 3));
    haul(engine);
    expect(engine.state.score).toBe(expectedValue);
    expect(engine.state.players[0].roundEarned).toBe(expectedValue);
  });

  it.each([
    ['solo', 48, 5010],
    ['coop', 32, 4010],
  ] as const)('keeps banked %s money without extending a newly selected rush timer', (mode, expectedDuration, expectedWallet) => {
    const engine = start(['time-bank'], createRandom(71), mode);
    engine.state.level = 2;
    engine.state.phase = 'shop';
    engine.nextLevel();
    engine.state.score = engine.state.target;
    engine.finishEarly();
    engine.openShop();
    engine.state.abilityOffers = ['time-rush', 'might', 'thief'];
    expect(engine.chooseAbility('time-rush')).toBe(true);
    engine.nextLevel();
    expect(engine.state.duration).toBe(expectedDuration);
    expect(engine.state.timeLeft).toBe(expectedDuration);
    expect(engine.state.score).toBe(expectedWallet);
  });
});

describe('buzzer delivery', () => {
  it('doubles captured cargo value at zero after other bonuses before deciding whether the round passed', () => {
    const engine = mining('diamond', ['buzzer-delivery', 'diamond-collector', 'clone', 'time-bank'], createRandom(72), ['polish']);
    engine.state.target = 3000;
    engine.action(1, 'launch');
    engine.tick(0.4);
    expect(engine.state.players[0].cargoId).toBe(1);
    expect(engine.state.score).toBe(0);
    engine.state.timeLeft = 0.01;
    engine.tick(0.02);
    expect(engine.state.score).toBe(4140);
    expect(engine.state.phase).toBe('results');
    expect(engine.state.result).toMatchObject({ passed: true, earned: 4140, collected: 1, timeBankBonus: 0 });
    expect(engine.state.players[0].cargoId).toBeNull();
    engine.tick(10);
    expect(engine.state.score).toBe(4140);
  });

  it('settles both co-op hooks and their shared fossil bonus before the final pass decision', () => {
    const engine = start(['buzzer-delivery', 'fossil-puzzle', 'archaeologist'], createRandom(71), 'coop');
    engine.state.target = 1400;
    engine.state.entities = [
      makeEntity('bone-small', 360, 500, 1),
      makeEntity('bone-large', 840, 500, 2),
    ];
    for (const player of engine.state.players) {
      player.angle = 0;
      engine.action(player.id, 'launch');
    }
    engine.tick(0.6);
    expect(engine.state.players.every((player) => player.cargoId !== null)).toBe(true);
    engine.state.timeLeft = 0.01;
    engine.tick(0.02);
    expect(engine.state.result).toMatchObject({ passed: true, earned: 1580, collected: 2, fossilBonus: 500 });
    expect(engine.state.players.every((player) => player.cargoId === null)).toBe(true);
    expect(engine.state.players.reduce((total, player) => total + player.roundEarned, 0)).toBe(1580);
  });

  it.each(['unreached', 'destroyed', 'already-returned'] as const)('does not credit %s cargo at the buzzer', (status) => {
    const engine = mining('diamond', ['buzzer-delivery']);
    engine.action(1, 'launch');
    if (status !== 'unreached') engine.tick(0.4);
    if (status === 'destroyed') engine.action(1, 'bomb');
    if (status === 'already-returned') advance(engine, 8);
    engine.state.timeLeft = 0.01;
    engine.tick(0.02);
    expect(engine.state.score).toBe(status === 'already-returned' ? 600 : 0);
    expect(engine.state.result?.collected).toBe(status === 'already-returned' ? 1 : 0);
  });

  it.each([
    ['moneybags', 0.5, 1100, 1, false],
    ['might', 0.8, 0, 3, false],
    ['might', 0.55, 0, 1, true],
  ] as const)('preserves stored %s bag rewards at roll %s and cloning at timeout', (ability, roll, cash, dynamite, strength) => {
    const engine = mining('bag', ['buzzer-delivery', 'clone', ability], () => roll);
    engine.action(1, 'launch');
    engine.tick(0.4);
    expect(engine.state.players[0].cargoId).toBe(1);
    engine.state.timeLeft = 0.01;
    engine.tick(0.02);
    expect(engine.state.score).toBe(cash);
    expect(engine.state.dynamite).toBe(dynamite);
    expect(engine.state.bagStrength).toBe(strength);
    expect(engine.state.result?.collected).toBe(1);
  });
});

describe('fossil puzzle', () => {
  it('pays one extra $500 after collecting both bone types, while keeping their normal values', () => {
    const engine = mining('bone-small', ['fossil-puzzle']);
    haul(engine);
    expect(engine.state.score).toBe(7);
    for (const [id, kind, expected] of [
      [3, 'bone-large', 527],
      [4, 'bone-small', 534],
      [5, 'bone-large', 554],
    ] as const) {
      engine.state.entities.push(makeEntity(kind, 600, 390, id));
      engine.state.players[0].angle = 0;
      haul(engine);
      expect(engine.state.score).toBe(expected);
      expect(engine.state.players[0].roundEarned).toBe(expected);
    }
  });

  it.each([
    ['bone-small', 'bone-large', 1180],
    ['bone-large', 'bone-small', 1440],
  ] as const)('accepts %s first and keeps the shared $500 bonus outside Archaeologist and Clone multipliers', (firstKind, secondKind, expected) => {
    const engine = mining(firstKind, ['fossil-puzzle', 'archaeologist', 'clone']);
    haul(engine);
    engine.state.entities.push(makeEntity(secondKind, 600, 390, 3));
    engine.state.players[0].angle = 0;
    haul(engine);
    expect(engine.state.score).toBe(expected);
    engine.finishEarly();
    expect(engine.state.result).toMatchObject({ earned: expected, fossilBonus: 500 });
    engine.openShop();
    engine.nextLevel();
    engine.state.entities = [makeEntity(secondKind, 600, 390, 1), makeEntity('gold-tiny', 75, 650, 2)];
    engine.state.players[0].angle = 0;
    haul(engine);
    expect(engine.state.players[0].roundEarned).toBe(secondKind === 'bone-large' ? 800 : 280);
  });

  it('combines the two miners bone deliveries into one shared fossil', () => {
    const engine = start(['fossil-puzzle'], createRandom(71), 'coop');
    engine.state.entities = [
      makeEntity('bone-small', 360, 390, 1),
      makeEntity('bone-large', 840, 390, 2),
      makeEntity('gold-tiny', 75, 650, 3),
    ];
    for (const player of engine.state.players) {
      player.angle = 0;
      engine.action(player.id, 'launch');
    }
    advance(engine, 8);
    expect(engine.state.score).toBe(527);
    expect(engine.state.players.reduce((total, player) => total + player.roundEarned, 0)).toBe(527);
  });
});

describe('gold growth', () => {
  it('grows exactly one randomly selected nugget by one physical tier every five seconds', () => {
    const engine = start(['gold-growth'], () => 0.5);
    engine.state.entities = [
      makeEntity('gold-tiny', 250, 350, 1),
      makeEntity('gold-small', 450, 400, 2),
      makeEntity('gold-medium', 650, 500, 3),
      makeEntity('gold-large', 900, 600, 4),
    ];
    engine.tick(4.75);
    expect(engine.state.entities.map((entity) => entity.value)).toEqual([50, 100, 250, 500]);
    engine.tick(0.25);
    expect(engine.state.entities.map((entity) => entity.value)).toEqual([50, 250, 250, 500]);
    expect(engine.state.entities[1]).toMatchObject({ id: 2, x: 450, y: 400, kind: 'gold-medium', radius: 29, weight: 8, baseValue: 250 });
    engine.tick(5);
    expect(engine.state.entities.map((entity) => entity.value)).toEqual([50, 500, 250, 500]);
    expect(engine.state.entities[1]).toMatchObject({ radius: 44, weight: 9 });
    engine.tick(5);
    expect(engine.state.entities.map((entity) => entity.value)).toEqual([50, 500, 500, 500]);
  });

  it.each([
    [0, [100, 100, 250]],
    [1 / 3, [50, 250, 250]],
    [2 / 3, [50, 100, 500]],
    [0.999, [50, 100, 500]],
  ] as const)('gives each eligible nugget an equal random interval at roll %s', (roll, expected) => {
    const engine = start(['gold-growth'], () => roll);
    engine.state.entities = [
      makeEntity('gold-tiny', 250, 350, 1),
      makeEntity('gold-small', 450, 400, 2),
      makeEntity('gold-medium', 650, 500, 3),
    ];
    engine.tick(5);
    expect(engine.state.entities.map((entity) => entity.value)).toEqual(expected);
  });

  it('pauses growth, handles crossed intervals once each, and restarts the interval in the next mine', () => {
    const engine = mining('gold-tiny', ['gold-growth'], () => 0);
    engine.state.entities[1] = makeEntity('gold-large', 75, 650, 2);
    engine.tick(4);
    engine.pause();
    engine.tick(100);
    expect(engine.state.entities[0].value).toBe(50);
    engine.resume();
    engine.tick(1);
    expect(engine.state.entities[0].value).toBe(100);
    engine.tick(10);
    expect(engine.state.entities[0].value).toBe(500);
    engine.tick(5);
    expect(engine.state.entities[0].value).toBe(500);
    openShop(engine);
    engine.tick(300);
    engine.nextLevel();
    engine.state.entities = [makeEntity('gold-tiny', 600, 390, 1)];
    engine.tick(4);
    expect(engine.state.entities[0].value).toBe(50);
    engine.tick(1);
    expect(engine.state.entities[0].value).toBe(100);
  });

  it('never grows captured, destroyed, fully grown, or non-gold items', () => {
    const engine = mining('gold-small', ['gold-growth'], () => 0);
    const destroyed = makeEntity('gold-tiny', 300, 390, 3);
    destroyed.active = false;
    engine.state.entities = [
      engine.state.entities[0],
      makeEntity('gold-large', 75, 650, 2),
      destroyed,
      makeEntity('diamond', 900, 500, 4),
    ];
    engine.tick(4.5);
    engine.state.players[0].angle = 0;
    engine.action(1, 'launch');
    engine.tick(0.4);
    expect(engine.state.players[0].cargoId).toBe(1);
    engine.tick(0.1);
    expect(engine.state.entities.map((entity) => entity.kind)).toEqual(['gold-small', 'gold-large', 'gold-tiny', 'diamond']);
    advance(engine, 5);
    expect(engine.state.score).toBe(100);
  });

  it('settles grown gold using its new tier before collector, risk, and clone bonuses', () => {
    const engine = mining('gold-tiny', ['gold-growth', 'gold-collector', 'risk-reward', 'clone'], () => 0);
    engine.state.entities.push(makeEntity('tnt', 700, 410, 3));
    engine.tick(5);
    engine.state.players[0].angle = 0;
    haul(engine);
    expect(engine.state.score).toBe(390);
  });
});

describe('archaeologist', () => {
  it.each([
    ['bone-small', 140, 3],
    ['bone-large', 400, 2],
  ] as const)('pays %s at its new value without changing weight or applying treasure bonuses', (kind, expectedValue, weight) => {
    const engine = mining(kind, ['archaeologist', 'gold-collector', 'diamond-collector', 'risk-reward'], createRandom(72), ['rockbook', 'polish']);
    engine.state.entities.push(makeEntity('tnt', 700, 410, 3));
    expect(engine.state.entities[0].weight).toBe(weight);
    haul(engine);
    expect(engine.state.entities[0].kind).toBe(kind);
    expect(engine.state.score).toBe(expectedValue);
    expect(engine.state.players[0].roundEarned).toBe(expectedValue);
  });
});

describe('airy moles', () => {
  it.each([
    [5, 34, 44],
    [95, 59.5, 77],
  ])('preserves the original mole speeds and weights at stage %i', (level, ordinarySpeed, diamondSpeed) => {
    for (const mode of ['solo', 'coop'] as const) {
      const entities = createLevel(level, mode, { abilities: ['airy-moles', 'diamond-moles'], random: () => 0.1 });
      const ordinary = entities.filter((entity) => entity.kind === 'mole');
      const diamonds = entities.filter((entity) => entity.kind === 'mole-diamond');
      expect(ordinary.length).toBeGreaterThan(0);
      expect(diamonds).toHaveLength(1);
      for (const entity of ordinary) {
        expect(entity.speed).toBeCloseTo(ordinarySpeed);
        expect(entity.weight).toBe(3);
        expect(entity.value).toBe(2);
      }
      for (const entity of diamonds) {
        expect(entity.speed).toBeCloseTo(diamondSpeed);
        expect(entity.weight).toBe(5);
        expect(entity.value).toBe(602);
      }
    }
  });
});

describe('bag drops and generation', () => {
  it('uses the agreed 0–4 count distributions and their exact boundary intervals', () => {
    expect(BAG_COUNTS).toEqual([0.15, 0.45, 0.25, 0.12, 0.03]);
    expect(MONEYBAGS_COUNTS).toEqual([0.05, 0.32, 0.4, 0.18, 0.05]);
    expect([0, 0.2, 0.65, 0.9, 0.99].map((roll) => rollBagCount([], () => roll))).toEqual([0, 1, 2, 3, 4]);
    expect([0, 0.1, 0.5, 0.8, 0.99].map((roll) => rollBagCount(['moneybags'], () => roll))).toEqual([0, 1, 2, 3, 4]);
  });

  it.each([
    [[], 0.1, 'money'],
    [[], 0.55, 'strength'],
    [[], 0.8, 'bomb'],
    [[], 0.95, 'money'],
    [['might'], 0.2, 'money'],
    [['might'], 0.3, 'money'],
    [['might'], 0.55, 'strength'],
    [['might'], 0.8, 'bomb'],
    [['might'], 0.95, 'money'],
    [['moneybags'], 0.1, 'money'],
    [['moneybags', 'might'], 0.2, 'money'],
  ] as const)('uses the correct reward table for %j at roll %s', (abilities, roll, reward) => {
    const engine = mining('bag', [...abilities], () => roll);
    haul(engine);
    expect(engine.state.dynamite > 1).toBe(reward === 'bomb');
    expect(engine.state.bagStrength).toBe(reward === 'strength');
    expect(engine.state.score > 0).toBe(reward === 'money');
    if (reward === 'money') {
      expect(engine.state.score).toBeGreaterThanOrEqual(1);
      expect(engine.state.score).toBeLessThanOrEqual(800);
    }
  });

  it('keeps moneybags cash-only with clover and preserves the higher cash range', () => {
    const engine = mining('bag', ['moneybags', 'might', 'gold-collector'], () => 0.5, ['luck']);
    haul(engine);
    expect(engine.state.score).toBe(600);
    expect(engine.state.dynamite).toBe(1);
    expect(engine.state.bagStrength).toBe(false);
  });

  it('leaves gold unchanged at generation with Diamond Vein and adds one mole per shared mine', () => {
    for (const mode of ['solo', 'coop'] as const) {
      const normal = createLevel(13, mode, { random: createRandom(72) });
      const veined = createLevel(13, mode, { abilities: ['diamond-vein'], random: createRandom(72) });
      expect(veined).toEqual(normal);
      const enhanced = createLevel(13, mode, { abilities: ['diamond-vein', 'diamond-moles'], random: createRandom(72) });
      expect(enhanced.filter((entity) => entity.kind.startsWith('gold')).length)
        .toBe(normal.filter((entity) => entity.kind.startsWith('gold')).length);
      expect(enhanced.filter((entity) => entity.kind === 'mole-diamond').length).toBe(normal.filter((entity) => entity.kind === 'mole-diamond').length + 1);
      expect(enhanced.filter((entity) => entity.kind === 'diamond').every((entity) => entity.value === 600 && entity.weight === 2)).toBe(true);
      expect(enhanced.filter((entity) => entity.kind === 'diamond').length)
        .toBe(normal.filter((entity) => entity.kind === 'diamond').length);
    }
  });

  it.each(['solo', 'coop'] as const)('adds one of each bone per bone ability to every %s mine', (mode) => {
    const abilitySets: AbilityId[][] = [['archaeologist'], ['fossil-puzzle'], ['archaeologist', 'fossil-puzzle']];
    for (const level of [1, 4, 7, 8, 9, 10, 13, 25, 1000, 1_000_000]) {
      for (const roll of [0.1, 0.5, 0.99]) {
        const normal = createLevel(level, mode, { random: () => roll });
        for (const abilities of abilitySets) {
          const enhanced = createLevel(level, mode, { abilities, random: () => roll });
          for (const kind of ['bone-small', 'bone-large'] as const) {
            expect(enhanced.filter((entity) => entity.kind === kind).length)
              .toBe(normal.filter((entity) => entity.kind === kind).length + abilities.length);
          }
          expect(enhanced.length).toBe(normal.length + abilities.length * 2);
        }
      }
    }
  });

  it('uses original discrete bag weights, or the exact diamond weight with moneybags', () => {
    const ordinaryWeights: number[] = [];
    for (let seed = 1; seed <= 100; seed++) {
      const normal = createLevel(20, 'solo', { random: createRandom(seed) });
      const empowered = createLevel(20, 'solo', { abilities: ['moneybags'], random: createRandom(seed) });
      const bags = normal.filter((entity) => entity.kind === 'bag');
      expect(bags.length).toBeLessThanOrEqual(4);
      for (const bag of bags) {
        expect(bag.weight).toBeGreaterThanOrEqual(-5);
        expect(bag.weight).toBeLessThanOrEqual(9);
        expect(Number.isInteger(bag.weight) && bag.weight !== 0).toBe(true);
        ordinaryWeights.push(bag.weight);
      }
      expect(empowered.filter((entity) => entity.kind === 'bag').every((entity) => entity.weight === 2)).toBe(true);
    }
    expect(Math.min(...ordinaryWeights)).toBe(-5);
    expect(Math.max(...ordinaryWeights)).toBe(9);
  });

  it('fits four bags, additional moles, and increased TNT without overlaps or unreachable rewards', () => {
    const abilities: AbilityId[] = ['moneybags', 'diamond-moles', 'diamond-vein', 'bomb-expert'];
    for (const mode of ['solo', 'coop'] as const) {
      for (const level of [1, 4, 6, 9, 12, 13, 25, 50, 100, 1000, 1_000_000]) {
        const entities = createLevel(level, mode, { abilities, random: () => 0.99 });
        expect(entities.filter((entity) => entity.kind === 'bag')).toHaveLength(4);
        expect(entities.length).toBeLessThanOrEqual(32);
        expect(new Set(entities.map((entity) => entity.id)).size).toBe(entities.length);
        const origins = mode === 'solo' ? [600] : [360, 840];
        for (const [index, entity] of entities.entries()) {
          expect(entity.x - entity.radius).toBeGreaterThan(0);
          expect(entity.x + entity.radius).toBeLessThan(WIDTH);
          expect(entity.y + entity.radius).toBeLessThan(HEIGHT);
          expect(origins.some((x) => Math.abs(Math.atan2(entity.x - x, entity.y - SURFACE)) <= MAX_ANGLE)).toBe(true);
          for (const other of entities.slice(index + 1)) {
            expect(Math.hypot(entity.x - other.x, entity.y - other.y)).toBeGreaterThan(entity.radius + other.radius);
          }
        }
      }
    }
  });

  it('usually creates a local TNT pair rather than requiring a whole-mine chain', () => {
    let linked = 0;
    for (let level = 4; level <= 40; level++) {
      const bombs = createLevel(level, 'solo').filter((entity) => entity.kind === 'tnt');
      if (bombs.some((bomb, index) => bombs.slice(index + 1).some((other) => inTntBlast(bomb, other, DEFAULT_VIEWPORT)))) linked++;
    }
    expect(linked).toBeGreaterThanOrEqual(30);
  });
});

describe('regular customer', () => {
  it('stocks strength, clover and polish in an otherwise empty shop at their normal prices and limits', () => {
    const engine = start(['regular-customer'], () => 0.99);
    engine.state.dynamite = 5;
    openShop(engine, 1000);
    expect(engine.state.shop).toMatchObject([
      { id: 'strength', price: 397, stock: 1, bought: 0 },
      { id: 'luck', price: 52, stock: 1, bought: 0 },
      { id: 'polish', price: 300, stock: 1, bought: 0 },
    ]);
    expect(engine.buy('strength')).toBe(true);
    expect(engine.buy('strength')).toBe(false);
    expect(engine.buy('luck')).toBe(true);
    expect(engine.buy('polish')).toBe(true);
    expect(engine.state.score).toBe(251);
    engine.openShop();
    expect(engine.state.shop.every((item) => item.bought === 1)).toBe(true);
  });

  it('guarantees the current shop immediately after a draft and shares both free thefts in co-op', () => {
    const engine = start(['thief'], () => 0.99, 'coop');
    engine.state.level = 3;
    engine.state.dynamite = 5;
    engine.state.score = engine.state.target;
    engine.finishEarly();
    engine.openShop();
    engine.state.abilityOffers = ['regular-customer', 'might', 'alchemy'];
    expect(engine.chooseAbility('regular-customer')).toBe(true);
    expect(engine.state.shop).toMatchObject([
      { id: 'strength', price: 397 },
      { id: 'luck', price: 155 },
      { id: 'polish', price: 498 },
    ]);
    engine.state.score = 0;
    expect(engine.steal('strength')).toBe(true);
    expect(engine.steal('polish')).toBe(true);
    expect(engine.state.shopStealsRemaining).toBe(0);
    expect(engine.steal('strength')).toBe(false);
    expect(engine.steal('luck')).toBe(false);
    engine.nextLevel();
    expect(engine.state.activeUpgrades).toEqual(['strength', 'polish']);
    expect(engine.state.score).toBe(0);
  });
});

describe('original prices and shared theft', () => {
  it('keeps the original completed-category quote without a stage inflation multiplier', () => {
    for (const level of [1, 3, 4, 13, 50, 100, 1_000_000]) {
      const original = rollOriginalShop(level, 0, () => 0.1);
      const items = createShop(level, { random: () => 0.1 });
      expect(items).toHaveLength(5);
      for (const [index, item] of items.entries()) {
        expect(item.price).toBe(original[index].price);
        expect(item.priceText).toBe(`$${original[index].price.toLocaleString('en-US')}`);
        expect(item.priceText).not.toMatch(/Infinity|NaN/);
        expect(item.stock).toBe(1);
      }
    }
  });

  it('allows two chosen stock-consuming thefts with no money, shared between players', () => {
    const engine = start(['thief'], () => 0.1, 'coop');
    openShop(engine);
    engine.state.score = 0;
    expect(engine.state.shopStealsRemaining).toBe(2);
    expect(engine.steal('strength')).toBe(true);
    expect(engine.state.pendingUpgrades).toEqual(['strength']);
    expect(engine.steal('strength')).toBe(false);
    expect(engine.state.shopStealsRemaining).toBe(1);
    expect(engine.steal('polish')).toBe(true);
    expect(engine.state.shopStealsRemaining).toBe(0);
    expect(engine.steal('dynamite')).toBe(false);
    expect(engine.state.score).toBe(0);
    engine.openShop();
    expect(engine.state.shopStealsRemaining).toBe(0);
    engine.nextLevel();
    expect(engine.state.activeUpgrades).toEqual(['strength', 'polish']);
    openShop(engine);
    expect(engine.state.shopStealsRemaining).toBe(2);
  });

  it('cannot steal a sold-out dynamite twice, rejects non-thieves, and keeps late-stage purchases affordable', () => {
    const engine = start(['thief'], () => 0.1);
    openShop(engine);
    expect(engine.steal('dynamite')).toBe(true);
    expect(engine.steal('dynamite')).toBe(false);
    expect(engine.state.dynamite).toBe(1);
    expect(engine.state.shopStealsRemaining).toBe(1);
    expect(engine.state.shop.find((item) => item.id === 'dynamite')?.bought).toBe(1);
    engine.state.shop = createShop(1_000_000, { random: () => 0.1 });
    engine.state.shopStealsRemaining = 2;
    expect(engine.buy('strength')).toBe(true);
    engine.state.score = 0;
    expect(engine.buy('polish')).toBe(false);
    expect(engine.state.notice?.text['zh-CN']).toContain('金币不够');
    expect(engine.steal('polish')).toBe(true);
    const ordinary = start([]);
    openShop(ordinary);
    expect(ordinary.steal('strength')).toBe(false);
  });

  it('activates a newly selected thief immediately in the shop before stage 4', () => {
    const engine = start(['aim-line']);
    engine.state.level = 3;
    engine.state.score = engine.state.target;
    engine.finishEarly();
    engine.openShop();
    expect(engine.state.phase).toBe('draft');
    engine.state.abilityOffers = ['thief', 'might', 'alchemy'];
    engine.chooseAbility('thief');
    expect(engine.state.phase).toBe('shop');
    expect(engine.state.shopStealsRemaining).toBe(2);
  });
});
