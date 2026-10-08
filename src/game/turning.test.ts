import { describe, expect, it, vi } from 'vitest';
import {
  aimLineSegment, canTurnHook, GameEngine, hookAngle, hookCargoPosition,
  hookLengthFromReelDistance, hookPath, hookReelDistance, hookTip, maxHookLength,
} from './engine';
import { HEIGHT, makeEntity, REST_LENGTH, WIDTH } from './levels';
import { interpolatedReelDistance, ORIGINAL_FRAME_RATE, ORIGINAL_STAGE_HEIGHT, originalReelDistance, stepOriginalReel } from './hauling';
import type { AbilityId, EntityKind, Mode, Point } from './types';
import { createViewport, DEFAULT_VIEWPORT, projectPoint } from './viewport';
import { advance, startTestRun } from '../../tests/engine-driver';

function fixture(
  angle = 0,
  abilities: AbilityId[] = ['right-angle-turn', 'aim-line'],
  mode: Mode = 'solo',
  random: () => number = () => 0.75,
): GameEngine {
  const engine = new GameEngine(random);
  startTestRun(engine, mode, 'right-angle-turn');
  engine.state.abilities = abilities;
  engine.state.entities = [makeEntity('gold-tiny', 80, 650, 99)];
  for (const player of engine.state.players) player.angle = angle;
  return engine;
}

function launchAndTurn(engine: GameEngine): Point {
  engine.action(1, 'launch');
  engine.tick(0.3);
  const bend = hookTip(engine.state.players[0]);
  engine.action(1, 'launch');
  return bend;
}

function addTurnTarget(engine: GameEngine, kind: EntityKind = 'diamond', distance = 150) {
  const player = engine.state.players[0];
  const tip = hookTip(player);
  const angle = hookAngle(player);
  const entity = makeEntity(kind, tip.x + Math.sin(angle) * distance, tip.y + Math.cos(angle) * distance, 1);
  entity.speed = 0;
  if (kind === 'bag') entity.bagReward = { kind: 'cash', value: 275 };
  engine.state.entities.push(entity);
  return entity;
}

const viewports = [[1200, 720], [2400, 720], [390, 774]] as const;

