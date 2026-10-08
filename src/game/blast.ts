import type { Entity, Point } from './types';
import type { Viewport } from './viewport';

export const TNT_BLAST_RADIUS = 250;
const UNIT_SCALE = { stretchX: 1, stretchY: 1 };

export function inTntBlast(
  source: Point,
  target: Pick<Entity, 'x' | 'y' | 'radius'>,
  viewport: Pick<Viewport, 'stretchX' | 'stretchY'> = UNIT_SCALE,
  blastRadius = TNT_BLAST_RADIUS,
): boolean {
  const dx = (target.x - source.x) * viewport.stretchX;
  const dy = (target.y - source.y) * viewport.stretchY;
  const radius = blastRadius + target.radius;
  return dx * dx + dy * dy <= radius * radius;
}
