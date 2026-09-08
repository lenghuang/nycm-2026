import { elapsed, intervalBoundaryDelta, intervalFor } from './plan';
import type { Phase, RaceSession } from './types';

export type RaceSessionAction =
  | { type: 'START'; now: number }
  | { type: 'PAUSE'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'CHANGE_PHASE'; phase: number; now: number }
  | { type: 'JUMP_INTERVAL'; direction: -1 | 1; now: number }
  | { type: 'LOG_GEL'; now: number }
  | { type: 'ADD_CYCLE' }
  | { type: 'MARK_INTERVAL'; key: string }
  | { type: 'MARK_GEL_DELIVERED'; number: number }
  | { type: 'FINISH'; now: number }
  | { type: 'REPLACE_PLAN'; phaseCount: number; now: number; begun?: boolean };

export const initialRaceSession = (now = Date.now()): RaceSession => ({
  phase: 0,
  anchor: now,
  pausedAt: null,
  pausedTotal: 0,
  gelScheduleAnchorElapsedMs: 0,
  lastDeliveredGelNumber: 0,
  begun: false,
  finishedAt: null,
  addedCyclesByPhase: {},
});

export function raceSessionReducer(session: RaceSession, action: RaceSessionAction, phases: Phase[]): RaceSession {
  switch (action.type) {
    case 'START':
      return resetSession(session, session.phase, action.now, true, phases);
    case 'PAUSE':
      return session.begun && !session.pausedAt ? { ...session, pausedAt: action.now } : session;
    case 'RESUME':
      return session.pausedAt
        ? { ...session, pausedAt: null, pausedTotal: session.pausedTotal + action.now - session.pausedAt }
        : session;
    case 'FINISH':
      return session.begun && !session.finishedAt
        ? { ...session, pausedAt: action.now, finishedAt: action.now }
        : session;
    case 'CHANGE_PHASE':
      return action.phase === session.phase
        ? session
        : resetSession(session, clampPhase(action.phase, phases), action.now, session.begun, phases);
    case 'JUMP_INTERVAL': {
      const offset = Math.max(
        -elapsed(session, action.now),
        intervalBoundaryDelta(phases, session, action.now, action.direction),
      );
      const next = { ...session, anchor: session.anchor - offset, lastInterval: undefined };
      return { ...next, lastInterval: intervalFor(phases, next, action.now).key };
    }
    case 'LOG_GEL':
      return !session.begun || session.pausedAt
        ? session
        : { ...session, gelScheduleAnchorElapsedMs: elapsed(session, action.now), lastDeliveredGelNumber: 0 };
    case 'ADD_CYCLE':
      return {
        ...session,
        addedCyclesByPhase: {
          ...session.addedCyclesByPhase,
          [session.phase]: (session.addedCyclesByPhase[session.phase] ?? 0) + 1,
        },
      };
    case 'MARK_INTERVAL':
      return session.lastInterval === action.key ? session : { ...session, lastInterval: action.key };
    case 'MARK_GEL_DELIVERED':
      return action.number <= session.lastDeliveredGelNumber
        ? session
        : { ...session, lastDeliveredGelNumber: action.number };
    case 'REPLACE_PLAN':
      return resetSession(session, 0, action.now, action.begun ?? false, phases);
  }
}

function resetSession(session: RaceSession, phase: number, now: number, begun: boolean, phases: Phase[]): RaceSession {
  const next: RaceSession = {
    ...session,
    phase,
    anchor: now,
    pausedAt: null,
    pausedTotal: 0,
    gelScheduleAnchorElapsedMs: 0,
    lastDeliveredGelNumber: 0,
    begun,
    finishedAt: null,
    lastInterval: undefined,
    addedCyclesByPhase: {},
  };
  return { ...next, lastInterval: phases.length ? intervalFor(phases, next, now).key : undefined };
}

const clampPhase = (phase: number, phases: Pick<Phase[], 'length'>): number =>
  Math.max(0, Math.min(Math.max(0, phases.length - 1), phase));
