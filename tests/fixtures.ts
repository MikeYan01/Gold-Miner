import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../src/App';
import { GameEngine } from '../src/game/engine';
import { ABILITIES } from '../src/game/abilities';
import { applyRoundValue, getLevelInfo, initialiseBag, levelTarget, makeEntity, MAX_ANGLE, REST_LENGTH } from '../src/game/levels';
import { createRandom } from '../src/game/random';
import type { AbilityId, GameState, Mode, Point } from '../src/game/types';
import { startTestRun } from './engine-driver';
import '../src/styles.css';

export interface PaintedFrame extends Point {
  time: number;
  cargo?: Point;
}

declare global {
  interface Window {
    getMiningState?: () => GameState;
    getReelPaint?: () => PaintedFrame[];
  }
}

function seededMenu(params: URLSearchParams): GameEngine {
  const seed = Number(params.get('seed') ?? 523_260_012);
  if (!Number.isSafeInteger(seed)) throw new Error('Invalid fixture seed.');
  const random = createRandom(seed);
  const draftRandom = createRandom(47);
  // Keep seeded mines and prices independent of the size of the ability pool.
  const engine: GameEngine = new GameEngine(() => engine.state.draftLevel === null ? random() : draftRandom());
  return engine;
}

function fixtureAbility(params: URLSearchParams): AbilityId {
  const ability = ABILITIES.find((entry) => entry.id === params.get('ability'));
  if (!ability) throw new Error('Invalid fixture ability.');
  return ability.id;
}

