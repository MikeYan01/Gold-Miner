import { randomInteger } from './random';

// Verified against the GameRival and CartoonDan builds; see docs/research/original-material-physics.md.
export const ORIGINAL_FRAME_RATE = 18;
export const ORIGINAL_STAGE_HEIGHT = 400;
export const BASE_STRENGTH = 10;
export const STRENGTH_DRINK_BONUS = 2;
export const MIGHT_SPEED_MULTIPLIER = 1.35;
export const REEL_FIRST_FRAME = 44;
export const REEL_PLAY_FRAME = 286;
export const REEL_FINISH_FRAME = 293;
const REEL_TOTAL_FRAMES = 327;

// 249 measured axial increments, encoded as 31/32 twips; this is kinematic data, not artwork.
const REEL_STEP_BITS =
  '10110110110111010111011011011011011011101101101011' +
  '10110110110110110111011011011011011011011011011011' +
  '10110110110110110110110111010111011011011011011011' +
  '10101110110110110110110110110111011011011011011011' +
  '0110111010111011011011011011011101011101101101101';

export const REEL_POSITIONS_TWIPS: readonly number[] = (() => {
  const positions = [8137];
  for (const bit of REEL_STEP_BITS) positions.push(positions[positions.length - 1] - 31 - Number(bit));
  return Object.freeze(positions);
})();

const REEL_END_POSITION = 249 / 20;
const REEL_DISTANCE = (8137 - 249) / 20;
const MEAN_FRAME_DISTANCE = REEL_DISTANCE / (REEL_FINISH_FRAME - REEL_FIRST_FRAME);

export interface ReelMotion {
  cursor: number;
  playing: boolean;
  alive: boolean;
  localFast: boolean;
  elapsed: number;
  offset: number;
}

export const MATERIAL_WEIGHTS = {
  'gold-tiny': 3,
  'gold-small': 7,
  'gold-medium': 8,
  'gold-large': 9,
  'rock-small': 8,
  'rock-large': 9,
  'bone-small': 3,
  'bone-large': 2,
  diamond: 2,
  mole: 3,
  'mole-diamond': 5,
  tnt: 2,
} as const;

export function originalReelDistance(cursor: number): number {
  if (cursor >= REEL_FINISH_FRAME) return 0;
  if (cursor < REEL_FIRST_FRAME) {
    // Responsive widescreen ropes can exceed the original stage; continue at its body rate.
    return REEL_DISTANCE + (REEL_FIRST_FRAME - cursor) * MEAN_FRAME_DISTANCE;
  }
  return REEL_POSITIONS_TWIPS[cursor - REEL_FIRST_FRAME] / 20 - REEL_END_POSITION;
}

export function createReelMotion(distance: number, weight: number | null): ReelMotion {
  if (!Number.isFinite(distance) || distance < 0) throw new RangeError('Reel distance must be finite and nonnegative.');
  let cursor: number;
  if (distance >= REEL_DISTANCE) {
    cursor = Math.round(REEL_FIRST_FRAME - (distance - REEL_DISTANCE) / MEAN_FRAME_DISTANCE);
  } else {
    let lower = REEL_FIRST_FRAME;
    let upper = REEL_FINISH_FRAME;
    while (upper - lower > 1) {
      const middle = Math.floor((lower + upper) / 2);
      if (originalReelDistance(middle) > distance) lower = middle;
      else upper = middle;
    }
    cursor = Math.abs(originalReelDistance(lower) - distance) <= Math.abs(originalReelDistance(upper) - distance)
      ? lower : upper;
    if (distance > 0 && cursor === REEL_FINISH_FRAME) cursor--;
  }
  return {
    cursor,
    playing: weight === null || weight <= 1,
    alive: distance > 0,
    localFast: weight === null || weight === -1,
    elapsed: 0,
    offset: distance - originalReelDistance(cursor),
  };
}

export function stepOriginalReel(motion: ReelMotion, weight: number | null, drink: boolean, bagStrength: boolean): void {
  if (!motion.alive) return;
  if (weight !== null && (!Number.isInteger(weight) || weight < -5 || weight > 9)) {
    throw new RangeError('Original material weight must be an integer between -5 and 9.');
  }
  if (motion.playing) {
    motion.cursor++;
    if (motion.cursor >= REEL_FINISH_FRAME) {
      motion.alive = false;
      motion.playing = false;
      return;
    }
  }
  const fast = motion.localFast || bagStrength;
  const jump = fast ? 15 : BASE_STRENGTH + (drink ? STRENGTH_DRINK_BONUS : 0) - (weight ?? 0);
  motion.cursor = Math.min(REEL_TOTAL_FRAMES, motion.cursor + jump);
  motion.playing = fast || motion.cursor >= REEL_PLAY_FRAME;
  // A jump can land beyond 293: display-list removal and repeated settlement frames end it there.
  if (motion.cursor >= REEL_FINISH_FRAME) {
    motion.alive = false;
    motion.playing = false;
  }
}

export function interpolatedReelDistance(
  motion: ReelMotion,
  weight: number | null,
  drink: boolean,
  bagStrength: boolean,
): number {
  if (!motion.alive) return 0;
  const next = { ...motion };
  stepOriginalReel(next, weight, drink, bagStrength);
  const currentDistance = Math.max(0, originalReelDistance(motion.cursor) + motion.offset);
  const nextDistance = next.alive ? Math.max(0, originalReelDistance(next.cursor) + next.offset) : 0;
  const fraction = Math.min(1, Math.max(0, motion.elapsed * ORIGINAL_FRAME_RATE));
  // Preview the deterministic next step for drawing only; payouts still use the 18 Hz simulation.
  return currentDistance + (nextDistance - currentDistance) * fraction;
}

export function rollOriginalBagWeight(random: () => number): number {
  switch (randomInteger(4, random)) {
    case 0: return randomInteger(9, random) + 1;
    case 1: return -(randomInteger(5, random) + 1);
    case 2: return 9;
    default: return -1;
  }
}
