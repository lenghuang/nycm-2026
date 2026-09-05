import type { IntervalState, Phase, RaceState } from './types';

export const initialRace = (): RaceState => ({ phase: 0, anchor: Date.now(), pausedAt: null, pausedTotal: 0, gelFired: 0, begun: false });
export const elapsed = (race: RaceState, currentTime: number): number => Math.max(0, (race.pausedAt ?? currentTime) - race.anchor - race.pausedTotal);

export function intervalFor(plan: Phase[], race: RaceState, currentTime: number): IntervalState {
  const phase = plan[race.phase] ?? plan[0];
  const runMs = Math.max(1_000, phase.runDurationMs);
  const walkMs = Math.max(1_000, phase.walkDurationMs);
  const cycle = runMs + walkMs;
  const elapsedMs = elapsed(race, currentTime);
  const inCycle = elapsedMs % cycle;
  const running = phase.startsWith === 'WALK' ? inCycle >= walkMs : inCycle < runMs;
  const endOfMode = running ? cycle : (phase.startsWith === 'WALK' ? walkMs : cycle);
  return { mode: running ? 'RUN' : 'WALK', left: Math.ceil((endOfMode - inCycle) / 1000), key: `${Math.floor(elapsedMs / cycle)}-${running ? 'run' : 'walk'}` };
}

export function gelFor(plan: Phase[], race: RaceState, currentTime: number): { number: number; left: number } {
  const every = Math.max(1_000, (plan[race.phase] ?? plan[0]).gelIntervalMs);
  const elapsedMs = elapsed(race, currentTime);
  return { number: Math.floor(elapsedMs / every), left: Math.ceil((every - (elapsedMs % every)) / 1000) };
}

export function cycleSummaryFor(plan: Phase[], race: RaceState, currentTime: number): { done: number; left: number } {
  const phase = plan[race.phase] ?? plan[0];
  const cycleMs = Math.max(1_000, phase.runDurationMs) + Math.max(1_000, phase.walkDurationMs);
  const done = Math.min(phase.plannedCycles, Math.floor(elapsed(race, currentTime) / cycleMs));
  return { done, left: Math.max(0, phase.plannedCycles - done) };
}

export function cueJumpOffset(plan: Phase[], race: RaceState, currentTime: number, direction: -1 | 1): number {
  const phase = plan[race.phase] ?? plan[0];
  const runMs = Math.max(1_000, phase.runDurationMs);
  const walkMs = Math.max(1_000, phase.walkDurationMs);
  const cycle = runMs + walkMs;
  const inCycle = elapsed(race, currentTime) % cycle;
  const startsWithWalk = phase.startsWith === 'WALK';
  const running = startsWithWalk ? inCycle >= walkMs : inCycle < runMs;
  const modeStart = running ? (startsWithWalk ? walkMs : 0) : (startsWithWalk ? 0 : runMs);
  const modeEnd = running ? cycle : (startsWithWalk ? walkMs : cycle);
  if (direction === 1) return modeEnd - inCycle || (running ? walkMs : runMs);
  if (inCycle > modeStart) return -(inCycle - modeStart);
  return -(modeStart === 0 ? (running ? walkMs : runMs) : modeStart);
}

export const formatTime = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
