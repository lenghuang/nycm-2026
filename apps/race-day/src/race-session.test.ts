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
      music: 'SILENT',
      musicTrackId: 'race-day',
    },
  ],
};

describe('race session reducer', () => {
  it('preserves elapsed time across pause and resume', () => {
    const started = raceSessionReducer(initialRaceSession(0), { type: 'START', now: 0 }, plan.phases);
    const paused = raceSessionReducer(started, { type: 'PAUSE', now: 30_000 }, plan.phases);
    const resumed = raceSessionReducer(paused, { type: 'RESUME', now: 90_000 }, plan.phases);

    expect(resumed.pausedAt).toBeNull();
    expect(resumed.pausedTotal).toBe(60_000);
  });

  it('resets the phase clock and gel schedule when changing phase', () => {
    const session = { ...initialRaceSession(0), begun: true, gelScheduleAnchorElapsedMs: 20_000 };
    const planWithSecondPhase = { ...plan, phases: [...plan.phases, { ...plan.phases[0], name: 'Second phase' }] };
    const changed = raceSessionReducer(
      session,
      { type: 'CHANGE_PHASE', phase: 1, now: 40_000 },
      planWithSecondPhase.phases,
    );

    expect(changed).toMatchObject({
      phase: 1,
      anchor: 40_000,
      gelScheduleAnchorElapsedMs: 0,
      lastDeliveredGelNumber: 0,
    });
  });

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

  it('finishes from the final phase and clears all live timing state when replacing a configuration', () => {
    const finished = raceSessionReducer(
      { ...initialRaceSession(0), begun: true, phase: 0 },
      { type: 'FINISH', now: 42_000 },
      plan.phases,
    );
    expect(finished).toMatchObject({ finishedAt: 42_000, pausedAt: 42_000 });
    const replaced = raceSessionReducer(finished, { type: 'REPLACE_PLAN', phaseCount: 1, now: 50_000 }, plan.phases);
    expect(replaced).toMatchObject({
      phase: 0,
      begun: false,
      finishedAt: null,
      pausedAt: null,
      addedCyclesByPhase: {},
    });
  });
});
