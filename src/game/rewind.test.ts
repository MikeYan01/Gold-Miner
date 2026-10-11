import { describe, expect, it, vi } from 'vitest';
import { GameEngine } from './engine';
import { makeEntity } from './levels';
import { createRandom } from './random';
import { createReelMotion } from './hauling';
import { createViewport } from './viewport';
import type { AbilityId, Mode } from './types';
import { advance, startTestRun } from '../../tests/engine-driver';

function start(mode: Mode = 'solo'): GameEngine {
  const engine = new GameEngine(createRandom(71));
  startTestRun(engine, mode, 'time-rewind');
  return engine;
}

function visitShop(engine: GameEngine): void {
  engine.state.score = Math.max(3000, engine.state.target);
  engine.finishEarly();
  engine.openShop();
  expect(engine.state.phase).toBe('shop');
}

describe('time rewind', () => {
  it.each(['solo', 'coop'] as const)('is available immediately and throughout a %s stage', (mode) => {
    for (const fraction of [0, 0.1, 0.9, 0.999]) {
      const engine = start(mode);
      const initial = structuredClone(engine.state);
      engine.tick(initial.timeLeft * fraction);
      const revision = engine.getSnapshot();
      const listener = vi.fn();
      const sound = vi.fn();
      engine.subscribe(listener);
      engine.onSound(sound);

      expect(engine.rewind()).toBe(true);
      expect(engine.state).toEqual({
        ...initial, rewindUsed: true, notice: expect.objectContaining({ tone: 'good' }),
      });
      expect(engine.getSnapshot()).toBe(revision + 1);
      expect(listener).toHaveBeenCalledOnce();
      expect(sound).toHaveBeenCalledExactlyOnceWith('buy');
    }
  });

  it.each(['solo', 'coop'] as const)('shares only one use in a %s stage, even across pauses', (mode) => {
    const engine = start(mode);
    expect(engine.rewind()).toBe(true);
    for (const player of engine.state.players) engine.action(player.id, 'launch');
    engine.tick(0.2);
    engine.pause();
    const paused = structuredClone(engine.state);

    expect(engine.rewind()).toBe(false);
    expect(engine.state).toEqual({
      ...paused, notice: expect.objectContaining({ tone: 'warning' }),
    });
    expect(engine.state.notice?.text.en).toContain('already been used');
    engine.resume();
    advance(engine, 1);
    const time = engine.state.timeLeft;
    expect(engine.rewind()).toBe(false);
    expect(engine.state.timeLeft).toBe(time);
    expect(engine.state.rewindUsed).toBe(true);
  });

  it('restores the complete original mine and nested rewards without rerolls, including after resizing', () => {
    const random = vi.fn(() => 0.5);
    const engine = new GameEngine(random);
    startTestRun(engine, 'coop', 'time-rewind');
    engine.state.abilities = ['time-rewind', 'clone', 'fossil-puzzle', 'gold-growth'];
    engine.state.level = 12;
    engine.state.score = 12_345;
    engine.state.dynamite = 3;
    engine.state.pendingUpgrades = ['strength', 'luck', 'rockbook', 'polish'];
    engine.state.phase = 'shop';
    engine.nextLevel();
    const initial = structuredClone(engine.state);
    advance(engine, 6);

    const state = engine.state;
    const cargo = state.entities[0];
    const bag = state.entities.find((entity) => entity.kind === 'bag');
    if (!bag?.bagReward) throw new Error('The rewind fixture needs an initialized bag.');
    if (bag.bagReward.kind === 'cash') bag.bagReward.value += 999;
    else if (bag.bagReward.kind === 'dynamite') bag.bagReward.amount += 3;
    else bag.bagReward = { kind: 'cash', value: 999 };
    state.score += 20_000;
    state.dynamite = 1;
    state.bagStrength = true;
    state.clonedEntityId = cargo.id;
    state.fossilPieces.push('bone-small');
    state.goalAnnounced = true;
    state.entities[1].active = false;
    cargo.claimedBy = 1;
    state.players[0].phase = 'retracting';
    state.players[0].cargoId = cargo.id;
    state.players[0].length = 240;
    state.players[0].turn = { angle: Math.PI / 2, atLength: 120 };
    state.players[0].reel = createReelMotion(80, cargo.weight);
    state.players[0].roundEarned = 700;
    state.players[1].phase = 'extending';
    state.players[1].length = 260;
    state.players[1].roundEarned = 19_300;
    state.particles.push({
      kind: 'impact', x: 600, y: 400, vx: 0, vy: 0, life: 1, maxLife: 1, size: 10, color: '#fff',
    });
    state.texts.push({ x: 600, y: 400, text: '+$700', color: '#fff', life: 1 });
    engine.pause();
    const viewport = createViewport(390, 776);
    engine.setViewport(390, 776);
    expect(state.entities).not.toEqual(initial.entities);
    random.mockClear();

    expect(engine.rewind()).toBe(true);
    expect(random).not.toHaveBeenCalled();
    expect(engine.state).toEqual({
      ...initial,
      players: initial.players.map((player) => ({
        ...player, origin: { ...player.origin, y: viewport.originY },
      })),
      rewindUsed: true,
      notice: expect.objectContaining({ tone: 'good' }),
    });
    expect(engine.state.phase).toBe('playing');
    expect(engine.state).not.toBe(state);
  });

  it.each(['solo', 'coop'] as const)('replenishes only on the next %s stage and keeps shopping costs and supplies', (mode) => {
    const engine = new GameEngine(() => 0.1);
    startTestRun(engine, mode, 'time-rewind');
    expect(engine.rewind()).toBe(true);
    visitShop(engine);
    expect(engine.buy('strength')).toBe(true);
    expect(engine.buy('polish')).toBe(true);
    expect(engine.buy('dynamite')).toBe(true);
    const wallet = engine.state.score;
    const dynamite = engine.state.dynamite;
    engine.nextLevel();
    const initial = structuredClone(engine.state);
    expect(initial.level).toBe(2);
    expect(initial.rewindUsed).toBe(false);
    expect(initial.activeUpgrades).toEqual(['strength', 'polish']);
    expect(initial.pendingUpgrades).toEqual([]);
    engine.tick(1);
    engine.state.score += 500;
    engine.state.dynamite = 0;
    expect(engine.rewind()).toBe(true);
    expect(engine.state.score).toBe(wallet);
    expect(engine.state.roundStartScore).toBe(wallet);
    expect(engine.state.dynamite).toBe(dynamite);
    expect(engine.state).toEqual({
      ...initial, rewindUsed: true, notice: expect.objectContaining({ tone: 'good' }),
    });

    visitShop(engine);
    engine.nextLevel();
    expect(engine.state.level).toBe(3);
    expect(engine.state.rewindUsed).toBe(false);
    expect(engine.state.activeUpgrades).toEqual([]);
    expect(engine.rewind()).toBe(true);
    expect(engine.state.level).toBe(3);
    engine.menu();
    expect(engine.rewind()).toBe(false);
    startTestRun(engine, mode, 'time-rewind');
    expect(engine.state.level).toBe(1);
    expect(engine.state.rewindUsed).toBe(false);
    expect(engine.rewind()).toBe(true);
    expect(engine.state.score).toBe(0);
    expect(engine.state.dynamite).toBe(0);
  });

  it.each([
    ['solo', [], 60],
    ['coop', [], 40],
    ['solo', ['time-rush'], 48],
    ['coop', ['time-rush'], 32],
    ['solo', ['travel-light'], 70],
    ['coop', ['travel-light'], 50],
    ['solo', ['time-rush', 'travel-light'], 58],
    ['coop', ['time-rush', 'travel-light'], 42],
  ] satisfies [Mode, AbilityId[], number][])('restores the full %s timer with %j to %i seconds', (mode, abilities, duration) => {
    const engine = start(mode);
    engine.state.abilities.push(...abilities);
    visitShop(engine);
    engine.nextLevel();
    expect(engine.state.timeLeft).toBe(duration);
    engine.tick(duration * 0.9);
    engine.pause();
    expect(engine.rewind()).toBe(true);
    expect(engine.state.timeLeft).toBe(duration);
    expect(engine.state.elapsed).toBe(0);
    engine.tick(duration);
    expect(engine.state.timeLeft).toBe(0);
    expect(engine.state.elapsed).toBe(duration);
    expect(engine.state.phase).toBe('results');
    expect(engine.rewind()).toBe(false);
  });

  it('can be acquired in a later draft without returning to stage one', () => {
    const engine = new GameEngine(() => 0.1);
    startTestRun(engine, 'solo');
    engine.state.level = 2;
    engine.state.phase = 'shop';
    engine.nextLevel();
    engine.state.score = engine.state.target;
    engine.finishEarly();
    engine.openShop();
    expect(engine.state.phase).toBe('draft');
    engine.state.abilityOffers = ['time-rewind', 'might', 'thief'];
    expect(engine.chooseAbility('time-rewind')).toBe(true);
    engine.nextLevel();
    const initial = structuredClone(engine.state);
    expect(engine.rewind()).toBe(true);
    expect(engine.state.level).toBe(4);
    expect(engine.state.abilities).toEqual(['aim-line', 'time-rewind']);
    expect(engine.state).toEqual({
      ...initial, rewindUsed: true, notice: expect.objectContaining({ tone: 'good' }),
    });
  });

  it('pays time-bank bonuses only for the restored attempt, without keeping discarded earnings', () => {
    const engine = start();
    engine.state.abilities.push('time-bank');
    visitShop(engine);
    engine.nextLevel();
    const wallet = engine.state.score;
    engine.tick(10);
    engine.state.score += 1000;
    expect(engine.rewind()).toBe(true);
    engine.finishEarly();
    expect(engine.state.result).toEqual({
      earned: 3000, timeBankBonus: 3000, fossilBonus: 0, passed: true,
    });
    expect(engine.state.score).toBe(wallet + 3000);
    expect(engine.rewind()).toBe(false);
    engine.openShop();
    expect(engine.state.score).toBe(wallet + 3000);
  });

  it('resets the elapsed-time sound cooldown when rewinding a rock crusher', () => {
    const engine = start();
    engine.state.abilities.push('rock-crusher');
    visitShop(engine);
    engine.nextLevel();
    engine.tick(20);
    const crush = vi.fn();
    engine.onSound((sound) => { if (sound === 'crush') crush(); });
    for (let attempt = 0; attempt < 2; attempt++) {
      engine.state.entities = [
        makeEntity('rock-small', 600, 300, 1),
        makeEntity('gold-tiny', 75, 650, 2),
      ];
      engine.state.players[0].angle = 0;
      engine.action(1, 'launch');
      engine.tick(0.4);
      expect(crush).toHaveBeenCalledTimes(attempt + 1);
      if (attempt === 0) expect(engine.rewind()).toBe(true);
    }
  });

  it('requires the selected ability and reports rejection without restarting', () => {
    const engine = new GameEngine();
    startTestRun(engine, 'solo');
    engine.tick(1);
    const initial = structuredClone(engine.state);
    const sound = vi.fn();
    engine.onSound(sound);
    expect(engine.rewind()).toBe(false);
    expect(engine.state).toEqual({
      ...initial, notice: expect.objectContaining({ tone: 'warning' }),
    });
    expect(engine.state.notice?.text.en).toContain('has not been acquired');
    expect(sound).toHaveBeenCalledExactlyOnceWith('denied');
  });

  it.each(['menu', 'draft', 'results', 'shop', 'gameover'] as const)('does not rewind from %s', (phase) => {
    const engine = start();
    engine.state.phase = phase;
    const initial = structuredClone(engine.state);
    expect(engine.rewind()).toBe(false);
    expect(engine.state).toEqual(initial);
  });
});
