import type { AbilityId, Entity, EntityKind, Mode, Point, ShopItem, ShopItemId, Upgrade } from './types';
import { createRandom, shuffled } from './random';
import { DIAMOND_VEIN_CHANCE, rollBagCount } from './abilities';
import { MATERIAL_WEIGHTS, rollOriginalBagWeight } from './hauling';
import {
  originalCategory, originalRoundValue,
  rollBagReward, rollOriginalShop, runLevelTarget,
} from './economy';
import type { BagContext } from './economy';
import { drawOriginalResources, RESOURCE_KINDS } from './resource-profiles';
import { inTntBlast, TNT_BLAST_RADIUS } from './blast';

export const WIDTH = 1200;
export const HEIGHT = 720;
export const SURFACE = 170;
export const ORIGIN_Y = 143;
export const REST_LENGTH = 47;
export const MAX_ANGLE = 1.2;
export const DIAMOND_VALUE = 600;
export const MOLE_VALUE = 2;

const DEEP_TREASURE_KINDS: readonly EntityKind[] = ['gold-medium', 'gold-large', 'diamond', 'mole-diamond'];
const TREASURE_MIN_TOP = SURFACE + (HEIGHT - SURFACE) * 0.4;
const MIDDLE_MINE_TOP = SURFACE + (HEIGHT - SURFACE) / 3;
const LOWER_MINE_TOP = SURFACE + (HEIGHT - SURFACE) * 2 / 3;

export interface LevelInfo {
  name: string;
  hint: string;
  target: number;
  duration: number;
}

export const LEVELS: readonly Pick<LevelInfo, 'name' | 'hint'>[] = [
  { name: '初入金矿', hint: '大金块更值钱，不过拉上来也更费时间。' },
  { name: '沙砾寻金', hint: '先看清岩石之间的空隙，再下钩。' },
  { name: '宝石矿脉', hint: '钻石小巧又轻盈，一颗就值 $600。' },
  { name: '神秘布袋', hint: '布袋可能有金币、炸药，也可能带来本关生力效果。' },
  { name: '鼹鼠出没', hint: '普通鼹鼠只值 $2，小心它们挡住宝藏。' },
  { name: '疾走宝藏', hint: '瞄准叼着钻石的鼹鼠，别急着出钩。' },
  { name: '遗骨矿坑', hint: 'TNT可能连锁爆炸，先取走附近的宝藏。' },
  { name: '星光矿洞', hint: '钻石抛光剂让钻石增值50%，$600变成$900。' },
  { name: '爆破遗迹', hint: '危险与宝藏相伴，别把整片矿脉一起炸掉。' },
  { name: '黄金深处', hint: '保留富矿关的盈余，才能应对后续的贫矿关。' },
];
export const OPENING_LEVEL_COUNT = LEVELS.length;

const PROPERTIES: Record<EntityKind, { radius: number; weight: number; value: number }> = {
  'gold-tiny': { radius: 16, weight: MATERIAL_WEIGHTS['gold-tiny'], value: 50 },
  'gold-small': { radius: 21, weight: MATERIAL_WEIGHTS['gold-small'], value: 100 },
  'gold-medium': { radius: 29, weight: MATERIAL_WEIGHTS['gold-medium'], value: 250 },
  'gold-large': { radius: 44, weight: MATERIAL_WEIGHTS['gold-large'], value: 500 },
  'rock-small': { radius: 25, weight: MATERIAL_WEIGHTS['rock-small'], value: 11 },
  'rock-large': { radius: 39, weight: MATERIAL_WEIGHTS['rock-large'], value: 20 },
  diamond: { radius: 18, weight: MATERIAL_WEIGHTS.diamond, value: DIAMOND_VALUE },
  bag: { radius: 24, weight: -1, value: 0 },
  'bone-small': { radius: 24, weight: MATERIAL_WEIGHTS['bone-small'], value: 7 },
  'bone-large': { radius: 31, weight: MATERIAL_WEIGHTS['bone-large'], value: 20 },
  mole: { radius: 24, weight: MATERIAL_WEIGHTS.mole, value: MOLE_VALUE },
  'mole-diamond': { radius: 26, weight: MATERIAL_WEIGHTS['mole-diamond'], value: DIAMOND_VALUE + MOLE_VALUE },
  tnt: { radius: 27, weight: MATERIAL_WEIGHTS.tnt, value: 1 },
  'tnt-fragment': { radius: 12, weight: MATERIAL_WEIGHTS.tnt, value: 1 },
};