describe('one right-angle turn per shot', () => {
  it.each(viewports.flatMap(([width, height]) => [-0.6, 0.6].map((angle) => [width, height, angle] as const)))(
    'turns inward by exactly 90 degrees at %i by %i with angle %f',
    (width, height, angle) => {
      const engine = fixture(angle);
      const viewport = createViewport(width, height);
      engine.setViewport(width, height);
      const player = engine.state.players[0];
      const bend = launchAndTurn(engine);
      const length = player.length;
      expect(hookTip(player)).toEqual(bend);
      expect(player.angle).toBe(angle);
      expect(canTurnHook(player)).toBe(false);
      expect(player.turn?.atLength).toBe(length);
      const planned = { ...player.turn };
      engine.action(1, 'launch');
      expect(player.turn).toEqual(planned);
      engine.tick(0.1);
      const tip = hookTip(player);
      expect(player.length).toBeCloseTo(length + 54);
      expect(Math.sign(tip.x - bend.x)).toBe(angle < 0 ? 1 : -1);
      expect(tip.y).toBeGreaterThan(bend.y);
      const first = projectPoint({ x: Math.sin(angle), y: Math.cos(angle) }, viewport);
      const second = projectPoint({ x: tip.x - bend.x, y: tip.y - bend.y }, viewport);
      const cosine = (first.x * second.x + first.y * second.y) / Math.hypot(first.x, first.y) / Math.hypot(second.x, second.y);
      expect(cosine).toBeCloseTo(0, 12);
      expect(hookPath(player)).toEqual([player.origin, bend, tip]);
    },
  );

  it.each([[0.1, -1], [0.9, 1]])('locks a vertical shot to random=%s, direction=%i without preview rerolls', (roll, direction) => {
    const random = vi.fn(() => roll);
    const engine = fixture(0, ['right-angle-turn', 'aim-line'], 'solo', random);
    const player = engine.state.players[0];
    random.mockClear();
    engine.action(1, 'launch');
    expect(random).toHaveBeenCalledTimes(1);
    expect(canTurnHook(player)).toBe(true);
    const snapshot = structuredClone(engine.state);
    for (let frame = 0; frame < 100; frame++) {
      const guide = aimLineSegment(player, engine.state, DEFAULT_VIEWPORT)!;
      expect(Math.sign(guide.to.x - guide.from.x)).toBe(direction);
      expect(guide.to.y).toBeCloseTo(guide.from.y, 10);
    }
    expect(engine.state).toEqual(snapshot);
    engine.tick(0.3);
    const preview = aimLineSegment(player, engine.state, DEFAULT_VIEWPORT);
    const bend = hookTip(player);
    engine.action(1, 'launch');
    expect(aimLineSegment(player, engine.state, DEFAULT_VIEWPORT)).toEqual(preview);
    engine.tick(0.2);
    expect(Math.sign(hookTip(player).x - bend.x)).toBe(direction);
    expect(hookTip(player).y).toBeCloseTo(bend.y, 10);
    engine.setViewport(2400, 720);
    expect(Math.sign(Math.sin(hookAngle(player)))).toBe(direction);
    expect(random).toHaveBeenCalledTimes(1);
  });

  it.each([-0.000001, 0.000001])('does not randomize a nearly vertical angle of %f', (angle) => {
    const random = vi.fn(() => 0.1);
    const engine = fixture(angle, ['right-angle-turn'], 'solo', random);
    random.mockClear();
    launchAndTurn(engine);
    expect(Math.sign(Math.sin(hookAngle(engine.state.players[0])))).toBe(angle < 0 ? 1 : -1);
    expect(random).not.toHaveBeenCalled();
  });

  it('ignores a second launch without the ability and while paused, carrying, or returning', () => {
    const ordinary = fixture(0, ['aim-line']);
    ordinary.action(1, 'launch');
    ordinary.tick(0.2);
    const straight = structuredClone(ordinary.state.players[0]);
    ordinary.action(1, 'launch');
    expect(ordinary.state.players[0]).toEqual(straight);

    const engine = fixture();
    const player = engine.state.players[0];
    engine.action(1, 'launch');
    engine.pause();
    const paused = structuredClone(engine.state);
    engine.action(1, 'launch');
    engine.tick(10);
    expect(engine.state).toEqual(paused);
    engine.resume();
    engine.state.entities.push(makeEntity('gold-large', 600, 350, 1));
    engine.tick(0.5);
    expect(player.phase).toBe('retracting');
    expect(player.cargoId).toBe(1);
    expect(canTurnHook(player)).toBe(false);
    const caught = structuredClone(player);
    engine.action(1, 'launch');
    expect(player).toEqual(caught);
    advance(engine, 8, 1 / 120);
    expect(player.turn).toBeNull();
    engine.action(1, 'launch');
    expect(canTurnHook(player)).toBe(true);
  });

  it('gives each co-op claw its own turn and resets both on a new stage or restart', () => {
    const engine = fixture(0, ['right-angle-turn'], 'coop');
    const [first, second] = engine.state.players;
    engine.action(1, 'launch');
    engine.action(2, 'launch');
    engine.tick(0.2);
    engine.action(1, 'launch');
    expect(canTurnHook(first)).toBe(false);
    expect(canTurnHook(second)).toBe(true);
    engine.tick(0.1);
    engine.action(2, 'launch');
    expect(canTurnHook(second)).toBe(false);
    expect(first.turn?.atLength).not.toBe(second.turn?.atLength);
    engine.state.score = engine.state.target;
    engine.finishEarly();
    engine.openShop();
    engine.nextLevel();
    expect(engine.state.players.every((player) => player.turn === null)).toBe(true);
    engine.start('solo');
    expect(engine.state.players[0].turn).toBeNull();
  });
});

