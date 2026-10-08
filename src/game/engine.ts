import {
  applyRoundValue, createLevel, createShop, disarmTnt, getLevelInfo, HEIGHT,
  makeEntity, MAX_ANGLE, MOLE_VALUE, ORIGIN_Y, REST_LENGTH, WIDTH,
} from './levels';
import type {
  AbilityId, Entity, GameState, Mode, Player, PlayerId, Point, ShopItem, ShopItemId, Sound,
} from './types';
import { createViewport, DEFAULT_VIEWPORT, projectPoint } from './viewport';
import type { Viewport } from './viewport';
import { createRandom, randomInteger } from './random';
import {
  ALCHEMY_CHANCE, ARCHAEOLOGIST_VALUE_MULTIPLIER, canAcquireAbility, CLONE_REWARD_MULTIPLIER,
  DIAMOND_COLLECTOR_BONUS_PERCENT, DIAMOND_VEIN_CHANCE, FOSSIL_PUZZLE_BONUS, GOLD_COLLECTOR_BONUS_PERCENT, GOLD_GROWTH_INTERVAL,
  drawAbilityOffers, getAbility, haulingMultiplier, hookRadius,
  needsAbilityChoice, RISK_RADIUS_MULTIPLIER, RISK_VALUE_MULTIPLIER, RUSH_DURATION_MULTIPLIER, RUSH_VALUE_MULTIPLIER,
  TIME_BANK_COINS_PER_SECOND, TRAVEL_LIGHT_BONUS_SECONDS,
} from './abilities';
import { createReelMotion, ORIGINAL_FRAME_RATE, ORIGINAL_STAGE_HEIGHT, originalReelDistance, stepOriginalReel } from './hauling';
import { ORIGINAL_STARTING_DYNAMITE, ORIGINAL_STARTING_MONEY } from './economy';
import { inTntBlast, TNT_BLAST_RADIUS } from './blast';
import { bilingual } from './i18n';
import type { DisplayText, LocalizedText } from './i18n';

export { inTntBlast, TNT_BLAST_RADIUS } from './blast';

const SHOT_SPEED = 540;
const CRUSH_SOUND_INTERVAL = 0.1;

export function canEarnRiskReward(
  entity: Entity,
  state: Pick<GameState, 'entities' | 'abilities'>,
  viewport: Viewport,
): boolean {
  if (!state.abilities.includes('risk-reward') || !entity.active || entity.claimedBy !== null) return false;
  if (!entity.kind.startsWith('gold') && entity.kind !== 'diamond' && entity.kind !== 'mole-diamond') return false;
  return state.entities.some((source) =>
    source.kind === 'tnt' && source.active && source.claimedBy === null
      && inTntBlast(source, entity, viewport, TNT_BLAST_RADIUS * RISK_RADIUS_MULTIPLIER),
  );
}

function pointAlong(origin: Point, angle: number, length: number): Point {
  return {
    x: origin.x + Math.sin(angle) * length,
    y: origin.y + Math.cos(angle) * length,
  };
}

function boundaryDistance(from: Point, angle: number): number {
  const x = Math.sin(angle);
  const y = Math.cos(angle);
  const vertical = y > 0 ? (HEIGHT - 18 - from.y) / y : y < 0 ? (18 - from.y) / y : Infinity;
  const horizontal = x > 0 ? (WIDTH - 18 - from.x) / x : x < 0 ? (18 - from.x) / x : Infinity;
  return Math.max(0, Math.min(vertical, horizontal));
}

function quarterTurnAngle(angle: number, viewport: Viewport, direction: -1 | 1): number {
  // Rotate in display space so stretched viewports still show a right angle.
  return Math.atan2(
    direction * Math.cos(angle) * viewport.stretchY / viewport.stretchX,
    -direction * Math.sin(angle) * viewport.stretchX / viewport.stretchY,
  );
}

export function canTurnHook(player: Player): player is Player & { turn: NonNullable<Player['turn']> } {
  return player.phase === 'extending' && player.cargoId === null && player.turn?.atLength === null;
}

export function hookTip(player: Player, length = player.length): Point {
  const turn = player.turn;
  if (turn && turn.atLength !== null && length > turn.atLength) {
    return pointAlong(pointAlong(player.origin, player.angle, turn.atLength), turn.angle, length - turn.atLength);
  }
  return pointAlong(player.origin, player.angle, length);
}

export function hookAngle(player: Player): number {
  const turn = player.turn;
  return turn && turn.atLength !== null && (player.phase === 'extending' || player.length > turn.atLength)
    ? turn.angle : player.angle;
}

export function hookPath(player: Player, fromLength = 0, toLength = player.length): Point[] {
  const points = [hookTip(player, fromLength)];
  const bend = player.turn?.atLength;
  if (bend !== undefined && bend !== null && bend > Math.min(fromLength, toLength) && bend < Math.max(fromLength, toLength)) {
    points.push(hookTip(player, bend));
  }
  points.push(hookTip(player, toLength));
  return points;
}

