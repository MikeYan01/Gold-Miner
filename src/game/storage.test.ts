import { describe, expect, it } from 'vitest';
import { defaultPreferences, parsePreferences } from './storage';

describe('local preferences validation', () => {
  it('uses separate records for each mode and enables audio by default', () => {
    expect(defaultPreferences()).toEqual({ sound: true, records: { solo: 0, coop: 0 } });
    expect(parsePreferences('{"sound":false,"records":{"solo":750,"coop":1500}}')).toEqual({
      sound: false, records: { solo: 750, coop: 1500 },
    });
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