describe('bent-rope boundaries and retrieval', () => {
  it.each([-1.2, -0.4, 0, 0.4, 1.2])('stops at the map boundary and retracts along both legs at angle %f', (angle) => {
    const engine = fixture(angle);
    const player = engine.state.players[0];
    const bend = launchAndTurn(engine);
    const bendLength = player.turn!.atLength!;
    const outgoingAngle = player.turn!.angle;
    engine.tick(3);
    expect(player.phase).toBe('retracting');
    expect(player.cargoId).toBeNull();
    const end = hookTip(player);
    expect(end.x).toBeGreaterThanOrEqual(18 - 1e-9);
    expect(end.x).toBeLessThanOrEqual(WIDTH - 18 + 1e-9);
    expect(end.y).toBeGreaterThanOrEqual(18 - 1e-9);
    expect(end.y).toBeLessThanOrEqual(HEIGHT - 18 + 1e-9);
    expect(Math.min(Math.abs(end.x - 18), Math.abs(end.x - WIDTH + 18), Math.abs(end.y - 18), Math.abs(end.y - HEIGHT + 18))).toBeLessThan(1e-8);
    const seenLegs = new Set<number>();
    for (let step = 0; step < 600 && player.phase === 'retracting'; step++) {
      const length = player.length;
      engine.tick(1 / 120);
      expect(player.length).toBeLessThanOrEqual(length);
      const secondLeg = player.length > bendLength;
      seenLegs.add(secondLeg ? 2 : 1);
      const from = secondLeg ? bend : player.origin;
      const direction = secondLeg ? outgoingAngle : angle;
      const distance = secondLeg ? player.length - bendLength : player.length;
      const tip = hookTip(player);
      expect(tip.x).toBeCloseTo(from.x + Math.sin(direction) * distance, 10);
      expect(tip.y).toBeCloseTo(from.y + Math.cos(direction) * distance, 10);
    }
    expect(seenLegs).toEqual(new Set([1, 2]));
    expect(player.phase).toBe('swinging');
    expect(player.length).toBe(REST_LENGTH);
    expect(player.turn).toBeNull();
    expect(engine.state.score).toBe(0);
  });

  it.each(viewports)('uses both projected path lengths in the original reel timeline at %i by %i', (width, height) => {
    const engine = fixture(-0.6);
    const viewport = createViewport(width, height);
    engine.setViewport(width, height);
    launchAndTurn(engine);
    const player = engine.state.players[0];
    const cargo = addTurnTarget(engine, 'gold-large');
    engine.tick(0.4);
    expect(player.cargoId).toBe(cargo.id);
    const turn = player.turn!;
    const firstScale = Math.hypot(Math.sin(player.angle) * viewport.stretchX, Math.cos(player.angle) * viewport.stretchY);
    const secondScale = Math.hypot(Math.sin(turn.angle) * viewport.stretchX, Math.cos(turn.angle) * viewport.stretchY);
    const expected = ((turn.atLength! - REST_LENGTH) * firstScale + (player.length - turn.atLength!) * secondScale)
      / (HEIGHT / ORIGINAL_STAGE_HEIGHT * viewport.stretchY);
    const motion = player.reel!;
    expect(originalReelDistance(motion.cursor) + motion.offset).toBeCloseTo(expected, 10);
    expect(hookReelDistance(player, viewport)).toBeCloseTo(expected, 10);
    const firstDistance = (turn.atLength! - REST_LENGTH) * firstScale / (HEIGHT / ORIGINAL_STAGE_HEIGHT * viewport.stretchY);
    for (const distance of [0, firstDistance - 0.01, firstDistance, firstDistance + 0.01, expected]) {
      const length = hookLengthFromReelDistance(player, distance, viewport);
      expect(hookReelDistance({ ...player, length }, viewport)).toBeCloseTo(distance, 10);
    }
    const reference = { ...motion };
    stepOriginalReel(reference, cargo.weight, false, false);
    engine.tick(1 / ORIGINAL_FRAME_RATE);
    expect(player.reel?.cursor).toBe(reference.cursor);
    expect(engine.state.score).toBe(0);
    advance(engine, 15, 1 / 120);
    expect(engine.state.score).toBe(500);
    expect(cargo).toMatchObject({ active: false, claimedBy: null });
  });

  it.each(['gold-large', 'diamond', 'bone-large', 'mole-diamond', 'bag', 'tnt-fragment'] as const)(
    'captures %s on the turned leg and keeps it attached until collection',
    (kind) => {
      const engine = fixture(0, ['right-angle-turn', 'clone']);
      launchAndTurn(engine);
      const cargo = addTurnTarget(engine, kind);
      engine.tick(0.4);
      const player = engine.state.players[0];
      expect(player.cargoId).toBe(cargo.id);
      expect(cargo.claimedBy).toBe(1);
      expect(engine.state.clonedEntityId).toBe(cargo.id);
      expect(cargo).toMatchObject(hookCargoPosition(player, cargo.radius, DEFAULT_VIEWPORT));
      expect(engine.state.score).toBe(0);
      advance(engine, 12, 1 / 120);
      expect(engine.state.score).toBe((kind === 'bag' ? 275 : cargo.value) * 2);
      expect(cargo).toMatchObject({ active: false, claimedBy: null });
      expect(player.turn).toBeNull();
    },
  );

  it('preserves the bent return route when dynamite destroys the cargo', () => {
    const engine = fixture();
    const bend = launchAndTurn(engine);
    const cargo = addTurnTarget(engine, 'gold-large');
    engine.tick(0.4);
    const player = engine.state.players[0];
    engine.state.dynamite = 1;
    engine.action(1, 'bomb');
    expect(cargo.active).toBe(false);
    expect(player.reel?.localFast).toBe(true);
    expect(player.cargoId).toBeNull();
    expect(hookPath(player)[1]).toEqual(bend);
    advance(engine, 5, 1 / 120);
    expect(player.phase).toBe('swinging');
    expect(player.turn).toBeNull();
    expect(engine.state.score).toBe(0);
  });

  it('crushes rocks on the actual return legs, not the diagonal shortcut across the corner', () => {
    const engine = fixture(0, ['right-angle-turn', 'rock-crusher']);
    const bend = launchAndTurn(engine);
    engine.tick(3);
    const player = engine.state.players[0];
    expect(player.phase).toBe('retracting');
    const horizontal = makeEntity('rock-small', 1000, bend.y, 1);
    const vertical = makeEntity('rock-small', 600, 270, 2);
    const diagonal = makeEntity('rock-small', 880, 270, 3);
    engine.state.entities.push(horizontal, vertical, diagonal);
    engine.tick(3);
    expect(horizontal.active).toBe(false);
    expect(vertical.active).toBe(false);
    expect(diagonal.active).toBe(true);
    expect(player.phase).toBe('swinging');
    expect(engine.state.score).toBe(0);
  });

  it.each(viewports)('keeps the corner, cargo, and pause state valid after resizing to %i by %i', (width, height) => {
    const engine = fixture(0.5);
    launchAndTurn(engine);
    const cargo = addTurnTarget(engine);
    engine.tick(0.4);
    engine.pause();
    const time = engine.state.timeLeft;
    engine.setViewport(width, height);
    const viewport = createViewport(width, height);
    const player = engine.state.players[0];
    const first = projectPoint({ x: Math.sin(player.angle), y: Math.cos(player.angle) }, viewport);
    const second = projectPoint({ x: Math.sin(player.turn!.angle), y: Math.cos(player.turn!.angle) }, viewport);
    expect(first.x * second.x + first.y * second.y).toBeCloseTo(0, 10);
    expect(Math.sin(player.turn!.angle)).toBeLessThan(0);
    expect(Math.cos(player.turn!.angle)).toBeGreaterThan(0);
    expect(player.length).toBeLessThanOrEqual(maxHookLength(player));
    expect(cargo).toMatchObject(hookCargoPosition(player, cargo.radius, viewport));
    expect(player.reel!.offset + originalReelDistance(player.reel!.cursor)).toBeCloseTo(hookReelDistance(player, viewport), 10);
    expect(engine.state.phase).toBe('paused');
    expect(engine.state.timeLeft).toBe(time);
    const snapshot = structuredClone(engine.state);
    const distance = interpolatedReelDistance(player.reel!, cargo.weight, false, false);
    const visual = { ...player, length: hookLengthFromReelDistance(player, distance, viewport) };
    expect(hookPath(visual).length).toBeGreaterThanOrEqual(2);
    expect(engine.state).toEqual(snapshot);
    engine.resume();
    advance(engine, 12, 1 / 120);
    expect(engine.state.score).toBe(600);
  });
});