function abilityFixture(params: URLSearchParams, mode: Mode): GameEngine {
  const scenario = params.get('scenario') ?? 'draft-four';
  const draftScenario = ['draft-four', 'draft-risk', 'draft-clean', 'draft-time-bank', 'draft-new'].includes(scenario);
  const shopScenario = draftScenario || ['thief-shop', 'late-shop', 'travel-light-shop'].includes(scenario);
  const scarceShop = scenario === 'empty-shop' || scenario === 'regular-shop';
  let random: () => number;
  if (scenario === 'right-angle-turn') random = () => params.get('turn') === 'left' ? 0.1 : 0.9;
  else if (scenario === 'draft-run') random = () => 0.2;
  else if (['alchemy', 'diamond-vein'].includes(scenario) || shopScenario) random = () => 0.1;
  else if (scenario === 'moneybags' || scenario === 'gold-growth') random = () => 0.5;
  else if (scenario === 'bag-strength') random = () => 0.55;
  else if (scarceShop) random = () => 0.99;
  else random = createRandom(30);
  const engine = new GameEngine(random);
  startTestRun(engine, mode);
  engine.state.dynamite = 1;

  if (scenario === 'draft-language') {
    const ability = fixtureAbility(params);
    engine.start(mode);
    engine.state.abilityOffers = [ability, ...ABILITIES.filter((entry) => entry.id !== ability).slice(0, 2).map((entry) => entry.id)];
  } else if (scenario === 'draft-run') {
    engine.start(mode);
    engine.state.score = 1_000_000;
  } else if (draftScenario) {
    engine.state.level = 2;
    engine.state.phase = 'shop';
    engine.nextLevel();
    engine.state.score = scenario === 'draft-time-bank' ? getLevelInfo(4, mode).target : engine.state.target;
    engine.finishEarly();
    engine.openShop();
    engine.state.abilityOffers = scenario === 'draft-time-bank'
      ? ['time-bank', 'thief', 'might']
      : scenario === 'draft-clean'
        ? ['bomb-expert', 'wide-claw', 'risk-reward']
        : [scenario === 'draft-risk' ? 'risk-reward' : 'thief', 'might', 'moneybags'];
    if (scenario === 'draft-new') {
      const ability = fixtureAbility(params);
      engine.state.abilityOffers = [ability, 'thief', 'might'];
      if (ability === 'airy-moles') engine.state.abilities = ['diamond-moles'];
    }
  } else if (scenario === 'right-angle-turn') {
    const angle = Number(params.get('angle') ?? 0);
    const cargo = params.get('cargo') ?? 'none';
    if (!Number.isFinite(angle) || Math.abs(angle) > MAX_ANGLE) throw new Error('Invalid turn fixture angle.');
    if (cargo !== 'none' && cargo !== 'diamond' && cargo !== 'gold-large') throw new Error('Invalid turn fixture cargo.');
    engine.state.abilities = ['right-angle-turn', 'aim-line'];
    engine.state.entities = [makeEntity('gold-tiny', 80, 650, 99)];
    for (const player of engine.state.players) {
      player.angle = angle;
      player.swingTime = Math.asin(angle / MAX_ANGLE) / 1.25;
      if (cargo !== 'none') {
        const side = params.get('turn') === 'left' ? -1 : 1;
        engine.state.entities.push(makeEntity(cargo, player.origin.x + side * 200, 420, player.id));
      }
    }
    engine.pause();
  } else if (scenario === 'travel-light-shop') {
    engine.state.abilities = ['travel-light', 'thief'];
    if (params.get('rush') === 'true') engine.state.abilities.push('time-rush');
    engine.state.score = 1_000_000;
    engine.finishEarly();
    engine.openShop();
  } else if (scenario === 'rock-crusher') {
    engine.state.abilities = ['rock-crusher', 'aim-line', 'clone'];
    engine.state.entities = engine.state.players.flatMap((player) => [
      makeEntity('rock-small', player.origin.x, 300, player.id * 10 + 1),
      makeEntity('rock-large', player.origin.x, 410, player.id * 10 + 2),
      makeEntity('diamond', player.origin.x, 520, player.id * 10 + 3),
      makeEntity('rock-large', player.origin.x, 650, player.id * 10 + 4),
    ]);
    for (const player of engine.state.players) {
      player.angle = 0;
      player.swingTime = 0;
    }
    engine.pause();
  } else if (scenario === 'thief-shop' || scenario === 'late-shop' || scarceShop) {
    engine.state.abilities = scenario === 'regular-shop' ? ['regular-customer', 'thief'] : ['thief'];
    if (scarceShop) engine.state.dynamite = 5;
    if (scenario === 'late-shop') {
      engine.state.level = 999_999;
      engine.state.target = getLevelInfo(999_999, mode).target;
    }
    engine.state.score = engine.state.target;
    engine.finishEarly();
    engine.openShop();
    engine.state.score = scenario === 'late-shop' ? 1000 : 0;
  } else if (['risk-gold', 'risk-gold-far', 'risk-diamond', 'risk-mole', 'loot-art', 'archaeology', 'clone-diamond'].includes(scenario)) {
    const boneScene = scenario === 'loot-art' || scenario === 'archaeology';
    engine.state.abilities = boneScene
      ? [scenario === 'archaeology' ? 'archaeologist' : 'aim-line']
      : scenario === 'clone-diamond' ? ['clone', 'diamond-collector']
        : ['risk-reward', 'gold-collector', 'diamond-collector', 'aim-line'];
    engine.state.level = 12;
    engine.state.phase = 'shop';
    engine.state.pendingUpgrades = boneScene ? [] : ['polish'];
    engine.nextLevel();
    if (boneScene) {
      engine.state.entities = [
        makeEntity('rock-small', 270, 400, 1),
        makeEntity('rock-large', 500, 400, 2),
        makeEntity('bone-small', 730, 400, 3),
        makeEntity('bone-large', 960, 400, 4),
        makeEntity('gold-tiny', 80, 650, 5),
      ];
    } else {
      const kind = scenario.startsWith('risk-gold') ? 'gold-large' : scenario === 'risk-mole' ? 'mole-diamond' : 'diamond';
      const target = makeEntity(kind, 600, 340, 1);
      applyRoundValue(target, engine.state.activeUpgrades);
      target.speed = 0;
      engine.state.entities = [
        target,
        makeEntity('tnt', scenario === 'risk-gold-far' ? 800 : 700, 360, 2),
        makeEntity('gold-tiny', 80, 650, 3),
      ];
    }
    engine.state.players[0].angle = 0;
    engine.state.players[0].swingTime = 0;
    engine.pause();
  } else if (scenario === 'fossil-puzzle') {
    engine.state.abilities = ['fossil-puzzle', 'archaeologist'];
    engine.state.entities = [
      makeEntity('bone-small', 730, 400, 1),
      makeEntity('bone-large', 960, 400, 2),
      makeEntity('gold-tiny', 75, 650, 3),
    ];
    engine.state.players[0].angle = 0;
    engine.state.players[0].swingTime = 0;
    engine.pause();
  } else if (scenario === 'gold-growth') {
    engine.state.abilities = ['gold-growth'];
    engine.state.entities = [
      makeEntity('gold-tiny', 250, 450, 1),
      makeEntity('gold-small', 450, 500, 2),
      makeEntity('gold-medium', 650, 550, 3),
      makeEntity('gold-large', 950, 600, 4),
    ];
    engine.pause();
  } else if (scenario === 'timeout-cargo') {
    engine.state.abilities = ['gold-collector', 'clone', 'time-bank'];
    engine.state.entities = [
      makeEntity('gold-large', 600, 600, 1),
      makeEntity('gold-tiny', 75, 650, 2),
    ];
    engine.tick(58.5);
    engine.state.players[0].angle = 0;
    engine.state.players[0].swingTime = 0;
    engine.pause();
  } else if (scenario === 'tnt-fragment') {
    engine.state.abilities = [];
    engine.state.entities = [
      makeEntity('tnt', 600, 350, 1),
      makeEntity('gold-tiny', 600, 460, 2),
      makeEntity('gold-tiny', 75, 650, 3),
      makeEntity('tnt', 840, 450, 4),
      makeEntity('gold-large', 1000, 550, 5),
      makeEntity('tnt', 140, 600, 6),
    ];
    engine.state.players[0].angle = 0;
    engine.state.players[0].swingTime = 0;
    engine.pause();
  } else if (scenario === 'keyboard-cargo') {
    engine.state.entities = engine.state.players.map((player, index) => makeEntity('gold-large', player.origin.x, 390, index + 1));
    engine.state.entities.push(makeEntity('gold-tiny', 80, 650, 3));
    for (const player of engine.state.players) {
      player.angle = 0;
      player.swingTime = 0;
    }
    engine.pause();
  } else if (scenario === 'bag-strength') {
    if (params.get('ability') === 'might') engine.state.abilities = ['might'];
    engine.state.level = 12;
    engine.state.phase = 'shop';
    engine.nextLevel();
    engine.state.score = engine.state.target;
    const bag = makeEntity('bag', 600, 340, 1);
    initialiseBag(bag, { abilities: engine.state.abilities, lucky: false, dynamite: engine.state.dynamite }, random);
    bag.weight = 9;
    engine.state.entities = [bag, makeEntity('gold-large', 800, 590, 2)];
    engine.state.players[0].angle = 0;
    engine.state.players[0].swingTime = 0;
    engine.pause();
  } else if (['empowered-mine', 'alchemy', 'diamond-vein', 'moneybags'].includes(scenario)) {
    engine.state.abilities = scenario === 'alchemy'
      ? ['alchemy', 'gold-collector', 'aim-line', 'might']
      : scenario === 'diamond-vein'
        ? ['diamond-vein', 'diamond-collector', 'aim-line', 'might']
        : scenario === 'moneybags'
          ? ['moneybags', 'might', 'gold-collector', 'aim-line']
          : ['bomb-expert', 'wide-claw', 'aim-line', 'might'];
    engine.state.level = 12;
    engine.state.phase = 'shop';
    engine.state.pendingUpgrades = [scenario === 'alchemy' ? 'rockbook' : scenario === 'moneybags' ? 'luck' : scenario === 'diamond-vein' ? 'polish' : 'strength'];
    engine.nextLevel();
    const kind = scenario === 'alchemy' ? 'rock-small' : scenario === 'moneybags' ? 'bag' : scenario === 'diamond-vein' ? 'gold-large' : 'tnt';
    const target = makeEntity(kind, 600, 340, 1);
    applyRoundValue(target, engine.state.activeUpgrades);
    if (kind === 'bag') {
      initialiseBag(target, {
        abilities: engine.state.abilities,
        lucky: engine.state.activeUpgrades.includes('luck'),
        dynamite: engine.state.dynamite,
      }, random);
    }
    engine.state.entities = [
      target,
      makeEntity('gold-tiny', 80, 650, 2),
      makeEntity('tnt', 670, 370, 3),
      makeEntity('diamond', 730, 380, 4),
    ];
    engine.state.players[0].angle = 0;
    engine.state.players[0].swingTime = 0;
    engine.pause();
  } else {
    throw new Error(`Unknown fixture scenario: ${scenario}`);
  }
  if (params.get('inventory') === 'full') {
    engine.state.activeUpgrades = ['strength', 'luck', 'rockbook', 'polish'];
    engine.state.bagStrength = true;
    engine.state.score = engine.state.target;
  }
  return engine;
}