export function reelDistanceScale(player: Pick<Player, 'angle'>, viewport: Viewport): number {
  const projectedDirection = Math.hypot(
    Math.sin(player.angle) * viewport.stretchX,
    Math.cos(player.angle) * viewport.stretchY,
  );
  return HEIGHT / ORIGINAL_STAGE_HEIGHT * viewport.stretchY / projectedDirection;
}

export function hookReelDistance(player: Player, viewport: Viewport): number {
  const scale = reelDistanceScale(player, viewport);
  const turn = player.turn;
  if (turn && turn.atLength !== null && player.length > turn.atLength) {
    return (turn.atLength - REST_LENGTH) / scale
      + (player.length - turn.atLength) / reelDistanceScale(turn, viewport);
  }
  return Math.max(0, player.length - REST_LENGTH) / scale;
}

export function hookLengthFromReelDistance(player: Player, distance: number, viewport: Viewport): number {
  const scale = reelDistanceScale(player, viewport);
  const turn = player.turn;
  if (turn && turn.atLength !== null) {
    const firstDistance = (turn.atLength - REST_LENGTH) / scale;
    if (distance > firstDistance) return turn.atLength + (distance - firstDistance) * reelDistanceScale(turn, viewport);
  }
  return REST_LENGTH + distance * scale;
}

export function maxHookLength(player: Player): number {
  const turn = player.turn;
  return turn && turn.atLength !== null
    ? turn.atLength + boundaryDistance(hookTip(player, turn.atLength), turn.angle)
    : boundaryDistance(player.origin, player.angle);
}

export function hookCargoPosition(player: Player, radius: number, viewport: Viewport): Point {
  const angle = hookAngle(player);
  const directionScale = Math.hypot(Math.sin(angle) * viewport.stretchX, Math.cos(angle) * viewport.stretchY);
  return pointAlong(hookTip(player), angle, radius * 0.42 / directionScale);
}

interface HookHit {
  entity: Entity;
  t: number;
}

export function findHookHit(
  from: Point,
  to: Point,
  entities: readonly Entity[],
  viewport: Viewport,
  abilities: readonly AbilityId[],
): HookHit | null {
  return traceHookPath(from, to, entities, viewport, abilities).hit;
}

export function aimLineSegment(
  player: Player,
  state: Pick<GameState, 'phase' | 'abilities' | 'entities'>,
  viewport: Viewport,
): { from: Point; to: Point } | null {
  if (!state.abilities.includes('aim-line') || (state.phase !== 'playing' && state.phase !== 'paused')) return null;
  let angle: number;
  if (player.phase === 'swinging') angle = player.angle;
  else if (player.phase === 'extending' && player.turn) angle = player.turn.angle;
  else return null;
  const from = hookTip(player);
  const end = pointAlong(from, angle, boundaryDistance(from, angle));
  const hit = findHookHit(from, end, state.entities, viewport, state.abilities);
  const to = hit ? { x: from.x + (end.x - from.x) * hit.t, y: from.y + (end.y - from.y) * hit.t } : end;
  return { from, to };
}

function traceHookPath(
  from: Point,
  to: Point,
  entities: readonly Entity[],
  viewport: Viewport,
  abilities: readonly AbilityId[],
): { hit: HookHit | null; rocks: HookHit[] } {
  const projectedFrom = projectPoint(from, viewport);
  const projectedTo = projectPoint(to, viewport);
  const crushesRocks = abilities.includes('rock-crusher');
  const radius = hookRadius(abilities);
  let nearest: HookHit | null = null;
  const rocks: HookHit[] = [];
  for (const entity of entities) {
    if (!entity.active || entity.claimedBy !== null) continue;
    const t = segmentCircleHit(projectedFrom, projectedTo, projectPoint(entity, viewport), entity.radius * 0.86 + radius);
    if (t === null) continue;
    if (crushesRocks && (entity.kind === 'rock-small' || entity.kind === 'rock-large')) rocks.push({ entity, t });
    else if (!nearest || t < nearest.t) nearest = { entity, t };
  }
  return { hit: nearest, rocks };
}

// Segment collision prevents a fast-moving hook from skipping small gems between frames.
export function segmentCircleHit(from: Point, to: Point, center: Point, radius: number): number | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const fx = from.x - center.x;
  const fy = from.y - center.y;
  const c = fx * fx + fy * fy - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a === 0) return null;
  const b = 2 * (fx * dx + fy * dy);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

export function keyboardAction(code: string, mode: Mode): { player: PlayerId; action: 'launch' | 'bomb' } | null {
  const arrowPlayer = mode === 'coop' ? 2 : 1;
  if (code === 'ArrowDown') return { player: arrowPlayer, action: 'launch' };
  if (code === 'ArrowUp') return { player: arrowPlayer, action: 'bomb' };
  if (mode === 'coop' && code === 'KeyS') return { player: 1, action: 'launch' };
  if (mode === 'coop' && code === 'KeyW') return { player: 1, action: 'bomb' };
  return null;
}

