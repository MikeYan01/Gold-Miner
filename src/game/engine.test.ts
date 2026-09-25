import { describe, expect, it } from 'vitest';
import { GameEngine, hookTip, keyboardAction, segmentCircleHit } from './engine';
import { applyRoundValue, createLevel, getLevelInfo, HEIGHT, initialiseBag, LEVELS, levelTarget, makeEntity, MAX_ANGLE, OPENING_LEVEL_COUNT, REST_LENGTH, WIDTH } from './levels';
import type { EntityKind, Mode, Player, Sound } from './types';
import { createViewport, projectPoint } from './viewport';
import { ORIGINAL_FRAME_RATE, ORIGINAL_STAGE_HEIGHT, originalReelDistance } from './hauling';

function advance(engine: GameEngine, seconds: number): void {
  for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 60) {
    engine.tick(Math.min(1 / 60, seconds - elapsed));
  }
}

function beginRun(engine: GameEngine, mode: Mode): void {
  engine.start(mode);
  engine.state.abilityOffers = ['aim-line', 'thief', 'might'];
  expect(engine.chooseAbility('aim-line')).toBe(true);
}

function fixture(kind: EntityKind = 'gold-large', mode: Mode = 'solo'): GameEngine {
  const engine = new GameEngine(() => 0.1);
  beginRun(engine, mode);
  engine.state.dynamite = mode === 'solo' ? 1 : 2;
  engine.state.entities = [
    makeEntity(kind, 600, 390, 1),
    makeEntity('gold-tiny', 75, 650, 2),
  ];
  if (kind === 'bag') {
    initialiseBag(engine.state.entities[0], {
      abilities: engine.state.abilities, lucky: false, dynamite: engine.state.dynamite,
    }, () => 0.5);
  }
  for (const player of engine.state.players) {
    player.angle = Math.atan2(600 - player.origin.x, 390 - player.origin.y);
  }
  return engine;
}

function acquire(engine: GameEngine, player: Player = engine.state.players[0]): void {
  engine.action(player.id, 'launch');
  for (let i = 0; i < 180 && player.cargoId === null; i++) engine.tick(1 / 60);
  expect(player.cargoId).not.toBeNull();
}

function enterShop(engine: GameEngine, score = 2000): void {
  engine.state.score = score;
  engine.finishEarly();
  expect(engine.state.phase).toBe('results');
  engine.openShop();
  if (engine.state.phase === 'draft') engine.chooseAbility(engine.state.abilityOffers[0]);
  expect(engine.state.phase).toBe('shop');
}

describe('keyboard mappings', () => {
  it('keeps down to launch and up for dynamite in solo', () => {
    expect(keyboardAction('ArrowDown', 'solo')).toEqual({ player: 1, action: 'launch' });
    expect(keyboardAction('ArrowUp', 'solo')).toEqual({ player: 1, action: 'bomb' });
    expect(keyboardAction('KeyS', 'solo')).toBeNull();
    expect(keyboardAction('KeyW', 'solo')).toBeNull();
  });

  it('maps left-side W/S to player 1 and right-side arrows to player 2 in co-op', () => {
    expect(keyboardAction('KeyS', 'coop')).toEqual({ player: 1, action: 'launch' });
    expect(keyboardAction('KeyW', 'coop')).toEqual({ player: 1, action: 'bomb' });
    expect(keyboardAction('ArrowDown', 'coop')).toEqual({ player: 2, action: 'launch' });
    expect(keyboardAction('ArrowUp', 'coop')).toEqual({ player: 2, action: 'bomb' });
    expect(keyboardAction('KeyA', 'coop')).toBeNull();
  });
});

