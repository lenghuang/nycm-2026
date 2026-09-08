import { describe, expect, it } from 'vitest';
import { cueForPhase, shouldShowMusic } from './phase-audio';
import type { Phase } from './types';

const phase: Phase = {
  name: 'Audio',
  miles: '0–1',
  note: '',
  runDurationMs: 60_000,
  walkDurationMs: 30_000,
  gelIntervalMs: 120_000,
  plannedCycles: 2,
  startsWith: 'RUN',
  effort: 'TEST',
  music: 'START_TRACK',
  musicTrackId: 'race-day',
  cueOverrides: { walk: { soundId: 'gel-chime', volume: 'loud' } },
};

describe('phase audio projection', () => {
  it('uses a phase override only for the configured cue', () => {
    const sounds = { run: 'run-pulse', walk: 'walk-tap', gel: 'gel-chime' };
    const volumes = { run: 'normal' as const, walk: 'quiet' as const, gel: 'normal' as const };
    expect(cueForPhase(phase, 'walk', sounds, volumes)).toEqual({ soundId: 'gel-chime', volume: 'loud' });
    expect(cueForPhase(phase, 'run', sounds, volumes)).toEqual({ soundId: 'run-pulse', volume: 'normal' });
  });

  it('only exposes player controls for policies with an active track', () => {
    expect(shouldShowMusic('START_TRACK')).toBe(true);
    expect(shouldShowMusic('CONTINUE_TRACK')).toBe(true);
    expect(shouldShowMusic('SILENT')).toBe(false);
    expect(shouldShowMusic('STOP_TRACK')).toBe(false);
  });
});