function createPlayers(mode: Mode, originY = ORIGIN_Y): Player[] {
  const create = (id: PlayerId, x: number, swingTime: number): Player => ({
    id,
    origin: { x, y: originY },
    angle: Math.sin(swingTime * 1.25) * MAX_ANGLE,
    turn: null,
    swingTime,
    length: REST_LENGTH,
    phase: 'swinging',
    cargoId: null,
    reel: null,
    roundEarned: 0,
  });
  return mode === 'solo'
    ? [create(1, WIDTH / 2, -0.5)]
    : [create(1, 360, -0.5), create(2, 840, 0.5)];
}

function initialState(mode: Mode, phase: 'menu' | 'draft', originY = ORIGIN_Y): GameState {
  const info = getLevelInfo(1, mode);
  return {
    phase,
    mode,
    level: 1,
    score: ORIGINAL_STARTING_MONEY,
    target: info.target,
    timeLeft: info.duration,
    clonedEntityId: null,
    elapsed: 0,
    dynamite: ORIGINAL_STARTING_DYNAMITE,
    abilities: [],
    abilityOffers: [],
    offeredAbilities: [],
    draftLevel: null,
    shopStealsRemaining: 0,
    activeUpgrades: [],
    pendingUpgrades: [],
    bagStrength: false,
    players: createPlayers(mode, originY),
    entities: phase === 'menu' ? createLevel(1, mode) : [],
    particles: [],
    texts: [],
    shop: [],
    result: null,
    notice: null,
    roundStartScore: 0,
    fossilPieces: [],
    goalAnnounced: false,
  };
}

export class GameEngine {
  state: GameState = initialState('solo', 'menu');
  private revision = 0;
  private listeners = new Set<() => void>();
  private soundListeners = new Set<(sound: Sound) => void>();
  private publishElapsed = 0;
  private noticeRemaining = 0;
  private fxRandom = createRandom(2026);
  private lastCrushSoundAt = -Infinity;
  private viewport: Viewport = DEFAULT_VIEWPORT;

  constructor(private readonly random: () => number = Math.random) {}

  setViewport(width: number, height: number): void {
    this.viewport = createViewport(width, height);
    for (const player of this.state.players) {
      player.origin.y = this.viewport.originY;
      if (player.turn) {
        player.turn.angle = quarterTurnAngle(player.angle, this.viewport, player.turn.angle < 0 ? -1 : 1);
        if (player.turn.atLength !== null) {
          const pastBend = player.length - player.turn.atLength;
          player.turn.atLength = Math.min(player.turn.atLength, boundaryDistance(player.origin, player.angle));
          player.length = pastBend > 0
            ? player.turn.atLength + pastBend
            : Math.min(player.length, player.turn.atLength);
        }
      }
      player.length = Math.min(player.length, maxHookLength(player));
      const cargo = this.state.entities.find((entity) => entity.active && entity.id === player.cargoId);
      if (player.reel) {
        const rebased = createReelMotion(hookReelDistance(player, this.viewport), cargo?.weight ?? null);
        player.reel.cursor = rebased.cursor;
        player.reel.offset = rebased.offset;
      }
      if (cargo) this.positionCargo(player, cargo);
    }
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): number => this.revision;

  onSound(listener: (sound: Sound) => void): () => void {
    this.soundListeners.add(listener);
    return () => this.soundListeners.delete(listener);
  }

  private publish(): void {
    this.revision++;
    this.listeners.forEach((listener) => listener());
  }

  private sound(sound: Sound): void {
    this.soundListeners.forEach((listener) => listener(sound));
  }

  notify(text: LocalizedText, tone: 'normal' | 'good' | 'warning' = 'normal'): void {
    this.state.notice = { text, tone };
    this.noticeRemaining = 3.5;
    this.publish();
  }

  start(mode: Mode): void {
    this.state = initialState(mode, 'draft', this.viewport.originY);
    this.fxRandom = createRandom(2026);
    this.beginDraft(1);
  }

  private beginDraft(level: number): void {
    this.state.phase = 'draft';
    this.state.draftLevel = level;
    this.state.abilityOffers = drawAbilityOffers(this.state.abilities, this.random, this.state.offeredAbilities);
    this.state.offeredAbilities.push(...this.state.abilityOffers);
    this.state.notice = null;
    this.publish();
  }

  chooseAbility(id: AbilityId): boolean {
    const state = this.state;
    if (state.phase !== 'draft') return false;
    if (!state.abilityOffers.includes(id) || !canAcquireAbility(id, state.abilities)) {
      this.notify(bilingual('请选择本次展示的一个新能力。', 'Choose one of the new abilities offered.'), 'warning');
      this.sound('denied');
      return false;
    }
    const level = state.draftLevel;
    if (level === null) throw new Error('An ability draft has no upcoming level.');
    state.abilities.push(id);
    state.abilityOffers = [];
    state.draftLevel = null;
    this.sound('buy');
    if (level === 1) this.beginLevel(1);
    else this.enterShop();
    this.notify(bilingual(`已获得${getAbility(id, state.mode).name}。`, `Acquired ${getAbility(id, state.mode, 'en').name}.`), 'good');
    return true;
  }

