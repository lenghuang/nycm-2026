import { cycleSummaryFor, elapsed, gelFor, intervalFor, phaseProgressFor } from './plan';
import type { Phase, RacePlan, RaceSession } from './types';

export type RaceProjection = {
  phase: Phase;
  effectivePlannedCycles: number;
  interval: ReturnType<typeof intervalFor>;
  gel: ReturnType<typeof gelFor>;
  cycles: ReturnType<typeof cycleSummaryFor>;
  phaseProgress: number;
};

export function projectRace(plan: RacePlan, session: RaceSession, now: number): RaceProjection {
  const phase = plan.phases[session.phase] ?? plan.phases[0];
  const effectivePlannedCycles = Math.max(1, phase.plannedCycles + (session.addedCyclesByPhase[session.phase] ?? 0));
  const projectedPlan = phase === plan.phases[session.phase] ? { ...plan, phases: plan.phases.map((item, index) => index === session.phase ? { ...item, plannedCycles: effectivePlannedCycles } : item) } : plan;
  return {
    phase,
    effectivePlannedCycles,
    interval: intervalFor(projectedPlan.phases, session, now),
    gel: gelFor(projectedPlan.phases, session, now),
    cycles: cycleSummaryFor(projectedPlan.phases, session, now),
    phaseProgress: phaseProgressFor(projectedPlan.phases, session, now),
  };
}

export type FutureCueEvent = { type: 'interval' | 'gel'; atPhaseElapsed: number; mode?: 'RUN' | 'WALK' };

/** Every future active-phase cue, calculated from the same timing model as the UI. */
export function futureCueEvents(plan: RacePlan, session: RaceSession, now: number): FutureCueEvent[] {
  const projection = projectRace(plan, session, now);
  const phase = projection.phase;
  const runMs = Math.max(1_000, phase.runDurationMs);
  const walkMs = Math.max(1_000, phase.walkDurationMs);
  const cycleMs = runMs + walkMs;
  const phaseElapsed = elapsed(session, now);
  const phaseEndsAt = projection.effectivePlannedCycles * cycleMs;
  const events: FutureCueEvent[] = [];
  const startsWithWalk = phase.startsWith === 'WALK';
  let boundary = Math.floor(phaseElapsed / cycleMs) * cycleMs + (startsWithWalk ? walkMs : runMs);
  if (boundary <= phaseElapsed) boundary += cycleMs;
  while (boundary <= phaseEndsAt) {
    const inCycle = boundary % cycleMs;
    const mode = startsWithWalk ? (inCycle >= walkMs ? 'RUN' : 'WALK') : (inCycle < runMs ? 'RUN' : 'WALK');
    events.push({ type: 'interval', atPhaseElapsed: boundary, mode });
    boundary += mode === 'RUN' ? runMs : walkMs;
  }
  const gelEveryMs = Math.max(1_000, phase.gelIntervalMs);
  let gelAt = session.gelScheduleAnchorElapsedMs + (Math.floor(Math.max(0, phaseElapsed - session.gelScheduleAnchorElapsedMs) / gelEveryMs) + 1) * gelEveryMs;
  while (gelAt <= phaseEndsAt) {
    events.push({ type: 'gel', atPhaseElapsed: gelAt });
    gelAt += gelEveryMs;
  }
  return events.filter(event => event.atPhaseElapsed > phaseElapsed).sort((left, right) => left.atPhaseElapsed - right.atPhaseElapsed);
}
