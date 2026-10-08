import { describe, expect, it } from 'vitest';
import { HEIGHT, ORIGIN_Y, SURFACE, WIDTH } from './levels';
import { createViewport, DEFAULT_VIEWPORT, projectPoint } from './viewport';

describe('full-stage viewport geometry', () => {
  it('leaves the authored aspect ratio unchanged', () => {
    expect(createViewport(WIDTH, HEIGHT)).toEqual(DEFAULT_VIEWPORT);
  });

  it.each([
    [1920, 992], [3440, 1352], [390, 776], [844, 314],
  ])('preserves sprite proportions and the surface anchor at %d by %d', (width, height) => {
    const viewport = createViewport(width, height);
    const scaleX = width / WIDTH / viewport.stretchX;
    const scaleY = height / HEIGHT / viewport.stretchY;
    expect(scaleX).toBeCloseTo(scaleY);
    expect((SURFACE - viewport.originY) * viewport.stretchY).toBeCloseTo(SURFACE - ORIGIN_Y);
    expect(projectPoint({ x: 25, y: 40 }, viewport)).toEqual({
      x: 25 * viewport.stretchX, y: 40 * viewport.stretchY,
    });
  });

  it.each([[0, 720], [1200, 0], [-1, 720], [Infinity, 720], [1200, NaN]])('rejects invalid viewport dimensions %s by %s', (width, height) => {
    expect(() => createViewport(width, height)).toThrow(RangeError);
  });
});