export function levelTarget(level: number): number {
  return runLevelTarget(level);
}

export function getLevelInfo(level: number, mode: Mode): LevelInfo {
  const source = LEVELS[originalCategory(level) - 1];
  return { ...source, target: levelTarget(level), duration: mode === 'coop' ? 40 : 60 };
}

export function makeEntity(kind: EntityKind, x: number, y: number, id: number): Entity {
  return {
    id, kind, x, y, ...PROPERTIES[kind],
    baseValue: PROPERTIES[kind].value,
    active: true,
    claimedBy: null,
    riskBonus: false,
    fuseRemaining: null,
    bagReward: null,
    rotation: Math.sin(id * 7.13) * 0.2,
    direction: id % 2 === 0 ? 1 : -1,
    speed: kind.startsWith('mole') ? (kind === 'mole-diamond' ? 44 : 34) : 0,
  };
}

export function disarmTnt(entity: Entity): void {
  entity.baseValue = PROPERTIES['gold-tiny'].value;
  entity.value = entity.baseValue;
  entity.weight = PROPERTIES['gold-tiny'].weight;
  entity.fuseRemaining = null;
}

export function applyRoundValue(entity: Entity, upgrades: readonly Upgrade[]): void {
  entity.value = originalRoundValue(entity.kind, entity.baseValue, upgrades);
}

export interface LevelOptions {
  abilities?: readonly AbilityId[];
  random?: () => number;
  upgrades?: readonly Upgrade[];
  dynamite?: number;
}

export function initialiseBag(entity: Entity, context: BagContext, random: () => number): void {
  if (entity.kind !== 'bag') throw new Error('Only a mystery bag can receive a bag reward.');
  entity.bagReward = rollBagReward(context, random);
  entity.weight = context.abilities.includes('moneybags')
    ? MATERIAL_WEIGHTS.diamond
    : rollOriginalBagWeight(random);
}

export function createLevel(level: number, mode: Mode, options: LevelOptions = {}): Entity[] {
  const category = originalCategory(level);
  const abilities = options.abilities ?? [];
  const random = options.random ?? createRandom(Math.imul(level, 104729) + (mode === 'coop' ? 1 : 0));
  const counts = drawOriginalResources(level, random);
  const baseKinds: EntityKind[] = [];
  for (const kind of RESOURCE_KINDS) {
    if (kind !== 'bag' && kind !== 'tnt') {
      const retained = Math.round(counts[kind] * (DEEP_TREASURE_KINDS.includes(kind) ? 0.8 : 0.65));
      for (let count = 0; count < retained; count++) baseKinds.push(kind);
    }
  }
  if (mode === 'coop') {
    baseKinds.push(...(level < 3
      ? ['gold-medium', 'gold-large'] as const
      : level <= 12 ? ['diamond', 'gold-large'] as const
        : ['diamond', 'diamond'] as const));
  }
  const diamondCount = baseKinds.filter((kind) => kind === 'diamond').length;
  let diamondsRemaining = Math.floor(diamondCount / 2) + (diamondCount % 2 === 1 && random() < 0.5 ? 1 : 0);
  const kinds = baseKinds.filter((kind) => {
    if (kind !== 'diamond') return true;
    if (diamondsRemaining === 0) return false;
    diamondsRemaining--;
    return true;
  });
  const desiredTnt = Math.max(counts.tnt, level < 4 ? 3 : level < 25 ? 4 : 5);
  for (let count = 0; count < desiredTnt; count++) kinds.push('tnt');
  const bagCount = rollBagCount(abilities, random);
  for (let count = 0; count < bagCount; count++) kinds.push('bag');
  if (abilities.includes('diamond-moles')) kinds.push('mole-diamond');

  const entities = kinds.map((kind, id) => {
    const actualKind = kind.startsWith('gold') && abilities.includes('diamond-vein') && random() < DIAMOND_VEIN_CHANCE
      ? 'diamond' : kind;
    const entity = makeEntity(actualKind, 0, 0, id);
    if (actualKind === 'tnt' && abilities.includes('bomb-expert')) disarmTnt(entity);
    applyRoundValue(entity, options.upgrades ?? []);
    if (actualKind === 'bag') {
      initialiseBag(entity, {
        abilities, lucky: options.upgrades?.includes('luck') ?? false, dynamite: options.dynamite ?? 0,
      }, random);
    }
    if (actualKind.startsWith('mole')) {
      entity.speed *= 1 + Math.min(0.75, Math.max(0, level - 13) * 0.02);
    }
    return entity;
  });
  placeMine(entities, mode, abilities, random, `${category}/${level}`);
  return entities;
}

