import type { Mode } from './types';

const KEY = 'gold-miner.preferences.v1';

export interface Preferences {
  sound: boolean;
  records: Record<Mode, number>;
}

export const defaultPreferences = (): Preferences => ({ sound: true, records: { solo: 0, coop: 0 } });

function isScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function parsePreferences(raw: string): Preferences {
  const value: unknown = JSON.parse(raw);
  if (
    typeof value !== 'object' || value === null ||
    !('sound' in value) || typeof value.sound !== 'boolean' ||
    !('records' in value) || typeof value.records !== 'object' || value.records === null ||
    !('solo' in value.records) || !isScore(value.records.solo) ||
    !('coop' in value.records) || !isScore(value.records.coop)
  ) throw new Error('Invalid saved preferences.');
  return { sound: value.sound, records: { solo: value.records.solo, coop: value.records.coop } };
}

export function loadPreferences(): { preferences: Preferences; warning: string | null } {
  try {
    const raw = localStorage.getItem(KEY);
    return { preferences: raw ? parsePreferences(raw) : defaultPreferences(), warning: null };
  } catch (error) {
    console.warn('[Gold Miner] Saved preferences could not be read.', error);
    return { preferences: defaultPreferences(), warning: '本地记录无法读取，本次游戏仍可正常进行。' };
  }
}

export function savePreferences(preferences: Preferences): string | null {
  try {
    localStorage.setItem(KEY, JSON.stringify(preferences));
    return null;
  } catch (error) {
    console.warn('[Gold Miner] Preferences could not be saved.', error);
    return '浏览器未允许本地存档，本次最高记录将不会保存。';
  }
}