function endlessFixture(params: URLSearchParams, mode: Mode): GameEngine {
  const level = Number(params.get('level') ?? 12);
  if (!Number.isSafeInteger(level) || level < 2) throw new Error('Invalid fixture level.');
  const engine = new GameEngine(() => 0.1);
  engine.start(mode);
  engine.state.abilities = ['aim-line', 'might', 'gold-collector', 'diamond-collector'];
  engine.state.abilityOffers = [];
  engine.state.draftLevel = null;
  engine.state.level = level - 1;
  engine.state.score = levelTarget(level - 1);
  engine.state.phase = 'shop';
  engine.nextLevel();
  engine.state.score = engine.state.target;
  engine.pause();
  return engine;
}

function reelFixture(params: URLSearchParams, mode: Mode): GameEngine {
  const kind = params.get('kind') ?? 'gold-large';
  const observedId = Number(params.get('player') ?? 1);
  if (!['empty', 'gold-large', 'diamond', 'fast-gold', 'mighty-gold'].includes(kind)) throw new Error('Invalid reel fixture kind.');
  const engine = new GameEngine(createRandom(47));
  startTestRun(engine, mode);
  if (!engine.state.players.some((player) => player.id === observedId)) throw new Error('Invalid reel fixture player.');
  engine.state.abilities = kind === 'mighty-gold' ? ['might'] : [];
  engine.state.bagStrength = kind === 'fast-gold';
  engine.state.dynamite = 1;
  engine.state.entities = [];
  for (const player of engine.state.players) {
    player.angle = 0;
    player.length = REST_LENGTH + 400;
    player.phase = 'retracting';
    player.reel = null;
    if (kind !== 'empty') {
      const cargo = makeEntity(kind === 'diamond' ? 'diamond' : 'gold-large', player.origin.x, 550, player.id);
      cargo.claimedBy = player.id;
      player.cargoId = cargo.id;
      engine.state.entities.push(cargo);
    }
  }
  engine.state.entities.push(makeEntity('gold-tiny', 80, 650, 3));
  engine.pause();

  const frames: PaintedFrame[] = [];
  let ropeIndex = 0;
  let awaitingCargo = false;
  let currentFrame: PaintedFrame | null = null;
  const { clearRect, lineTo, translate } = CanvasRenderingContext2D.prototype;
  CanvasRenderingContext2D.prototype.clearRect = function (x, y, width, height) {
    if (this.canvas.classList.contains('mine-canvas')) {
      ropeIndex = 0;
      awaitingCargo = observedId === 1 && engine.state.players[0].cargoId !== null;
      currentFrame = null;
    }
    return clearRect.call(this, x, y, width, height);
  };
  CanvasRenderingContext2D.prototype.lineTo = function (x, y) {
    if (ropeIndex < engine.state.players.length && this.canvas.classList.contains('mine-canvas')) {
      const player = engine.state.players[ropeIndex++];
      if (engine.state.phase === 'playing' && player.phase === 'retracting' && player.id === observedId) {
        const transform = this.getTransform();
        currentFrame = {
          time: performance.now(),
          x: transform.a * x + transform.c * y + transform.e,
          y: transform.b * x + transform.d * y + transform.f,
        };
        frames.push(currentFrame);
      }
    }
    return lineTo.call(this, x, y);
  };
  CanvasRenderingContext2D.prototype.translate = function (x, y) {
    if (awaitingCargo && currentFrame && this.canvas.classList.contains('mine-canvas')) {
      awaitingCargo = false;
      const transform = this.getTransform();
      currentFrame.cargo = {
        x: transform.a * x + transform.c * y + transform.e,
        y: transform.b * x + transform.d * y + transform.f,
      };
    }
    return translate.call(this, x, y);
  };
  window.getReelPaint = () => structuredClone(frames);
  return engine;
}

const params = new URL(location.href).searchParams;
const mode = params.get('mode') ?? 'solo';
if (mode !== 'solo' && mode !== 'coop') throw new Error('Invalid fixture mode.');
const fixture = params.get('fixture') ?? 'game';
let engine: GameEngine;
switch (fixture) {
  case 'game': engine = seededMenu(params); break;
  case 'abilities': engine = abilityFixture(params, mode); break;
  case 'endless': engine = endlessFixture(params, mode); break;
  case 'reel': engine = reelFixture(params, mode); break;
  default: throw new Error(`Unknown fixture: ${fixture}`);
}
window.getMiningState = () => structuredClone(engine.state);
const root = document.getElementById('root');
if (!root) throw new Error('The fixture root element is missing.');
createRoot(root).render(createElement(App, { engine }));
