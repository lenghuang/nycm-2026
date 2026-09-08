import { describe, expect, it } from 'vitest';
import { futurePhaseNotifications } from './native-notifications';
import { initialRaceSession } from './race-session';
import type { RacePlan } from './types';

const plan: RacePlan = {
  presetId: 'test',
  phases: [
    {
      name: 'Test',
      miles: '0–1',
      note: '',
      runDurationMs: 60_000,
      walkDurationMs: 30_000,
      gelIntervalMs: 60_000,
      plannedCycles: 2,
      startsWith: 'RUN',
      effort: 'TEST',
      music: 'SILENT',
      musicTrackId: 'race-day',
      cueOverrides: { walk: { soundId: 'gel-chime', volume: 'loud' } },
    },
  ],
};
const sounds = { run: 'run-pulse', walk: 'walk-tap', gel: 'gel-chime' };
const volumes = { run: 'normal' as const, walk: 'quiet' as const, gel: 'normal' as const };

describe('native race notification schemas', () => {
  it('produces concrete, ordered local-notification schemas and combines coincident cues', () => {
    const race = { ...initialRaceSession(0), begun: true };
    const notifications = futurePhaseNotifications(plan, race, sounds, volumes, 0);
    expect(notifications).toHaveLength(5);
    expect(notifications[0]).toMatchObject({
      id: 10_000,
      title: 'WALK now · Gel time',
      sound: 'gel-chime.wav',
      extra: { raceDay: true, types: ['interval', 'gel'] },
    });
    expect(notifications[0].schedule?.at).toEqual(new Date(60_000));
    expect(notifications[1]).toMatchObject({ id: 10_001, title: 'RUN now', sound: 'run-pulse.wav' });
  });
});