function placeMine(entities: Entity[], mode: Mode, abilities: readonly AbilityId[], random: () => number, label: string): void {
  const origins = mode === 'solo' ? [600] : [360, 840];
  const anchors: Point[] = [];
  for (let row = 0; row < 5; row++) {
    const columns = row === 0
      ? [300, 500, 700, 900]
      : row % 2 === 0 ? [100, 300, 500, 700, 900, 1100] : [200, 400, 600, 800, 1000];
    for (const x of columns) anchors.push({ x: x + random() * 12 - 6, y: 303 + row * 83 + random() * 12 - 6 });
  }
  anchors.push({ x: 400, y: 286 }, { x: 600, y: 286 }, { x: 800, y: 286 });
  const grid: Point[] = [];
  for (let y = 252; y <= 672; y += 35) {
    for (let x = 65; x <= 1145; x += 36) grid.push({ x, y });
  }
  const positions = [...shuffled(anchors, random), ...shuffled(grid, random)];
  const allowChainPair = random() < 0.85;
  const airyMoles = abilities.includes('airy-moles');
  const placed: Entity[] = [];
  const covered = new Set<number>();
  const order = [...entities].sort((a, b) => {
    if ((a.kind === 'tnt') !== (b.kind === 'tnt')) return a.kind === 'tnt' ? 1 : -1;
    const aDeep = DEEP_TREASURE_KINDS.includes(a.kind);
    const bDeep = DEEP_TREASURE_KINDS.includes(b.kind);
    if (aDeep !== bDeep) return aDeep ? -1 : 1;
    return b.radius - a.radius || a.id - b.id;
  });
  for (const entity of order) {
    const minimumTop = entity.kind === 'mole-diamond'
      ? airyMoles ? SURFACE + 28 : MIDDLE_MINE_TOP
      : DEEP_TREASURE_KINDS.includes(entity.kind) ? TREASURE_MIN_TOP : SURFACE + 28;
    const canPlace = (point: Point) =>
      point.x - entity.radius > 18 && point.x + entity.radius < WIDTH - 18 &&
      point.y - entity.radius >= minimumTop && point.y + entity.radius < HEIGHT - 12 &&
      origins.some((x) => Math.abs(Math.atan2(point.x - x, point.y - SURFACE)) < MAX_ANGLE) &&
      placed.every((other) => Math.hypot(other.x - point.x, other.y - point.y) > other.radius + entity.radius + 10);
    let position: Point | undefined;
    if (entity.kind === 'tnt') {
      const charges = placed.filter((other) => other.kind === 'tnt');
      const resources = placed.filter((other) => other.kind !== 'tnt');
      const candidates = positions.filter(canPlace);
      const preferPair = allowChainPair && charges.length === 1;
      let bestConnectionPenalty = Infinity;
      let bestCoverage = -1;
      let bestSeparation = -1;
      for (const candidate of candidates) {
        const connections = charges.filter((charge) => inTntBlast(charge, { ...candidate, radius: entity.radius })).length;
        const pairDistance = preferPair ? Math.hypot(candidate.x - charges[0].x, candidate.y - charges[0].y) : Infinity;
        const connectionPenalty = preferPair
          ? pairDistance <= TNT_BLAST_RADIUS / 2 ? 0 : connections > 0 ? 1 : 2
          : connections;
        if (connectionPenalty > bestConnectionPenalty) continue;
        const coverage = resources.filter((other) => !covered.has(other.id) && inTntBlast(candidate, other)).length;
        const separation = charges.length === 0 ? 0
          : Math.min(...charges.map((charge) => Math.hypot(candidate.x - charge.x, candidate.y - charge.y)));
        if (connectionPenalty < bestConnectionPenalty || coverage > bestCoverage
          || coverage === bestCoverage && separation > bestSeparation) {
          position = candidate;
          bestConnectionPenalty = connectionPenalty;
          bestCoverage = coverage;
          bestSeparation = separation;
        }
      }
      if (position) {
        for (const resource of resources) if (inTntBlast(position, resource)) covered.add(resource.id);
      }
    } else {
      let preferredTop = minimumTop;
      let preferredBottom = HEIGHT - 12;
      if (entity.kind === 'diamond') {
        if (random() < 0.9) preferredTop = LOWER_MINE_TOP;
        else preferredBottom = LOWER_MINE_TOP;
      } else if (entity.kind === 'mole' || entity.kind === 'mole-diamond') {
        const roll = random();
        if ((entity.kind === 'mole' || airyMoles) && roll < 0.45) {
          preferredBottom = MIDDLE_MINE_TOP;
        } else if (roll < (entity.kind === 'mole' || airyMoles ? 0.9 : 0.5)) {
          preferredTop = Math.max(minimumTop, MIDDLE_MINE_TOP);
          preferredBottom = LOWER_MINE_TOP;
        } else {
          preferredTop = LOWER_MINE_TOP;
        }
      }
      position = positions.find((point) => canPlace(point)
        && point.y - entity.radius >= preferredTop && point.y + entity.radius <= preferredBottom)
        ?? positions.find(canPlace);
    }
    if (!position) throw new Error(`No reachable placement for ${entity.kind} in resource profile ${label}.`);
    entity.x = position.x;
    entity.y = position.y;
    placed.push(entity);
  }
}

