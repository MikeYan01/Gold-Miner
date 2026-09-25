import type { EntityKind } from './types';
import { originalCategory } from './economy';
import { randomInteger } from './random';

export type ResourceCounts = Readonly<Record<Exclude<EntityKind, 'tnt-fragment'>, number>>;

function profile(
  gold: readonly [number, number, number, number],
  rocks: readonly [number, number],
  diamonds: number,
  moles: readonly [number, number],
  bones: readonly [number, number],
  bags: number,
  tnt: number,
): ResourceCounts {
  return {
    'gold-tiny': gold[0], 'gold-small': gold[1], 'gold-medium': gold[2], 'gold-large': gold[3],
    'rock-small': rocks[0], 'rock-large': rocks[1],
    diamond: diamonds, mole: moles[0], 'mole-diamond': moles[1],
    'bone-small': bones[0], 'bone-large': bones[1], bag: bags, tnt,
  };
}

// Numerical compositions only. Placement is our own, not the original authored coordinates.
const CATEGORY_PROFILES: readonly (readonly [ResourceCounts, ResourceCounts, ResourceCounts])[] = [
  [
    profile([4, 3, 0, 2], [2, 2], 0, [0, 0], [0, 0], 2, 0),
    profile([5, 3, 0, 2], [2, 2], 0, [0, 0], [0, 0], 1, 0),
    profile([5, 3, 0, 2], [2, 2], 0, [0, 0], [0, 0], 1, 0),
  ],
  [
    profile([7, 2, 0, 2], [3, 4], 1, [0, 0], [0, 0], 1, 0),
    profile([7, 3, 0, 2], [3, 4], 0, [0, 0], [0, 0], 1, 0),
    profile([7, 3, 0, 2], [3, 4], 0, [0, 0], [0, 0], 1, 0),
  ],
  [
    profile([4, 3, 0, 1], [3, 4], 1, [0, 0], [0, 0], 1, 0),
    profile([4, 3, 0, 1], [3, 4], 1, [0, 0], [0, 0], 1, 0),
    profile([4, 3, 0, 1], [3, 4], 1, [0, 0], [0, 0], 1, 0),
  ],
  [
    profile([4, 1, 2, 0], [1, 3], 0, [3, 0], [0, 0], 4, 0),
    profile([4, 3, 2, 0], [1, 3], 0, [3, 0], [0, 0], 2, 0),
    profile([4, 3, 2, 0], [1, 3], 0, [3, 0], [0, 0], 2, 0),
  ],
  [
    profile([4, 3, 1, 2], [1, 3], 4, [3, 0], [0, 0], 1, 0),
    profile([4, 3, 2, 2], [1, 3], 3, [3, 0], [0, 0], 1, 0),
    profile([4, 3, 2, 2], [1, 3], 3, [3, 0], [0, 0], 1, 0),
  ],
  [
    profile([7, 3, 0, 1], [3, 3], 0, [0, 4], [0, 0], 1, 0),
    profile([7, 3, 0, 1], [3, 3], 0, [0, 4], [0, 0], 1, 0),
    profile([7, 3, 0, 1], [3, 3], 0, [0, 4], [0, 0], 1, 0),
  ],
  [
    profile([2, 0, 2, 3], [0, 0], 0, [6, 0], [2, 2], 1, 2),
    profile([2, 0, 2, 3], [0, 0], 0, [6, 0], [2, 2], 1, 2),
    profile([2, 0, 2, 3], [0, 0], 0, [6, 0], [2, 2], 1, 2),
  ],
  [
    profile([0, 0, 0, 0], [0, 0], 8, [0, 3], [0, 0], 2, 5),
    profile([0, 0, 0, 0], [0, 0], 8, [0, 3], [0, 0], 2, 5),
    profile([0, 0, 0, 5], [7, 9], 4, [0, 0], [0, 0], 0, 2),
  ],
  [
    profile([1, 0, 0, 2], [0, 0], 7, [0, 4], [1, 1], 3, 7),
    profile([1, 0, 0, 2], [0, 0], 7, [0, 4], [1, 1], 3, 7),
    profile([1, 0, 0, 0], [0, 0], 0, [6, 7], [0, 0], 1, 1),
  ],
  [
    profile([6, 5, 5, 5], [0, 5], 0, [0, 0], [0, 0], 0, 0),
    profile([1, 0, 0, 2], [0, 0], 7, [0, 4], [1, 1], 3, 7),
    profile([1, 0, 0, 2], [0, 0], 7, [0, 4], [1, 1], 3, 7),
  ],
];

export const RESOURCE_KINDS: readonly (keyof ResourceCounts)[] = [
  'gold-tiny', 'gold-small', 'gold-medium', 'gold-large', 'rock-small', 'rock-large',
  'diamond', 'mole', 'mole-diamond', 'bone-small', 'bone-large', 'bag', 'tnt',
];

export function originalResourceProfile(level: number, variant: number): ResourceCounts {
  const category = originalCategory(level);
  if (!Number.isInteger(variant) || variant < 1 || variant > 3) throw new RangeError('Resource variant must be 1, 2 or 3.');
  return { ...CATEGORY_PROFILES[category - 1][variant - 1] };
}

export function drawOriginalResources(level: number, random: () => number): ResourceCounts {
  return originalResourceProfile(level, randomInteger(3, random) + 1);
}
