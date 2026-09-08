import type { MusicPolicy, NotificationCue, NotificationSoundSettings, NotificationSoundVolumes, Phase } from './types';

export const musicPolicyLabel: Record<MusicPolicy, string> = {
  SILENT: 'Silent',
  START_TRACK: 'Start selected track',
  CONTINUE_TRACK: 'Continue current track',
  STOP_TRACK: 'Stop current track',
};

/** Resolves a phase override without mutating the runner's global preferences. */
export function cueForPhase(
  phase: Phase,
  cue: NotificationCue,
  sounds: NotificationSoundSettings,
  volumes: NotificationSoundVolumes,
): { soundId: string; volume: NotificationSoundVolumes[NotificationCue] } {
  return phase.cueOverrides?.[cue] ?? { soundId: sounds[cue], volume: volumes[cue] };
}

/** Applies the phase music contract at a phase boundary. */
export function shouldShowMusic(policy: MusicPolicy): boolean {
  return policy === 'START_TRACK' || policy === 'CONTINUE_TRACK';
}
