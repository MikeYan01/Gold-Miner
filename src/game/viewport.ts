import { HEIGHT, ORIGIN_Y, SURFACE, WIDTH } from './levels';
import type { Point } from './types';

export interface Viewport {
  readonly stretchX: number;
  readonly stretchY: number;
  readonly originY: number;
}

export const DEFAULT_VIEWPORT: Viewport = { stretchX: 1, stretchY: 1, originY: ORIGIN_Y };

// Positions fill the viewport; sprites and their hit areas keep a uniform scale.
export function createViewport(width: number, height: number): Viewport {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new RangeError('Viewport dimensions must be finite and positive.');
  }
  const scaleX = width / WIDTH;
  const scaleY = height / HEIGHT;
  const spriteScale = Math.min(scaleX, scaleY);
  const stretchX = scaleX / spriteScale;
  const stretchY = scaleY / spriteScale;
  return {
    stretchX,
    stretchY,
    originY: SURFACE - (SURFACE - ORIGIN_Y) / stretchY,
  };
}

export function projectPoint(point: Point, viewport: Viewport): Point {
  return { x: point.x * viewport.stretchX, y: point.y * viewport.stretchY };
}