describe('swept hook collision', () => {
  it('finds the first intersection instead of jumping past small targets', () => {
    expect(segmentCircleHit({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 0 }, 10)).toBeCloseTo(0.4);
    expect(segmentCircleHit({ x: 50, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 0 }, 10)).toBe(0);
  });

  describe('viewport-aware hooks', () => {
    it('does not grab a gem outside its visible radius on a wide display', () => {
      const engine = fixture('diamond');
      engine.setViewport(2400, 720);
      engine.state.entities[0].x = 618;
      engine.state.players[0].angle = 0;
      engine.action(1, 'launch');
      engine.tick(0.5);
      expect(engine.state.players[0].cargoId).toBeNull();
      expect(engine.state.entities[0].claimedBy).toBeNull();
    });

    it('waits for the visible gem boundary on a tall display', () => {
      const engine = fixture('diamond');
      engine.setViewport(1200, 1440);
      engine.state.players[0].angle = 0;
      engine.action(1, 'launch');
      engine.tick(0.31);
      expect(engine.state.players[0].cargoId).toBeNull();
      engine.tick(0.03);
      expect(engine.state.players[0].cargoId).toBe(1);
    });

    it('keeps captured cargo attached and preserves the run when resizing', () => {
      const engine = fixture();
      acquire(engine);
      engine.pause();
      const time = engine.state.timeLeft;
      const viewport = createViewport(390, 776);
      engine.setViewport(390, 776);
      const player = engine.state.players[0];
      const cargo = engine.state.entities[0];
      const tip = projectPoint(hookTip(player), viewport);
      const projectedCargo = projectPoint(cargo, viewport);
      expect(Math.hypot(projectedCargo.x - tip.x, projectedCargo.y - tip.y)).toBeCloseTo(cargo.radius * 0.42);
      expect(player.cargoId).toBe(cargo.id);
      expect(cargo.claimedBy).toBe(player.id);
      expect(player.origin.y).toBe(viewport.originY);
      expect(engine.state.timeLeft).toBe(time);
      expect(engine.state.score).toBe(0);
      expect(engine.state.phase).toBe('paused');
      engine.resume();
      advance(engine, 5);
      expect(engine.state.score).toBe(500);
    });

    it('retains the viewport anchor across mode selection, restarts, and level changes', () => {
      const engine = new GameEngine();
      const viewport = createViewport(390, 776);
      engine.setViewport(390, 776);
      engine.preview('coop');
      expect(engine.state.players.every((player) => player.origin.y === viewport.originY)).toBe(true);
      beginRun(engine, 'coop');
      expect(engine.state.players.every((player) => player.origin.y === viewport.originY)).toBe(true);
      enterShop(engine);
      engine.nextLevel();
      expect(engine.state.players.every((player) => player.origin.y === viewport.originY)).toBe(true);
      engine.menu();
      beginRun(engine, 'solo');
      expect(engine.state.players[0].origin.y).toBe(viewport.originY);
    });
  });

  it('rejects missed, behind-the-hook, and zero-length segments', () => {
    expect(segmentCircleHit({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 50 }, 10)).toBeNull();
    expect(segmentCircleHit({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: -20, y: 0 }, 10)).toBeNull();
    expect(segmentCircleHit({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 50, y: 0 }, 10)).toBeNull();
  });
});

