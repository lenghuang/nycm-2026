import { useEffect } from 'react';
import { gelFor, intervalFor } from './plan';
import type { MutableRefObject } from 'react';
import type { Phase, RaceSession } from './types';
import type { RaceSessionAction } from './race-session';
import { RACE_CLOCK_TICK_MS } from './race-constants';

type Options = {
  planRef: MutableRefObject<Phase[]>;
  sessionRef: MutableRefObject<RaceSession>;
  dispatch: (action: RaceSessionAction) => void;
  onInterval: (mode: 'RUN' | 'WALK') => void;
  onGel: () => void;
};

/** Owns the foreground timer/cue loop; the reducer remains the state authority. */
export function useRaceCues({ planRef, sessionRef, dispatch, onInterval, onGel }: Options): void {
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const session = sessionRef.current;
      if (!session.begun || session.pausedAt) return;
      const interval = intervalFor(planRef.current, session, now);
      const gel = gelFor(planRef.current, session, now);
      if (!session.lastInterval) dispatch({ type: 'MARK_INTERVAL', key: interval.key });
      else if (session.lastInterval !== interval.key) { onInterval(interval.mode); dispatch({ type: 'MARK_INTERVAL', key: interval.key }); }
      if (gel.number > session.lastDeliveredGelNumber) { onGel(); dispatch({ type: 'MARK_GEL_DELIVERED', number: gel.number }); }
    };
    const onVisible = () => { if (!document.hidden) tick(); };
    const id = window.setInterval(tick, RACE_CLOCK_TICK_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [dispatch, onGel, onInterval, planRef, sessionRef]);
}
