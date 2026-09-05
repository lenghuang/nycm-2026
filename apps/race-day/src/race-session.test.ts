import { describe, expect, it } from 'vitest';
import { futureCueEvents, projectRace } from './race-projection';
import { initialRaceSession, raceSessionReducer } from './race-session';
import type { RacePlan } from './types';

const plan: RacePlan = {
  presetId: 'test',
  phases: [
    {
      name: 'Test phase',
      miles: '0–1',
      note: '',
      runDurationMs: 60_000,
      walkDurationMs: 30_000,
      gelIntervalMs: 120_000,
      plannedCycles: 2,
      startsWith: 'RUN',
      effort: 'TEST',
      music: 'NONE',
      musicTrackId: 'race-day',
    },
  ],
};

describe('race session reducer', () => {
  it('keeps an added cycle in the session without mutating the plan', () => {
    const session = raceSessionReducer(initialRaceSession(0), { type: 'ADD_CYCLE' }, plan.phases);

    expect(plan.phases[0].plannedCycles).toBe(2);
    expect(session.addedCyclesByPhase).toEqual({ 0: 1 });
    expect(projectRace(plan, session, 0).effectivePlannedCycles).toBe(3);
  });

  it('has one shared sequence of future interval and gel cues', () => {
    const session = raceSessionReducer(initialRaceSession(0), { type: 'START', now: 0 }, plan.phases);

    expect(futureCueEvents(plan, session, 0).slice(0, 3)).toEqual([
      { type: 'interval', atPhaseElapsed: 60_000, mode: 'WALK' },
      { type: 'interval', atPhaseElapsed: 90_000, mode: 'RUN' },
      { type: 'gel', atPhaseElapsed: 120_000 },
    ]);
  });
});