const SHOP_DETAILS: Record<ShopItemId, Pick<ShopItem, 'name' | 'description' | 'tag'>> = {
  dynamite: { name: '一捆炸药', description: '炸掉钩上的重物', tag: '可以囤着用' },
  strength: { name: '大力水', description: '下关力量 +2', tag: '下关生效' },
  luck: { name: '幸运四叶草', description: '下关布袋奖励更好', tag: '下关生效' },
  rockbook: { name: '石头收藏书', description: '下关石头售价 ×3', tag: '下关生效' },
  polish: { name: '钻石抛光剂', description: '下关钻石售价 +50%', tag: '下关生效' },
};

export interface ShopOptions {
  random?: () => number;
  dynamite?: number;
  abilities?: readonly AbilityId[];
}

export function createShop(completedLevel: number, options: ShopOptions = {}): ShopItem[] {
  const random = options.random ?? createRandom(Math.imul(completedLevel, 65537) + 2026);
  const guaranteed: readonly ('strength' | 'luck' | 'polish')[] = options.abilities?.includes('regular-customer')
    ? ['strength', 'luck', 'polish'] : [];
  return rollOriginalShop(completedLevel, options.dynamite ?? 0, random, guaranteed).map((offer) => ({
    id: offer.id,
    ...SHOP_DETAILS[offer.id],
    price: offer.price,
    priceText: `$${offer.price.toLocaleString('en-US')}`,
    stock: 1,
    bought: 0,
  }));
}