  menu(): void {
    this.state = initialState(this.state.mode, 'menu', this.viewport.originY);
    this.publish();
  }

  pause(): void {
    if (this.state.phase !== 'playing') return;
    this.state.phase = 'paused';
    this.publish();
  }

  resume(): void {
    if (this.state.phase !== 'paused') return;
    this.state.phase = 'playing';
    this.publish();
  }

  action(playerId: PlayerId, action: 'launch' | 'bomb'): void {
    if (this.state.phase !== 'playing') return;
    const player = this.state.players.find((candidate) => candidate.id === playerId);
    if (!player) return;
    if (action === 'launch') {
      if (canTurnHook(player)) {
        player.turn.atLength = player.length;
        this.publish();
        return;
      }
      if (player.phase !== 'swinging') return;
      player.phase = 'extending';
      player.reel = null;
      player.turn = this.state.abilities.includes('right-angle-turn') ? {
        angle: quarterTurnAngle(player.angle, this.viewport, player.angle > 0 || (player.angle === 0 && this.random() < 0.5) ? -1 : 1),
        atLength: null,
      } : null;
      this.sound('launch');
      this.publish();
      return;
    }
    if (this.state.dynamite === 0) {
      this.notify(bilingual('没有炸药了，去商店补给或寻找钱袋。', 'No dynamite left. Buy more at the shop or find a mystery bag.'), 'warning');
      this.sound('denied');
      return;
    }
    if (player.cargoId === null) {
      this.notify(bilingual('抓住重物后，才能用炸药把它炸掉。', 'Catch an item before using dynamite to destroy it.'), 'warning');
      return;
    }
    const cargo = this.state.entities.find((entity) => entity.id === player.cargoId);
    if (!cargo?.active) return;
    this.state.dynamite--;
    this.destroy(cargo);
    this.burst(cargo.x, cargo.y, '#e87435', 30);
    this.float(cargo.x, cargo.y - 35 / this.viewport.stretchY, bilingual('轰！', 'BOOM!'), '#a94723');
    this.sound('explosion');
    this.publish();
  }

  tick(delta: number): void {
    if (!Number.isFinite(delta) || delta <= 0) return;
    const state = this.state;
    if (state.phase !== 'playing') return;
    const dt = Math.min(delta, state.timeLeft);
    const previousSecond = Math.ceil(state.timeLeft);
    const previousElapsed = state.elapsed;
    state.elapsed += dt;
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    if (Math.ceil(state.timeLeft) < previousSecond && state.timeLeft > 0 && state.timeLeft <= 10) this.sound('tick');

    for (const entity of state.entities) {
      if (!entity.active || entity.claimedBy !== null) continue;
      if (entity.speed === 0) continue;
      entity.x += entity.direction * entity.speed * dt;
      if (entity.x < 65 || entity.x > WIDTH - 65) {
        entity.x = Math.max(65, Math.min(WIDTH - 65, entity.x));
        entity.direction *= -1;
      }
    }
    for (const player of state.players) this.updatePlayer(player, dt);
    if (
      Math.floor(state.elapsed) !== Math.floor(previousElapsed) &&
      state.players.some((player) => player.phase === 'retracting')
    ) this.sound('reel');
    for (const particle of state.particles) {
      particle.life -= dt;
      if (particle.kind === 'blast' || particle.kind === 'impact') continue;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      if (particle.kind === 'rock-chip') {
        particle.rotation += particle.spin * dt;
        particle.vy += 260 * dt / this.viewport.stretchY;
      } else if (particle.kind !== 'rock-dust') {
        particle.vy += 170 * dt / this.viewport.stretchY;
      }
    }
    state.particles = state.particles.filter((particle) => particle.life > 0);
    for (const text of state.texts) {
      text.life -= dt;
      text.y -= 33 * dt / this.viewport.stretchY;
    }
    state.texts = state.texts.filter((text) => text.life > 0);
    if (state.notice && this.noticeRemaining > 0) {
      this.noticeRemaining -= dt;
      if (this.noticeRemaining <= 0) state.notice = null;
    }
    if (state.abilities.includes('gold-growth')) {
      const previousInterval = Math.floor((previousElapsed + 1e-9) / GOLD_GROWTH_INTERVAL);
      const currentInterval = Math.floor((state.elapsed + 1e-9) / GOLD_GROWTH_INTERVAL);
      for (let interval = previousInterval; interval < currentInterval; interval++) this.growGold();
    }
    const empty = state.entities.every((entity) => !entity.active) &&
      state.players.every((player) => player.phase === 'swinging');
    if (state.timeLeft === 0 || empty) {
      this.finishRound();
      return;
    }
    this.publishElapsed += dt;
    if (this.publishElapsed >= 0.08) {
      this.publishElapsed = 0;
      this.publish();
    }
  }

