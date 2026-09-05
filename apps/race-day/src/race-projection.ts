import { cycleSummaryFor, gelFor, intervalFor, phaseProgressFor } from './plan';
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
