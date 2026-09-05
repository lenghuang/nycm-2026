import type { NotificationSoundSettings, NotificationSoundVolume, NotificationSoundVolumes } from './types';

export const notificationSounds = [
  { id: 'run-pulse', label: 'Pulse · high', source: 'run-pulse.wav' },
  { id: 'walk-tap', label: 'Tap · low double', source: 'walk-tap.wav' },
  { id: 'gel-chime', label: 'Chime · rising', source: 'gel-chime.wav' },
] as const;

export const defaultNotificationSounds: NotificationSoundSettings = {
  run: 'run-pulse',
  walk: 'walk-tap',
  gel: 'gel-chime',
};

export const notificationSoundVolumes: { id: NotificationSoundVolume; label: string }[] = [
  { id: 'quiet', label: 'Quiet' },
  { id: 'normal', label: 'Normal' },
  { id: 'loud', label: 'Loud' },
];

export const defaultNotificationSoundVolumes: NotificationSoundVolumes = { run: 'normal', walk: 'normal', gel: 'normal' };

export const notificationSoundSource = (id: string, volume: NotificationSoundVolume = 'normal'): string => {
  const source = notificationSounds.find(sound => sound.id === id)?.source ?? notificationSounds[0].source;
  return volume === 'normal' ? source : source.replace('.wav', `-${volume}.wav`);
};

export type MusicTrack = { id: string; label: string; source: string };

export const musicTracks: MusicTrack[] = [
  { id: 'race-day', label: 'Race Day', source: 'race-day.mp3' },
] as const;

export const defaultMusicTrackId = musicTracks[0].id;
export const musicTrackFor = (id: string, tracks: readonly MusicTrack[] = musicTracks): MusicTrack => tracks.find(track => track.id === id) ?? tracks[0] ?? musicTracks[0];