describe('live turn guidance', () => {
  it('shows a straight pre-launch guide, a moving turn preview, and the committed heading after turning', () => {
    const engine = fixture();
    const player = engine.state.players[0];
    const before = aimLineSegment(player, engine.state, DEFAULT_VIEWPORT)!;
    expect(before.from.x).toBe(before.to.x);
    expect(before.to.y).toBeGreaterThan(before.from.y);
    engine.action(1, 'launch');
    const first = aimLineSegment(player, engine.state, DEFAULT_VIEWPORT)!;
    expect(first.to.x).toBeGreaterThan(first.from.x);
    expect(first.to.y).toBeCloseTo(first.from.y);
    engine.tick(0.2);
    const moved = aimLineSegment(player, engine.state, DEFAULT_VIEWPORT)!;
    expect(moved.from).toEqual(hookTip(player));
    expect(moved.from.y).toBeGreaterThan(first.from.y);
    expect(moved.to.y).toBeGreaterThan(first.to.y);
    engine.action(1, 'launch');
    expect(aimLineSegment(player, engine.state, DEFAULT_VIEWPORT)).toEqual(moved);
    engine.tick(0.1);
    const turned = aimLineSegment(player, engine.state, DEFAULT_VIEWPORT)!;
    expect(turned.from.x).toBeGreaterThan(moved.from.x);
    expect(turned.to.x).toBeCloseTo(WIDTH - 18);
    engine.pause();
    const paused = aimLineSegment(player, engine.state, DEFAULT_VIEWPORT);
    engine.tick(10);
    expect(aimLineSegment(player, engine.state, DEFAULT_VIEWPORT)).toEqual(paused);
    engine.resume();
    engine.tick(3);
    expect(player.phase).toBe('retracting');
    expect(aimLineSegment(player, engine.state, DEFAULT_VIEWPORT)).toBeNull();
  });

  it('stops the turn preview at the first blocking target and looks through crusher rocks without touching them', () => {
    const engine = fixture();
    engine.action(1, 'launch');
    engine.tick(0.3);
    const player = engine.state.players[0];
    const tip = hookTip(player);
    const rock = makeEntity('rock-large', tip.x + 100, tip.y, 1);
    const diamond = makeEntity('diamond', tip.x + 230, tip.y, 2);
    engine.state.entities.push(rock, diamond);
    const blocked = aimLineSegment(player, engine.state, DEFAULT_VIEWPORT)!;
    expect(blocked.to.x).toBeLessThan(rock.x);
    engine.state.abilities.push('rock-crusher');
    const through = aimLineSegment(player, engine.state, DEFAULT_VIEWPORT)!;
    expect(through.to.x).toBeGreaterThan(rock.x + rock.radius);
    expect(through.to.x).toBeLessThan(diamond.x);
    expect(rock.active).toBe(true);
    engine.action(1, 'launch');
    engine.tick(0.5);
    expect(rock.active).toBe(false);
    expect(player.cargoId).toBe(diamond.id);
    expect(aimLineSegment(player, engine.state, DEFAULT_VIEWPORT)).toBeNull();
  });

  it('requires Aim Line and keeps ordinary, non-turning shots unchanged', () => {
    const turningOnly = fixture(0, ['right-angle-turn']);
    expect(aimLineSegment(turningOnly.state.players[0], turningOnly.state, DEFAULT_VIEWPORT)).toBeNull();
    launchAndTurn(turningOnly);
    expect(aimLineSegment(turningOnly.state.players[0], turningOnly.state, DEFAULT_VIEWPORT)).toBeNull();
    const aimingOnly = fixture(0, ['aim-line']);
    expect(aimLineSegment(aimingOnly.state.players[0], aimingOnly.state, DEFAULT_VIEWPORT)).not.toBeNull();
    aimingOnly.action(1, 'launch');
    expect(aimLineSegment(aimingOnly.state.players[0], aimingOnly.state, DEFAULT_VIEWPORT)).toBeNull();
  });
});