describe('mining loop', () => {
  it('starts a clean run with the appropriate players and the original empty wallet and dynamite stock', () => {
    const engine = new GameEngine();
    expect(engine.state.phase).toBe('menu');
    expect(engine.state.mode).toBe('solo');
    engine.preview('coop');
    expect(engine.state.target).toBe(650);
    expect(engine.state.duration).toBe(40);
    expect(engine.state.timeLeft).toBe(40);
    engine.start('coop');
    expect(engine.state.phase).toBe('draft');
    expect(engine.state.abilityOffers).toHaveLength(3);
    expect(engine.state.players.map((player) => player.id)).toEqual([1, 2]);
    expect(engine.state.dynamite).toBe(0);
    engine.state.score = 1500;
    engine.state.activeUpgrades = ['strength'];
    engine.start('solo');
    expect(engine.state.score).toBe(0);
    expect(engine.state.target).toBe(650);
    expect(engine.state.players).toHaveLength(1);
    expect(engine.state.activeUpgrades).toEqual([]);
    expect(engine.state.dynamite).toBe(0);
    expect(engine.state.duration).toBe(60);
    expect(engine.state.timeLeft).toBe(60);
  });

  it.each([
    ['solo', 60],
    ['coop', 40],
  ] as const)('ends %s rounds at exactly %i seconds and restores that limit when restarted', (mode, duration) => {
    const engine = new GameEngine();
    beginRun(engine, mode);
    expect(engine.state.duration).toBe(duration);
    expect(engine.state.timeLeft).toBe(duration);
    engine.tick(duration - 0.25);
    expect(engine.state.phase).toBe('playing');
    expect(engine.state.timeLeft).toBe(0.25);
    engine.tick(0.25);
    expect(engine.state.phase).toBe('gameover');
    expect(engine.state.timeLeft).toBe(0);
    expect(engine.state.result?.timeUsed).toBe(duration);
    engine.menu();
    expect(engine.state.duration).toBe(duration);
    expect(engine.state.timeLeft).toBe(duration);
    beginRun(engine, mode);
    expect(engine.state.duration).toBe(duration);
    expect(engine.state.timeLeft).toBe(duration);
  });

  it('swings within its arc and locks direction when launched', () => {
    const engine = fixture();
    advance(engine, 0.3);
    const player = engine.state.players[0];
    expect(Math.abs(player.angle)).toBeLessThanOrEqual(MAX_ANGLE);
    const angle = player.angle;
    engine.action(1, 'launch');
    advance(engine, 0.1);
    expect(player.angle).toBe(angle);
    expect(player.length).toBeGreaterThan(REST_LENGTH);
    expect(player.phase).toBe('extending');
    engine.action(1, 'launch');
    expect(player.angle).toBe(angle);
  });

  it('awards money only after hauling the item to the surface', () => {
    const engine = fixture('gold-medium');
    acquire(engine);
    expect(engine.state.score).toBe(0);
    expect(engine.state.entities[0].claimedBy).toBe(1);
    advance(engine, 5);
    expect(engine.state.score).toBe(250);
    expect(engine.state.players[0].roundEarned).toBe(250);
    expect(engine.state.goldCollected).toBe(1);
    expect(engine.state.entities[0].active).toBe(false);
    expect(engine.state.players[0].cargoId).toBeNull();
    expect(engine.state.players[0].phase).toBe('swinging');
  });

  it.each([
    ['gold-tiny', 50],
    ['gold-small', 100],
    ['gold-medium', 250],
    ['gold-large', 500],
    ['rock-small', 11],
    ['rock-large', 20],
    ['bone-small', 7],
    ['bone-large', 20],
    ['mole', 2],
    ['mole-diamond', 602],
  ] as const)('collects %s for %i coins', (kind, value) => {
    const engine = fixture(kind);
    engine.state.entities[0].speed = 0;
    acquire(engine);
    advance(engine, 8);
    expect(engine.state.score).toBe(value);
    expect(engine.state.players[0].earned).toBe(value);
  });

  it('grabs the nearest item when a segment crosses multiple objects', () => {
    const engine = fixture();
    engine.state.entities.unshift(makeEntity('rock-small', 600, 270, 3));
    engine.action(1, 'launch');
    engine.tick(0.8);
    expect(engine.state.players[0].cargoId).toBe(3);
    expect(engine.state.entities.find((entity) => entity.id === 1)?.claimedBy).toBeNull();
  });

  it('returns empty hooks from the world boundary without leaving the playfield', () => {
    const engine = fixture();
    const player = engine.state.players[0];
    player.angle = MAX_ANGLE;
    engine.action(1, 'launch');
    engine.tick(3);
    expect(player.phase).toBe('retracting');
    expect(hookTip(player).x).toBeLessThanOrEqual(WIDTH - 18 + 0.001);
    expect(hookTip(player).y).toBeLessThanOrEqual(HEIGHT - 18);
    advance(engine, 3);
    expect(player.phase).toBe('swinging');
    expect(player.length).toBe(REST_LENGTH);
    expect(engine.state.score).toBe(0);
  });

  it('hauls diamonds faster than large rocks', () => {
    const diamond = fixture('diamond');
    const rock = fixture('rock-large');
    acquire(diamond);
    acquire(rock);
    advance(diamond, 1);
    advance(rock, 1);
    expect(diamond.state.score).toBe(600);
    expect(rock.state.score).toBe(0);
    expect(rock.state.players[0].phase).toBe('retracting');
  });

  it('applies original drink strength and keeps bag strength until the next shop', () => {
    const normal = fixture();
    const strong = fixture();
    strong.state.activeUpgrades = ['strength'];
    acquire(normal);
    acquire(strong);
    normal.tick(0.5);
    strong.tick(0.5);
    expect(strong.state.players[0].length).toBeLessThan(normal.state.players[0].length);

    const boosted = fixture();
    boosted.state.bagStrength = true;
    acquire(boosted);
    boosted.tick(0.5);
    expect(boosted.state.players[0].length).toBeLessThan(normal.state.players[0].length);
    advance(boosted, 30);
    expect(boosted.state.bagStrength).toBe(true);
    enterShop(boosted);
    expect(boosted.state.bagStrength).toBe(false);
  });

  it('moves uncaught moles, reflects at the edge, and stops their wandering when caught', () => {
    const engine = fixture('mole-diamond');
    const mole = engine.state.entities[0];
    mole.x = WIDTH - 66;
    mole.direction = 1;
    engine.tick(0.2);
    expect(mole.direction).toBe(-1);
    expect(mole.x).toBe(WIDTH - 65);
    mole.x = 600;
    const player = engine.state.players[0];
    player.angle = 0;
    acquire(engine);
    advance(engine, 3);
    expect(engine.state.score).toBe(602);
    expect(engine.state.diamondsCollected).toBe(1);
  });
});

