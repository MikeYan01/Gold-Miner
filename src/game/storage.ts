import type { Mode } from './types';
import { bilingual, DEFAULT_LANGUAGE } from './i18n';
import type { Language, LocalizedText } from './i18n';

const KEY = 'gold-miner.preferences.v1';

export interface Preferences {
  sound: boolean;
  language: Language;
  records: Record<Mode, number>;
}

export const defaultPreferences = (): Preferences => ({ sound: true, language: DEFAULT_LANGUAGE, records: { solo: 0, coop: 0 } });

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
  const language = 'language' in value ? value.language : DEFAULT_LANGUAGE;
  if (language !== 'zh-CN' && language !== 'en') throw new Error('Invalid saved language.');
  return { sound: value.sound, language, records: { solo: value.records.solo, coop: value.records.coop } };
}

export function loadPreferences(): { preferences: Preferences; warning: LocalizedText | null } {
  try {
    const raw = localStorage.getItem(KEY);
    return { preferences: raw ? parsePreferences(raw) : defaultPreferences(), warning: null };
  } catch (error) {
    console.warn('[Gold Miner] Saved preferences could not be read.', error);
    return {
      preferences: defaultPreferences(),
      warning: bilingual('本地记录无法读取，本次游戏仍可正常进行。', 'Saved preferences could not be read. You can still play.'),
    };
  }
}

export function savePreferences(preferences: Preferences): LocalizedText | null {
  try {
    localStorage.setItem(KEY, JSON.stringify(preferences));
    return null;
  } catch (error) {
    console.warn('[Gold Miner] Preferences could not be saved.', error);
    return bilingual('浏览器未允许本地存档，本次语言设置和最高记录将不会保存。', 'Local saving is unavailable. Language preferences and high scores will not be saved.');
  }
}
