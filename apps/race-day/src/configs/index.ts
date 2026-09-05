import type { RaceConfiguration, RacePlan, RacePlanPreset, RunnerPreferences } from '../types';
import { defaultMusicTrackId, defaultNotificationSounds, defaultNotificationSoundVolumes } from '../audio-library';
import { intervalDemo } from './interval-demo';
import { nycmStrategy } from './nycm-strategy';

export const presets = [nycmStrategy, intervalDemo] as const satisfies readonly RacePlanPreset[];
export const defaultPresetId = nycmStrategy.id;
export const getPreset = (id: string): RacePlanPreset => presets.find(preset => preset.id === id) ?? nycmStrategy;
export const racePlanFromPreset = (id = defaultPresetId): RacePlan => {
  const preset = getPreset(id);
  return {
    presetId: preset.id,
    phases: preset.phases.map(phase => ({ ...phase, musicTrackId: defaultMusicTrackId })),
  };
};
export const defaultRunnerPreferences = (): RunnerPreferences => ({
    notificationSounds: { ...defaultNotificationSounds },
    notificationSoundVolumes: { ...defaultNotificationSoundVolumes },
    musicVolume: 0.78,
    viewMode: 'simple',
  });
export const configurationFromPreset = (id = defaultPresetId): RaceConfiguration => ({ plan: racePlanFromPreset(id), preferences: defaultRunnerPreferences() });
