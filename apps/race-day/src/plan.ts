import type { IntervalState, Phase, RaceSession, RaceState } from './types';

type TimingSession = RaceSession | RaceState;

export const initialRace = (): RaceState => ({ phase: 0, anchor: Date.now(), pausedAt: null, pausedTotal: 0, gelAnchor: 0, gelFired: 0, begun: false });
export const elapsed = (race: TimingSession, currentTime: number): number => Math.max(0, (race.pausedAt ?? currentTime) - race.anchor - race.pausedTotal);

export function intervalFor(plan: Phase[], race: TimingSession, currentTime: number): IntervalState {
  const phase = plan[race.phase] ?? plan[0];
  const runMs = Math.max(1_000, phase.runDurationMs);
  const walkMs = Math.max(1_000, phase.walkDurationMs);
  const cycle = runMs + walkMs;
  const elapsedMs = elapsed(race, currentTime);
  const inCycle = elapsedMs % cycle;
  const startsWithWalk = phase.startsWith === 'WALK';
  const running = startsWithWalk ? inCycle >= walkMs : inCycle < runMs;
  const modeStart = startsWithWalk ? (running ? walkMs : 0) : (running ? 0 : runMs);
  const endOfMode = startsWithWalk ? (running ? cycle : walkMs) : (running ? runMs : cycle);
  return {
    mode: running ? 'RUN' : 'WALK',
    left: Math.ceil((endOfMode - inCycle) / 1000),
    key: `${Math.floor(elapsedMs / cycle)}-${running ? 'run' : 'walk'}`,
    progress: Math.min(1, Math.max(0, (inCycle - modeStart) / (endOfMode - modeStart))),
  };
}

export function gelFor(plan: Phase[], race: TimingSession, currentTime: number): { number: number; left: number } {
  const every = Math.max(1_000, (plan[race.phase] ?? plan[0]).gelIntervalMs);
  const gelAnchor = 'gelScheduleAnchorElapsedMs' in race ? race.gelScheduleAnchorElapsedMs : race.gelAnchor;
  const elapsedSinceGel = Math.max(0, elapsed(race, currentTime) - gelAnchor);
  return { number: Math.floor(elapsedSinceGel / every), left: Math.ceil((every - (elapsedSinceGel % every)) / 1000) };
}

export function cycleSummaryFor(plan: Phase[], race: TimingSession, currentTime: number): { done: number; left: number } {
  const phase = plan[race.phase] ?? plan[0];
  const cycleMs = Math.max(1_000, phase.runDurationMs) + Math.max(1_000, phase.walkDurationMs);
  const done = Math.min(phase.plannedCycles, Math.floor(elapsed(race, currentTime) / cycleMs));
  return { done, left: Math.max(0, phase.plannedCycles - done) };
}

export function phaseProgressFor(plan: Phase[], race: TimingSession, currentTime: number): number {
  const phase = plan[race.phase] ?? plan[0];
  const cycleMs = Math.max(1_000, phase.runDurationMs) + Math.max(1_000, phase.walkDurationMs);
  return Math.min(1, elapsed(race, currentTime) / (cycleMs * Math.max(1, phase.plannedCycles)));
}

export function cueJumpOffset(plan: Phase[], race: TimingSession, currentTime: number, direction: -1 | 1): number {
  const phase = plan[race.phase] ?? plan[0];
  const runMs = Math.max(1_000, phase.runDurationMs);
  const walkMs = Math.max(1_000, phase.walkDurationMs);
  const cycle = runMs + walkMs;
  const inCycle = elapsed(race, currentTime) % cycle;
  const startsWithWalk = phase.startsWith === 'WALK';
  const running = startsWithWalk ? inCycle >= walkMs : inCycle < runMs;
  const modeStart = startsWithWalk ? (running ? walkMs : 0) : (running ? 0 : runMs);
  const modeEnd = startsWithWalk ? (running ? cycle : walkMs) : (running ? runMs : cycle);
  if (direction === 1) return modeEnd - inCycle || (running ? walkMs : runMs);
  if (inCycle > modeStart) return -(inCycle - modeStart);
  return -(modeStart === 0 ? (running ? walkMs : runMs) : modeStart);
}

export const formatTime = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