describe('shared-screen cooperation', () => {
  it('lets both players extend independently in the same frame', () => {
    const engine = fixture('gold-large', 'coop');
    engine.action(1, 'launch');
    engine.action(2, 'launch');
    expect(engine.state.players.map((player) => player.phase)).toEqual(['extending', 'extending']);
    engine.tick(0.15);
    expect(engine.state.players.every((player) => player.length > REST_LENGTH)).toBe(true);
  });

  it('reserves an object for one hook and never awards it twice', () => {
    const engine = fixture('gold-large', 'coop');
    engine.action(1, 'launch');
    engine.action(2, 'launch');
    advance(engine, 0.8);
    expect(engine.state.players.filter((player) => player.cargoId === 1)).toHaveLength(1);
    expect(engine.state.entities[0].claimedBy).toBe(1);
    advance(engine, 7);
    expect(engine.state.score).toBe(500);
    expect(engine.state.players.reduce((sum, player) => sum + player.earned, 0)).toBe(500);
  });

  it('shares dynamite and freezes both players when paused', () => {
    const engine = fixture('rock-large', 'coop');
    acquire(engine, engine.state.players[1]);
    engine.action(2, 'bomb');
    expect(engine.state.dynamite).toBe(1);
    expect(engine.state.players[1].cargoId).toBeNull();
    engine.action(1, 'launch');
    engine.pause();
    const snapshot = JSON.stringify(engine.state);
    engine.tick(12);
    engine.action(1, 'bomb');
    engine.action(2, 'launch');
    expect(JSON.stringify(engine.state)).toBe(snapshot);
    engine.resume();
    engine.tick(0.1);
    expect(engine.state.phase).toBe('playing');
    expect(engine.state.timeLeft).toBeLessThan(JSON.parse(snapshot).timeLeft);
  });
});