  private growGold(): void {
    const candidates = this.state.entities.filter((entity) => entity.active && entity.claimedBy === null
      && (entity.kind === 'gold-tiny' || entity.kind === 'gold-small' || entity.kind === 'gold-medium'));
    if (candidates.length === 0) return;
    const entity = candidates[randomInteger(candidates.length, this.random)];
    const nextKind = entity.kind === 'gold-tiny' ? 'gold-small' : entity.kind === 'gold-small' ? 'gold-medium' : 'gold-large';
    Object.assign(entity, makeEntity(nextKind, entity.x, entity.y, entity.id));
    this.burst(entity.x, entity.y, '#fbe470', 12);
    this.float(entity.x, entity.y - entity.radius / this.viewport.stretchY, bilingual(`长大了！$${entity.value}`, `Grew! $${entity.value}`), '#bf7012');
    this.sound('gem');
  }

  private updatePlayer(player: Player, dt: number): void {
    if (player.phase === 'swinging') {
      player.swingTime += dt;
      player.angle = Math.sin(player.swingTime * 1.25) * MAX_ANGLE;
      return;
    }
    const from = hookTip(player);
    const oldLength = player.length;
    if (player.phase === 'extending') {
      const limit = maxHookLength(player);
      player.length = Math.min(player.length + SHOT_SPEED * dt, limit);
      const to = hookTip(player);
      const { hit: nearest, rocks } = traceHookPath(from, to, this.state.entities, this.viewport, this.state.abilities);
      for (const hit of rocks) {
        if (hit.t <= (nearest?.t ?? 1)) this.crushRock(hit, from, to);
      }
      if (nearest) {
        const entity = nearest.entity;
        player.length = oldLength + (player.length - oldLength) * nearest.t;
        if (entity.kind === 'tnt' && !this.state.abilities.includes('bomb-expert')) {
          this.explodeTnt(entity);
          Object.assign(entity, makeEntity('tnt-fragment', entity.x, entity.y, entity.id));
        } else if (entity.kind.startsWith('rock') && this.state.abilities.includes('alchemy') && this.random() < ALCHEMY_CHANCE) {
          Object.assign(entity, makeEntity('gold-large', entity.x, entity.y, entity.id));
          this.burst(entity.x, entity.y, '#fff075', 24);
        }
        if (entity.kind.startsWith('gold') && this.state.abilities.includes('diamond-vein') && this.random() < DIAMOND_VEIN_CHANCE) {
          Object.assign(entity, makeEntity('diamond', entity.x, entity.y, entity.id));
          applyRoundValue(entity, this.state.activeUpgrades);
          this.burst(entity.x, entity.y, '#b8f5ff', 24);
        }
        if (entity.kind === 'tnt') disarmTnt(entity);
        entity.riskBonus = canEarnRiskReward(entity, this.state, this.viewport);
        if (this.state.abilities.includes('clone') && this.state.clonedEntityId === null) this.state.clonedEntityId = entity.id;
        entity.claimedBy = player.id;
        player.cargoId = entity.id;
        this.beginRetraction(player, entity.weight);
        this.positionCargo(player, entity);
        this.sound(entity.kind === 'diamond' || entity.kind === 'mole-diamond' ? 'gem' : 'grab');
      } else if (player.length >= limit) {
        this.beginRetraction(player, null);
      }
      return;
    }
    const cargo = this.state.entities.find((entity) => entity.id === player.cargoId && entity.active);
    const motion = player.reel ?? this.beginRetraction(player, cargo?.weight ?? null);
    motion.elapsed += dt * (cargo ? haulingMultiplier(this.state.abilities) : 1);
    const frames = Math.floor(motion.elapsed * ORIGINAL_FRAME_RATE + 1e-9);
    motion.elapsed = Math.max(0, motion.elapsed - frames / ORIGINAL_FRAME_RATE);
    for (let frame = 0; frame < frames && motion.alive; frame++) {
      stepOriginalReel(motion, cargo?.weight ?? null, this.state.activeUpgrades.includes('strength'), this.state.bagStrength);
      player.length = motion.alive
        ? hookLengthFromReelDistance(player, Math.max(0, originalReelDistance(motion.cursor) + motion.offset), this.viewport)
        : REST_LENGTH;
    }
    if (this.state.abilities.includes('rock-crusher')) {
      const path = hookPath(player, oldLength, player.length);
      for (let index = 1; index < path.length; index++) {
        const { rocks } = traceHookPath(path[index - 1], path[index], this.state.entities, this.viewport, this.state.abilities);
        for (const hit of rocks) this.crushRock(hit, path[index - 1], path[index]);
      }
    }
    if (cargo) this.positionCargo(player, cargo);
    if (!motion.alive) {
      if (cargo) this.collect(player, cargo);
      player.cargoId = null;
      player.reel = null;
      player.turn = null;
      player.phase = 'swinging';
    }
  }

