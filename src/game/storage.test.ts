import { describe, expect, it } from 'vitest';
import { defaultPreferences, parsePreferences } from './storage';

describe('local preferences validation', () => {
  it('defaults to Chinese and migrates old saves without losing records or sound preferences', () => {
    expect(defaultPreferences()).toEqual({ sound: true, language: 'zh-CN', records: { solo: 0, coop: 0 } });
    expect(parsePreferences('{"sound":false,"records":{"solo":750,"coop":1500}}')).toEqual({
      sound: false, language: 'zh-CN', records: { solo: 750, coop: 1500 },
    });
  });

  it.each(['zh-CN', 'en'] as const)('retains the saved %s language with both records', (language) => {
    const preferences = { language, sound: false, records: { solo: 750, coop: 1500 } };
    expect(parsePreferences(JSON.stringify(preferences))).toEqual(preferences);
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
