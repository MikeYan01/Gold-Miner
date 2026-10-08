import { describe, expect, it } from 'vitest';
import { defaultPreferences, parsePreferences } from './storage';

describe('local preferences validation', () => {
  it('defaults to Chinese and migrates old saves without losing records or sound preferences', () => {
    expect(defaultPreferences()).toEqual({ sound: true, music: true, language: 'zh-CN', records: { solo: 0, coop: 0 } });
    expect(parsePreferences('{"sound":false,"records":{"solo":750,"coop":1500}}')).toEqual({
      sound: false, music: false, language: 'zh-CN', records: { solo: 750, coop: 1500 },
    });
  });

  it.each(['zh-CN', 'en'] as const)('retains the saved %s language with both records', (language) => {
    const preferences = { language, sound: false, music: true, records: { solo: 750, coop: 1500 } };
    expect(parsePreferences(JSON.stringify(preferences))).toEqual(preferences);
  });

  it.each([true, false])('migrates a legacy sound=%s preference to the same music setting', (sound) => {
    expect(parsePreferences(JSON.stringify({ sound, records: { solo: 750, coop: 1500 } }))).toEqual({
      sound, music: sound, language: 'zh-CN', records: { solo: 750, coop: 1500 },
    });
  });

  it.each([[true, true], [true, false], [false, true], [false, false]])('retains independent sound=%s and music=%s settings', (sound, music) => {
    const preferences = { sound, music, language: 'en', records: { solo: 750, coop: 1500 } };
    expect(parsePreferences(JSON.stringify(preferences))).toEqual(preferences);
  });

  it.each(['true', null, 0, {}, []])('rejects an invalid saved music setting: %j', (music) => {
    expect(() => parsePreferences(JSON.stringify({ sound: true, music, records: { solo: 0, coop: 0 } }))).toThrow('Invalid saved music preference.');
  });

  it.each(['fr', 'zh', '', null, 1, {}, []])('rejects an unsupported saved language: %j', (language) => {
    expect(() => parsePreferences(JSON.stringify({ sound: true, language, records: { solo: 0, coop: 0 } }))).toThrow('Invalid saved language.');
  });

  it.each([
    'null', '[]', '{}', 'not json',
    '{"sound":"true","records":{"solo":0,"coop":0}}',
    '{"sound":true,"records":{"solo":-5,"coop":0}}',
    '{"sound":true,"records":{"solo":1.5,"coop":0}}',
    '{"sound":true,"records":{"solo":1e400,"coop":0}}',
    '{"sound":true,"records":{"solo":9007199254740992,"coop":0}}',
    '{"sound":true,"records":{"solo":0}}',
    '{"sound":true,"records":null}',
  ])('rejects corrupt or unsafe saved data: %s', (raw) => {
    expect(() => parsePreferences(raw)).toThrow();
  });
});
