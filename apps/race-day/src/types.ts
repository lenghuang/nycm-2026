export type IntervalMode = 'RUN' | 'WALK';
export type EffortLevel = 'RECOVERY' | 'CONTROLLED' | 'SURGE' | 'FINISH' | 'TEST';
export type MusicCue = 'NONE' | 'START';

export type Phase = {
  name: string;
  miles: string;
  note: string;
  runDurationMs: number;
  walkDurationMs: number;
  gelIntervalMs: number;
  plannedCycles: number;
  startsWith: IntervalMode;
  effort: EffortLevel;
  music: MusicCue;
};

export type RacePlanPreset = { id: string; label: string; description: string; isTest: boolean; phases: Phase[] };
export type ActivePlan = { presetId: string; phases: Phase[] };

export type RaceState = {
  phase: number;
  anchor: number;
  pausedAt: number | null;
  pausedTotal: number;
  gelFired: number;
  begun: boolean;
  lastInterval?: string;
};

export type IntervalState = { mode: IntervalMode; left: number; key: string };