  private beginRetraction(player: Player, weight: number | null) {
    player.phase = 'retracting';
    player.reel = createReelMotion(
      hookReelDistance(player, this.viewport),
      weight,
    );
    return player.reel;
  }

  private positionCargo(player: Player, cargo: Entity): void {
    Object.assign(cargo, hookCargoPosition(player, cargo.radius, this.viewport));
  }

  private collect(player: Player, entity: Entity): void {
    const state = this.state;
    if (entity.kind === 'bag' && entity.bagReward === null) throw new Error('A collected mystery bag has no initialized reward.');
    entity.active = false;
    entity.claimedBy = null;
    let value = entity.value;
    const cloneMultiplier = entity.id === state.clonedEntityId ? CLONE_REWARD_MULTIPLIER : 1;
    // Pre-multiplying these factors can round half-coin payouts down.
    const riskMultiplier = entity.riskBonus ? RISK_VALUE_MULTIPLIER : 1;
    const rushMultiplier = state.abilities.includes('time-rush') ? RUSH_VALUE_MULTIPLIER : 1;
    let label: DisplayText = '';
    let sound: Sound | null = 'gold';
    if (entity.kind.startsWith('gold')) {
      if (state.abilities.includes('gold-collector')) value += value * GOLD_COLLECTOR_BONUS_PERCENT / 100;
      value = value * riskMultiplier * rushMultiplier;
    }
    if (entity.kind === 'diamond' || entity.kind === 'mole-diamond') {
      const bodyValue = entity.kind === 'mole-diamond' ? MOLE_VALUE : 0;
      let diamondValue = entity.value - bodyValue;
      if (state.abilities.includes('diamond-collector')) diamondValue += diamondValue * DIAMOND_COLLECTOR_BONUS_PERCENT / 100;
      value = bodyValue + diamondValue * riskMultiplier * rushMultiplier;
      sound = null; // Diamond feedback already played at capture.
    }
    if (entity.kind.startsWith('rock')) {
      sound = 'rock';
    }
    if (entity.kind.startsWith('bone') && state.abilities.includes('archaeologist')) value *= ARCHAEOLOGIST_VALUE_MULTIPLIER;
    if (entity.kind.startsWith('bone') || entity.kind === 'mole' || entity.kind === 'tnt-fragment') sound = 'rock';
    if (entity.kind === 'bag') {
      sound = 'bag';
      const reward = entity.bagReward!;
      if (reward.kind === 'dynamite') {
        const amount = reward.amount * cloneMultiplier;
        state.dynamite += amount;
        label = bilingual(`炸药 +${amount}`, `Dynamite +${amount}`);
      } else if (reward.kind === 'strength') {
        state.bagStrength = true;
        label = bilingual('本关生力', 'Fast hauling');
      } else {
        value = reward.value;
      }
    }
    let fossilBonus = 0;
    if (state.abilities.includes('fossil-puzzle') && (entity.kind === 'bone-small' || entity.kind === 'bone-large')
      && !state.fossilPieces.includes(entity.kind)) {
      state.fossilPieces.push(entity.kind);
      if (state.fossilPieces.length === 2) fossilBonus = FOSSIL_PUZZLE_BONUS;
    }
    value = Math.round(value) * cloneMultiplier + fossilBonus;
    state.score += value;
    player.roundEarned += value;
    this.float(player.origin.x, player.origin.y - 31 / this.viewport.stretchY, label || `+$${value}`, value >= 500 ? '#bf7012' : '#775029');
    this.burst(player.origin.x, player.origin.y - 3 / this.viewport.stretchY, value >= 500 ? '#fbe470' : '#e7ba4c', 14);
    if (fossilBonus > 0) this.float(player.origin.x, player.origin.y - 65 / this.viewport.stretchY, bilingual(`化石拼图 +$${fossilBonus}`, `Fossil Puzzle +$${fossilBonus}`), '#bf7012');
    if (sound) this.sound(sound);
    if (state.score >= state.target && !state.goalAnnounced) {
      state.goalAnnounced = true;
      this.notify(bilingual('目标达成！继续挖，或提前收工去逛商店。', 'Target reached! Keep mining or finish early to visit the shop.'), 'good');
    }
    this.publish();
  }

  private destroy(entity: Entity): void {
    entity.active = false;
    entity.claimedBy = null;
    for (const player of this.state.players) {
      if (player.cargoId === entity.id) {
        player.cargoId = null;
        if (player.reel) player.reel.localFast = true;
        else this.beginRetraction(player, null);
      }
    }
  }

