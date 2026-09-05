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
export type ActivePlan = {
  presetId: string;
  phases: Phase[];
  notificationSounds: NotificationSoundSettings;
  notificationSoundVolumes: NotificationSoundVolumes;
  musicVolume: number;
};

export type RaceState = {
  phase: number;
  anchor: number;
  pausedAt: number | null;
  pausedTotal: number;
  gelAnchor: number;
  gelFired: number;
  begun: boolean;
  lastInterval?: string;
};

export type IntervalState = { mode: IntervalMode; left: number; key: string; progress: number };
