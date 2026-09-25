export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function randomInteger(count: number, random: () => number): number {
  if (!Number.isSafeInteger(count) || count <= 0) throw new RangeError('Random integer range must be a positive safe integer.');
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('Random values must be in [0, 1).');
  return Math.floor(value * count);
}

export function shuffled<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInteger(i + 1, random);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