  private crushRock({ entity, t }: HookHit, from: Point, to: Point): void {
    this.destroy(entity);
    const large = entity.kind === 'rock-large';
    const count = large ? 9 : 5;
    const { stretchX, stretchY } = this.viewport;
    this.state.particles.push({
      kind: 'impact', x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t,
      vx: 0, vy: 0, life: 0.07, maxLife: 0.07, size: large ? 12 : 9, color: '#fff7dc',
    });
    for (let index = 0; index < count; index++) {
      const angle = index * Math.PI * 2 / count + (this.fxRandom() - 0.5) * 0.65;
      const speed = 40 + this.fxRandom() * 55;
      const life = 0.28 + this.fxRandom() * 0.12;
      this.state.particles.push({
        kind: 'rock-chip',
        x: entity.x + Math.cos(angle) * entity.radius * 0.25 / stretchX,
        y: entity.y + Math.sin(angle) * entity.radius * 0.25 / stretchY,
        vx: Math.cos(angle) * speed / stretchX,
        vy: (Math.sin(angle) * speed - 35) / stretchY,
        life, maxLife: life, size: 3 + this.fxRandom() * (large ? 4.5 : 3),
        color: ['#9c998c', '#766f60', '#b7ad92'][index % 3],
        rotation: this.fxRandom() * Math.PI * 2, spin: (this.fxRandom() - 0.5) * 10,
      });
    }
    for (let index = 0; index < (large ? 3 : 2); index++) {
      const life = 0.28 + this.fxRandom() * 0.07;
      this.state.particles.push({
        kind: 'rock-dust',
        x: entity.x + (this.fxRandom() - 0.5) * entity.radius * 0.55 / stretchX,
        y: entity.y + (this.fxRandom() - 0.5) * entity.radius * 0.4 / stretchY,
        vx: (this.fxRandom() - 0.5) * 24 / stretchX,
        vy: -(10 + this.fxRandom() * 12) / stretchY,
        life, maxLife: life, size: entity.radius * 0.22 + this.fxRandom() * 4, color: '#9e947b',
      });
    }
    if (this.state.elapsed - this.lastCrushSoundAt >= CRUSH_SOUND_INTERVAL - 1e-9) {
      this.lastCrushSoundAt = this.state.elapsed;
      this.sound('crush');
    }
  }

  private explodeTnt(source: Entity): void {
    if (this.state.abilities.includes('bomb-expert')) return;
    const queue = [source];
    const detonated = new Set<number>();
    while (queue.length > 0) {
      const charge = queue.shift()!;
      if (detonated.has(charge.id)) continue;
      detonated.add(charge.id);
      this.destroy(charge);
      this.state.particles.push({
        kind: 'blast', x: charge.x, y: charge.y, vx: 0, vy: 0,
        life: 0.65, maxLife: 0.65, size: TNT_BLAST_RADIUS, color: '#e77636',
      });
      this.burst(charge.x, charge.y, '#e77636', 36);
      this.float(charge.x, charge.y - 40 / this.viewport.stretchY, 'BOOM!', '#a94529');
      for (const entity of this.state.entities) {
        if (!entity.active || entity.claimedBy !== null || !inTntBlast(charge, entity, this.viewport)) continue;
        if (entity.kind === 'tnt') queue.push(entity);
        else {
          this.burst(entity.x, entity.y, '#ac8250', 8);
          this.destroy(entity);
        }
      }
    }
    this.sound('explosion');
    this.notify(detonated.size > 1
      ? bilingual('TNT 引发连锁爆炸，矿场遭到大范围破坏！', 'TNT triggered a chain reaction and destroyed a large part of the mine!')
      : bilingual('TNT 炸毁了大范围矿物，小心红色炸药箱！', 'TNT destroyed nearby minerals. Watch out for the red crates!'), 'warning');
  }

