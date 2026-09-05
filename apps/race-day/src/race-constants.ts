export const MILLISECONDS_PER_SECOND = 1_000;
export const SECONDS_PER_MINUTE = 60;
export const MINIMUM_CUE_DURATION_MS = MILLISECONDS_PER_SECOND;
export const RACE_CLOCK_TICK_MS = MILLISECONDS_PER_SECOND;
export const MUSIC_POSITION_PERSIST_MS = 5_000;
export const PHASE_SWIPE_DISTANCE_PX = 48;
export const PHASE_SWIPE_VELOCITY = 0.35;
export const SUPPRESS_TAP_AFTER_SWIPE_MS = 500;
export const AUDIO_CUES = {
  run: { frequency: 720, duration: 0.17 },
  walk: { frequency: 420, duration: 0.17 },
  phaseChange: { frequency: 740, duration: 0.1 },
  intervalJump: { frequency: 720, duration: 0.1 },
  intervalRewind: { frequency: 420, duration: 0.1 },
  gel: {
    firstFrequency: 880,
    secondFrequency: 1_050,
    firstDuration: 0.12,
    secondDuration: 0.18,
    gapMs: 180,
    vibration: [120, 80, 120],
  },
} as const;
