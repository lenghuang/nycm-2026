export type IntervalMode = 'RUN' | 'WALK';
export type EffortLevel = 'RECOVERY' | 'CONTROLLED' | 'SURGE' | 'FINISH' | 'TEST';
export type MusicCue = 'NONE' | 'START';
export type NotificationSoundSettings = { run: string; walk: string; gel: string };
export type NotificationSoundVolume = 'quiet' | 'normal' | 'loud';
export type NotificationSoundVolumes = { run: NotificationSoundVolume; walk: NotificationSoundVolume; gel: NotificationSoundVolume };
export type ViewMode = 'simple' | 'full';

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
  musicTrackId: string;
};

export type RacePlanPreset = { id: string; label: string; description: string; isTest: boolean; phases: Omit<Phase, 'musicTrackId'>[] };
/** The reusable strategy. It never changes when a runner extends a live phase. */
export type RacePlan = {
  presetId: string;
  phases: Phase[];
};

/** Personal device choices, independent of a given race strategy. */
export type RunnerPreferences = {
  notificationSounds: NotificationSoundSettings;
  notificationSoundVolumes: NotificationSoundVolumes;
  musicVolume: number;
  viewMode: ViewMode;
};

export type RaceConfiguration = { plan: RacePlan; preferences: RunnerPreferences };
/** Mutable settings-form data; never used as a live race model. */
export type RaceSettingsDraft = RacePlan & Omit<RunnerPreferences, 'viewMode'>;

/** The mutable record of one execution of a race plan. */
export type RaceSession = {
  phase: number;
  anchor: number;
  pausedAt: number | null;
  pausedTotal: number;
  gelScheduleAnchorElapsedMs: number;
  lastDeliveredGelNumber: number;
  begun: boolean;
  lastInterval?: string;
  addedCyclesByPhase: Record<number, number>;
};

export type IntervalState = { mode: IntervalMode; left: number; key: string; progress: number };