describe('dynamite, hazards, and loot', () => {
  it('does not waste a bomb on an empty hook and reports the reason', () => {
    const engine = fixture();
    engine.action(1, 'bomb');
    expect(engine.state.dynamite).toBe(1);
    expect(engine.state.notice?.text['zh-CN']).toContain('抓住重物');
  });

  it('destroys cargo without awarding money and returns the hook unladen', () => {
    const engine = fixture('rock-large');
    acquire(engine);
    const before = engine.state.players[0].length;
    const cursor = engine.state.players[0].reel!.cursor;
    engine.action(1, 'bomb');
    expect(engine.state.dynamite).toBe(0);
    expect(engine.state.entities[0].active).toBe(false);
    expect(engine.state.score).toBe(0);
    expect(engine.state.players[0].cargoId).toBeNull();
    engine.tick(1 / ORIGINAL_FRAME_RATE);
    expect(engine.state.players[0].reel?.cursor).toBe(cursor + 15);
    expect(engine.state.players[0].length).toBeCloseTo(
      before - (originalReelDistance(cursor) - originalReelDistance(cursor + 15)) * HEIGHT / ORIGINAL_STAGE_HEIGHT,
    );
    engine.tick(1 / ORIGINAL_FRAME_RATE);
    expect(engine.state.players[0].reel?.cursor).toBe(cursor + 31);
    engine.action(1, 'bomb');
    expect(engine.state.dynamite).toBe(0);
    expect(engine.state.notice?.text['zh-CN']).toContain('没有炸药');
  });

  it('chains TNT explosions, destroys nearby valuables, and leaves distant items alone', () => {
    const engine = fixture('tnt');
    engine.state.entities = [
      makeEntity('tnt', 600, 300, 1),
      makeEntity('tnt', 735, 320, 2),
      makeEntity('gold-large', 850, 370, 3),
      makeEntity('diamond', 1080, 630, 4),
    ];
    engine.action(1, 'launch');
    advance(engine, 0.4);
    expect(engine.state.entities.map((entity) => entity.active)).toEqual([false, false, false, true]);
    expect(engine.state.entities[0].kind).toBe('tnt-fragment');
    expect(engine.state.score).toBe(1);
    expect(engine.state.dynamite).toBe(1);
    expect(engine.state.players[0].cargoId).toBeNull();
    expect(engine.state.notice?.text['zh-CN']).toContain('TNT');
  });

  it('clears the other player’s cargo if it is inside a TNT blast', () => {
    const engine = fixture('tnt', 'coop');
    const tnt = makeEntity('tnt', 600, 370, 1);
    const cargo = makeEntity('gold-large', 650, 400, 2);
    engine.state.entities = [tnt, cargo, makeEntity('diamond', 70, 650, 3)];
    const second = engine.state.players[1];
    cargo.claimedBy = 2;
    second.phase = 'retracting';
    second.cargoId = cargo.id;
    second.length = 310;
    engine.state.players[0].angle = Math.atan2(tnt.x - 360, tnt.y - 143);
    engine.action(1, 'launch');
    engine.tick(0.6);
    expect(tnt).toMatchObject({ kind: 'tnt-fragment', active: true, claimedBy: 1 });
    expect(cargo.active).toBe(false);
    expect(second.cargoId).toBeNull();
    expect(engine.state.score).toBe(0);
  });

  it.each([
    ['diamond', 'polish', 900],
    ['mole-diamond', 'polish', 902],
    ['rock-small', 'rockbook', 33],
    ['rock-large', 'rockbook', 60],
    ['bone-small', 'rockbook', 7],
    ['bone-large', 'rockbook', 20],
  ] as const)('values %s correctly with %s', (kind, upgrade, expected) => {
    const engine = fixture(kind);
    engine.state.entities[0].speed = 0;
    engine.state.activeUpgrades = [upgrade];
    applyRoundValue(engine.state.entities[0], [upgrade]);
    acquire(engine);
    advance(engine, 8);
    expect(engine.state.score).toBe(expected);
  });

  it('opens bags into a real reward, not a zero-value placeholder', () => {
    const engine = fixture('bag');
    acquire(engine);
    advance(engine, 4);
    expect(engine.state.collected).toBe(1);
    expect(engine.state.score > 0 || engine.state.dynamite > 1 || engine.state.bagStrength).toBe(true);
    expect(engine.state.texts.length > 0 || engine.state.entities[0].active === false).toBe(true);
  });
});

