import { describe, expect, it } from 'vitest';
import { elapsed, intervalBoundaryDelta, intervalFor } from './plan';
import type { Phase, RaceSession } from './types';

const runFirstPhase: Phase = {
  name: 'Controlled',
  miles: '0–5',
  note: 'Easy does it.',
  runDurationMs: 60_000,
  walkDurationMs: 30_000,
  gelIntervalMs: 20 * 60_000,
  plannedCycles: 10,
  startsWith: 'RUN',
  effort: 'CONTROLLED',
  music: 'NONE',
  musicTrackId: 'race-day',
};

const race = (overrides: Partial<RaceSession> = {}): RaceSession => ({
  phase: 0,
  anchor: 0,
  pausedAt: null,
  pausedTotal: 0,
  gelScheduleAnchorElapsedMs: 0,
  lastDeliveredGelNumber: 0,
  begun: true,
  addedCyclesByPhase: {},
  ...overrides,
});

describe('run/walk interval timing', () => {
  it('changes a run-first phase from RUN to WALK at the run boundary', () => {
    expect(intervalFor([runFirstPhase], race(), 59_000)).toMatchObject({ mode: 'RUN', left: 1 });
    expect(intervalFor([runFirstPhase], race(), 60_000)).toMatchObject({ mode: 'WALK', left: 30 });
  });

  it('moves Next interval from RUN directly to WALK, not to the next run cycle', () => {
    const now = 15_000;
    const offset = intervalBoundaryDelta([runFirstPhase], race(), now, 1);
    const advancedRace = race({ anchor: -offset });

    expect(offset).toBe(45_000);
    expect(intervalFor([runFirstPhase], advancedRace, now)).toMatchObject({ mode: 'WALK', left: 30 });
  });

  it('handles a walk-first phase in the opposite order', () => {
    const walkFirstPhase = { ...runFirstPhase, startsWith: 'WALK' as const };

    expect(intervalFor([walkFirstPhase], race(), 0)).toMatchObject({ mode: 'WALK', left: 30 });
    expect(intervalFor([walkFirstPhase], race(), 30_000)).toMatchObject({ mode: 'RUN', left: 60 });
  });

  it('does not advance elapsed time while paused', () => {
    const pausedRace = race({ pausedAt: 20_000 });

    expect(elapsed(pausedRace, 80_000)).toBe(20_000);
    expect(intervalFor([runFirstPhase], pausedRace, 80_000)).toMatchObject({ mode: 'RUN', left: 40 });
  });
});