  private burst(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 40 + this.fxRandom() * 120;
      const life = 0.45 + this.fxRandom() * 0.65;
      this.state.particles.push({
        kind: 'spark', x, y,
        vx: Math.cos(angle) * speed / this.viewport.stretchX,
        vy: (Math.sin(angle) * speed - 45) / this.viewport.stretchY,
        life, maxLife: life, size: 2 + this.fxRandom() * 5, color,
      });
    }
  }

  private float(x: number, y: number, text: DisplayText, color: string): void {
    this.state.texts.push({ x, y, text, color, life: 1.6 });
  }

  finishEarly(): void {
    if (this.state.phase !== 'playing' || this.state.score < this.state.target) return;
    if (this.state.players.some((player) => player.cargoId !== null)) {
      this.notify(bilingual('还有矿物在钩上，先收回来再收工吧。', 'Bring back the cargo on your hooks before finishing early.'));
      return;
    }
    this.finishRound();
  }

  private finishRound(): void {
    const state = this.state;
    if (state.phase !== 'playing') return;
    const passed = state.score >= state.target;
    const timeBankBonus = passed && state.abilities.includes('time-bank')
      ? Math.ceil(state.timeLeft) * TIME_BANK_COINS_PER_SECOND
      : 0;
    state.score += timeBankBonus;
    state.result = {
      earned: state.score - state.roundStartScore,
      timeBankBonus,
      fossilBonus: state.fossilPieces.length === 2 ? FOSSIL_PUZZLE_BONUS : 0,
      passed,
    };
    state.phase = passed ? 'results' : 'gameover';
    state.notice = null;
    this.sound(passed ? 'win' : 'lose');
    this.publish();
  }

  openShop(): void {
    if (this.state.phase !== 'results') return;
    const next = this.state.level + 1;
    if (needsAbilityChoice(next, this.state.abilities.length)) {
      this.beginDraft(next);
      return;
    }
    this.enterShop();
  }

  private enterShop(): void {
    this.state.bagStrength = false;
    this.state.activeUpgrades = [];
    this.state.shop = createShop(this.state.level, {
      random: this.random, dynamite: this.state.dynamite, abilities: this.state.abilities,
    });
    this.state.shopStealsRemaining = this.state.abilities.includes('thief') ? 2 : 0;
    this.state.phase = 'shop';
    this.state.notice = null;
    this.publish();
  }

  buy(id: ShopItemId): boolean {
    if (this.state.phase !== 'shop') return false;
    const item = this.state.shop.find((candidate) => candidate.id === id);
    if (!item) {
      this.notify(bilingual('这件商品本次未上架。', 'This item is not available in this shop.'), 'warning');
      this.sound('denied');
      return false;
    }
    if (item.bought >= item.stock) {
      this.notify(bilingual('这件补给已经买齐啦。', 'You have already bought this supply.'), 'warning');
      return false;
    }
    if (this.state.score < item.price) {
      this.notify(bilingual('金币不够啦，留待下次再买吧。', 'Not enough gold. Save this purchase for another visit.'), 'warning');
      this.sound('denied');
      return false;
    }
    this.state.score -= item.price;
    this.grantShopItem(item);
    this.sound('buy');
    this.notify(bilingual(
      `买好啦！${item.name['zh-CN']}${id === 'dynamite' ? '已放进背包。' : '将在下一关生效。'}`,
      `Purchased ${item.name.en}${id === 'dynamite' ? '. Added to your inventory.' : '. Active next stage.'}`,
    ), 'good');
    return true;
  }

  steal(id: ShopItemId): boolean {
    const state = this.state;
    if (state.phase !== 'shop') return false;
    if (!state.abilities.includes('thief') || state.shopStealsRemaining <= 0) {
      this.notify(bilingual('本次商店没有可用的偷取次数。', 'No free thefts remain for this shop visit.'), 'warning');
      this.sound('denied');
      return false;
    }
    const item = state.shop.find((entry) => entry.id === id);
    if (!item) {
      this.notify(bilingual('这件商品本次未上架。', 'This item is not available in this shop.'), 'warning');
      return false;
    }
    if (item.bought >= item.stock) {
      this.notify(bilingual('这件商品已经没有库存了。', 'This item is sold out.'), 'warning');
      return false;
    }
    state.shopStealsRemaining--;
    this.grantShopItem(item);
    this.sound('buy');
    this.notify(bilingual(
      `已免费取得${item.name['zh-CN']}，剩余${state.shopStealsRemaining}次。`,
      `Stole ${item.name.en} for free. Thefts remaining: ${state.shopStealsRemaining}.`,
    ), 'good');
    return true;
  }

  private grantShopItem(item: ShopItem): void {
    item.bought++;
    if (item.id === 'dynamite') this.state.dynamite++;
    else this.state.pendingUpgrades.push(item.id);
  }

  nextLevel(): void {
    if (this.state.phase !== 'shop') return;
    this.beginLevel(this.state.level + 1);
  }

  private beginLevel(level: number): void {
    const state = this.state;
    const info = getLevelInfo(level, state.mode);
    const travelLightBonus = state.phase === 'shop' && state.abilities.includes('travel-light')
      && state.shop.every((item) => item.bought === 0) ? TRAVEL_LIGHT_BONUS_SECONDS : 0;
    const upgrades = [...state.pendingUpgrades];
    const entities = createLevel(level, state.mode, {
      abilities: state.abilities,
      random: this.random,
      upgrades,
      dynamite: state.dynamite,
    });
    state.level = level;
    state.target = info.target;
    state.timeLeft = info.duration * (state.abilities.includes('time-rush') ? RUSH_DURATION_MULTIPLIER : 1)
      + travelLightBonus;
    state.clonedEntityId = null;
    state.elapsed = 0;
    this.lastCrushSoundAt = -Infinity;
    state.bagStrength = false;
    state.activeUpgrades = upgrades;
    state.pendingUpgrades = [];
    state.roundStartScore = state.score;
    state.fossilPieces = [];
    state.goalAnnounced = false;
    state.draftLevel = null;
    state.abilityOffers = [];
    state.shopStealsRemaining = 0;
    state.players = createPlayers(state.mode, this.viewport.originY);
    state.entities = entities;
    state.particles = [];
    state.texts = [];
    state.result = null;
    state.phase = 'playing';
    this.notify(info.hint);
  }
}