describe('timer, progression, and shop', () => {
  it.each([
    ['solo', 11, 18510],
    ['coop', 11, 18510],
    ['solo', 20, 71450],
    ['coop', 20, 71450],
    ['solo', 21, 79450],
    ['coop', 21, 79450],
  ] as const)('uses the exact new %s stage %i target for early finish and timeout decisions', (mode, level, target) => {
    for (const shortfall of [1, 0]) {
      const engine = fixture('gold-large', mode);
      engine.state.level = level - 1;
      engine.state.phase = 'shop';
      engine.nextLevel();
      expect(engine.state.target).toBe(target);
      engine.state.score = target - shortfall;
      engine.finishEarly();
      if (shortfall === 1) {
        expect(engine.state.phase).toBe('playing');
        engine.state.timeLeft = 0.01;
        engine.tick(0.02);
      }
      expect(engine.state.phase).toBe(shortfall === 0 ? 'results' : 'gameover');
      expect(engine.state.result?.passed).toBe(shortfall === 0);
    }
  });

  it('ends at zero and does not credit cargo still underground', () => {
    const engine = fixture();
    acquire(engine);
    engine.state.timeLeft = 0.05;
    const elapsed = engine.state.elapsed;
    engine.tick(0.2);
    expect(engine.state.timeLeft).toBe(0);
    expect(engine.state.elapsed).toBeCloseTo(elapsed + 0.05);
    expect(engine.state.phase).toBe('gameover');
    expect(engine.state.score).toBe(0);
    expect(engine.state.result?.passed).toBe(false);
  });

  it('continues mining after the target is met and supports early finish', () => {
    const engine = fixture('diamond');
    engine.state.score = 100;
    acquire(engine);
    advance(engine, 3);
    expect(engine.state.score).toBe(700);
    expect(engine.state.phase).toBe('playing');
    expect(engine.state.goalAnnounced).toBe(true);
    engine.finishEarly();
    expect(engine.state.phase).toBe('results');
    expect(engine.state.result?.passed).toBe(true);
  });

  it('prevents early finishing below the goal or while carrying a valuable', () => {
    const engine = fixture();
    engine.finishEarly();
    expect(engine.state.phase).toBe('playing');
    engine.state.score = 700;
    acquire(engine);
    engine.finishEarly();
    expect(engine.state.phase).toBe('playing');
    expect(engine.state.notice?.text['zh-CN']).toContain('钩上');
  });

  it('finishes an exhausted mine without making the player wait', () => {
    const engine = fixture('gold-large');
    engine.state.entities.pop();
    acquire(engine);
    advance(engine, 7);
    expect(engine.state.timeLeft).toBeGreaterThan(50);
    expect(engine.state.phase).toBe('gameover');
    expect(engine.state.score).toBe(500);
  });

  it('emits countdown sounds once per last-ten second', () => {
    const engine = fixture();
    const sounds: Sound[] = [];
    engine.onSound((sound) => sounds.push(sound));
    engine.state.timeLeft = 10.1;
    advance(engine, 1.5);
    expect(sounds.filter((sound) => sound === 'tick')).toHaveLength(2);
  });

  it('deducts real money, limits stock, and rejects unaffordable purchases', () => {
    const engine = fixture();
    enterShop(engine);
    const strength = engine.state.shop.find((item) => item.id === 'strength')!;
    if (strength.price === null) throw new Error('The first shop must have payable prices.');
    expect(engine.buy('strength')).toBe(true);
    expect(engine.state.score).toBe(2000 - strength.price);
    expect(engine.state.pendingUpgrades).toEqual(['strength']);
    expect(engine.buy('strength')).toBe(false);
    expect(engine.state.pendingUpgrades).toEqual(['strength']);
    expect(engine.buy('dynamite')).toBe(true);
    expect(engine.buy('dynamite')).toBe(false);
    expect(engine.state.dynamite).toBe(2);
    engine.state.score = 0;
    expect(engine.buy('luck')).toBe(false);
    expect(engine.state.pendingUpgrades).not.toContain('luck');
    expect(engine.state.notice?.text['zh-CN']).toContain('金币不够');
  });

  it('carries the wallet and bombs forward but consumes upgrades after one stage', () => {
    const engine = fixture();
    enterShop(engine);
    engine.buy('strength');
    engine.buy('dynamite');
    const wallet = engine.state.score;
    engine.nextLevel();
    expect(engine.state.level).toBe(2);
    expect(engine.state.score).toBe(wallet);
    expect(engine.state.roundStartScore).toBe(wallet);
    expect(engine.state.dynamite).toBe(2);
    expect(engine.state.target).toBe(1195);
    expect(engine.state.activeUpgrades).toEqual(['strength']);
    expect(engine.state.pendingUpgrades).toEqual([]);
    enterShop(engine, 1700);
    engine.nextLevel();
    expect(engine.state.level).toBe(3);
    expect(engine.state.dynamite).toBe(2);
    expect(engine.state.activeUpgrades).toEqual([]);
  });

  it.each(['solo', 'coop'] as const)('keeps %s progression, shops, and supplies working through 1,000 stages', (mode) => {
    const engine = fixture('gold-large', mode);
    engine.openShop();
    engine.nextLevel();
    expect(engine.state.level).toBe(1);
    expect(engine.buy('strength')).toBe(false);
    for (let level = 1; level <= 1000; level++) {
      expect(engine.state.level).toBe(level);
      engine.state.score = engine.state.target;
      engine.finishEarly();
      expect(engine.state.phase).toBe('results');
      engine.openShop();
      if (engine.state.phase === 'draft') engine.chooseAbility(engine.state.abilityOffers[0]);
      const expectedDuration = engine.state.abilities.includes('time-rush')
        ? mode === 'coop' ? 32 : 48
        : mode === 'coop' ? 40 : 60;
      expect(engine.state.shop).toHaveLength(5);
      if (level === OPENING_LEVEL_COUNT) {
        expect(engine.buy('strength')).toBe(true);
        expect(engine.buy('dynamite')).toBe(true);
      }
      const wallet = engine.state.score;
      engine.nextLevel();
      expect(engine.state.phase).toBe('playing');
      expect(engine.state.score).toBe(wallet);
      expect(engine.state.roundStartScore).toBe(wallet);
      expect(engine.state.target).toBeGreaterThan(levelTarget(level));
      expect(engine.state.target).toBe(levelTarget(level + 1));
      expect(engine.state.levelName).toBe(getLevelInfo(level + 1, mode).name);
      expect(engine.state.duration).toBe(expectedDuration);
      expect(engine.state.timeLeft).toBe(expectedDuration);
      if (level === OPENING_LEVEL_COUNT) {
        expect(engine.state.activeUpgrades).toEqual(['strength']);
        expect(engine.state.dynamite).toBe(mode === 'solo' ? 2 : 3);
      } else if (level === OPENING_LEVEL_COUNT + 1) {
        expect(engine.state.activeUpgrades).toEqual([]);
      }
    }
    expect(engine.state.level).toBe(1001);
    expect(engine.state.phase).toBe('playing');
    engine.state.timeLeft = 0.01;
    engine.tick(0.02);
    expect(engine.state.phase).toBe('gameover');
    engine.start(mode);
    expect(engine.state.level).toBe(1);
    expect(engine.state.score).toBe(0);
    expect(engine.state.dynamite).toBe(0);
    expect(engine.state.timeLeft).toBe(mode === 'solo' ? 60 : 40);
  });

  it('can create a far-future stage without walking or storing all preceding stages', () => {
    const engine = fixture();
    engine.state.level = 999_999;
    engine.state.phase = 'shop';
    engine.nextLevel();
    expect(engine.state.level).toBe(1_000_000);
    expect(engine.state.phase).toBe('playing');
    expect(engine.state.target).toBe(levelTarget(1_000_000));
    expect(engine.state.entities.length).toBeLessThanOrEqual(40);
    expect(engine.state.levelName['zh-CN']).not.toBe('');
    expect(engine.state.levelName.en).not.toBe('');
  });
});

