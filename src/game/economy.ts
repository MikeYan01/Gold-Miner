import { randomInteger } from './random';
import type { AbilityId, BagReward, EntityKind, ShopItemId, Upgrade } from './types';

export const ORIGINAL_STARTING_MONEY = 0;
export const ORIGINAL_STARTING_DYNAMITE = 0;
export const ORIGINAL_CATEGORY_COUNT = 10;
export const ROCK_BOOK_MULTIPLIER = 3;
export const DIAMOND_POLISH_BONUS = 300;

function validateStage(level: number): void {
  if (!Number.isSafeInteger(level) || level < 1) throw new RangeError('Stage must be a positive safe integer.');
}

export function originalLevelTarget(level: number): number {
  validateStage(level);
  const target = level <= 10
    ? 375 + 275 * level + 135 * level * (level - 1)
    : 15275 + 2705 * (level - 10);
  if (!Number.isSafeInteger(target)) throw new RangeError('Stage target exceeds the supported currency range.');
  return target;
}

export function originalCategory(level: number): number {
  validateStage(level);
  return level <= ORIGINAL_CATEGORY_COUNT ? level : 4 + (level - 11) % 7;
}

export interface OriginalShopOffer {
  id: ShopItemId;
  price: number;
}

export function rollOriginalShop(
  completedLevel: number,
  dynamite: number,
  random: () => number,
  guaranteed: readonly ('strength' | 'luck' | 'polish')[] = [],
): OriginalShopOffer[] {
  const category = originalCategory(completedLevel);
  if (!Number.isSafeInteger(dynamite) || dynamite < 0) throw new RangeError('Dynamite inventory must be a nonnegative safe integer.');
  const offers: OriginalShopOffer[] = [];
  if (dynamite < 5) offers.push({ id: 'dynamite', price: 1 + randomInteger(300, random) + 2 * category });
  if (randomInteger(10, random) < 4 || guaranteed.includes('strength')) offers.push({ id: 'strength', price: 100 + randomInteger(300, random) });
  if (randomInteger(10, random) < 4 || guaranteed.includes('luck')) offers.push({ id: 'luck', price: 1 + randomInteger(50 * category, random) + 2 * category });
  if (randomInteger(10, random) < 6) offers.push({ id: 'rockbook', price: 1 + randomInteger(150, random) });
  if (randomInteger(10, random) < 5 || guaranteed.includes('polish')) offers.push({ id: 'polish', price: 201 + randomInteger(100 * category, random) });
  return offers;
}

export function originalRoundValue(kind: EntityKind, baseValue: number, upgrades: readonly Upgrade[]): number {
  if (kind.startsWith('rock') && upgrades.includes('rockbook')) return baseValue * ROCK_BOOK_MULTIPLIER;
  if ((kind === 'diamond' || kind === 'mole-diamond') && upgrades.includes('polish')) return baseValue + DIAMOND_POLISH_BONUS;
  return baseValue;
}

export interface BagContext {
  lucky: boolean;
  dynamite: number;
  abilities: readonly AbilityId[];
}

// The original six-way draw is fixed when the bag is created, including the inventory substitution.
export function rollOriginalBagReward(
  lucky: boolean,
  dynamite: number,
  random: () => number,
): BagReward {
  if (!Number.isSafeInteger(dynamite) || dynamite < 0) throw new RangeError('Dynamite inventory must be a nonnegative safe integer.');
  const face = randomInteger(6, random);
  if (lucky) {
    if (face < 2) return { kind: 'strength' };
    if (face < 4) {
      return dynamite > 3
        ? { kind: 'cash', value: 300 + randomInteger(300, random) }
        : { kind: 'dynamite', amount: 1 };
    }
    return { kind: 'cash', value: 700 };
  }
  if (face < 3) return { kind: 'cash', value: 1 + randomInteger(600, random) };
  if (face === 3) return { kind: 'strength' };
  if (face === 4) {
    return dynamite > 3
      ? { kind: 'cash', value: 100 + randomInteger(100, random) }
      : { kind: 'dynamite', amount: 1 };
  }
  return { kind: 'cash', value: 800 };
}

function abilityCash(lucky: boolean, random: () => number): BagReward {
  return { kind: 'cash', value: lucky ? 400 + randomInteger(401, random) : 100 + randomInteger(351, random) };
}

export function rollBagReward(context: BagContext, random: () => number): BagReward {
  if (context.abilities.includes('moneybags')) return abilityCash(context.lucky, random);
  return rollOriginalBagReward(context.lucky, context.dynamite, random);
}

export function runLevelTarget(level: number): number {
  validateStage(level);
  if (level <= 10) return originalLevelTarget(level);
  const startingIncrement = 2705;
  const cappedIncrement = 8_000;
  let target = originalLevelTarget(10);
  for (let step = 1; step <= Math.min(level - 10, 10); step++) {
    target += Math.round(startingIncrement + (cappedIncrement - startingIncrement) * step / 10);
  }
  target += Math.max(0, level - 20) * cappedIncrement;
  if (!Number.isSafeInteger(target)) throw new RangeError('Stage target exceeds the supported currency range.');
  return target;
}
