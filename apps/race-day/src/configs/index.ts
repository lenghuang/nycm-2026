import type { ActivePlan, RacePlanPreset } from '../types';
import { defaultMusicTrackId, defaultNotificationSounds, defaultNotificationSoundVolumes } from '../audio-library';
import { intervalDemo } from './interval-demo';
import { nycmStrategy } from './nycm-strategy';

export const presets = [nycmStrategy, intervalDemo] as const satisfies readonly RacePlanPreset[];
export const defaultPresetId = nycmStrategy.id;
export const getPreset = (id: string): RacePlanPreset => presets.find(preset => preset.id === id) ?? nycmStrategy;
export const planFromPreset = (id = defaultPresetId): ActivePlan => {
  const preset = getPreset(id);
  return {
    presetId: preset.id,
    notificationSounds: { ...defaultNotificationSounds },
    notificationSoundVolumes: { ...defaultNotificationSoundVolumes },
    musicVolume: 0.78,
    phases: preset.phases.map(phase => ({ ...phase, musicTrackId: defaultMusicTrackId })),
  };
};