describe('original resource categories with custom placements', () => {
  it.each(['solo', 'coop'] as const)('keeps every %s category in bounds and reachable without assuming every mine pays its target increment', (mode) => {
    for (let level = 1; level <= OPENING_LEVEL_COUNT; level++) {
      const entities = createLevel(level, mode);
      const previousTarget = level === 1 ? 0 : levelTarget(level - 1);
      const possibleIncome = entities.reduce((sum, entity) => sum + entity.value, 0);
      expect(possibleIncome, `${mode} level ${level} supply`).toBeGreaterThan(0);
      const origins = mode === 'solo' ? [600] : [360, 840];
      for (const entity of entities) {
        expect(entity.x - entity.radius).toBeGreaterThan(0);
        expect(entity.x + entity.radius).toBeLessThan(WIDTH);
        expect(entity.y + entity.radius).toBeLessThan(HEIGHT);
        expect(entity.y - entity.radius).toBeGreaterThan(190);
        expect(origins.some((x) => Math.abs(Math.atan2(entity.x - x, entity.y - 143)) <= MAX_ANGLE)).toBe(true);
      }
      expect(levelTarget(level)).toBeGreaterThan(previousTarget);
    }
  });

  it('keeps co-op additional treasure without increasing the score target', () => {
    expect(LEVELS).toHaveLength(10);
    for (let level = 1; level <= OPENING_LEVEL_COUNT; level++) {
      expect(createLevel(level, 'coop').length).toBeGreaterThan(createLevel(level, 'solo').length);
      expect(getLevelInfo(level, 'coop').target).toBe(getLevelInfo(level, 'solo').target);
    }
  });
});
