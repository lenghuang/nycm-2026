import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useDrag } from '@use-gesture/react';
import { configurationFromPreset } from './configs';
import { defaultMusicTrackId, musicTrackFor, musicTracks } from './audio-library';
import {
  loadRaceConfiguration,
  loadRaceSession,
  saveRaceConfiguration,
  saveRaceSession,
} from './configuration-repository';
import {
  deleteImportedMusicTrack,
  importMusicTrack,
  loadImportedMusicTracks,
  musicStorageUsage,
  renameImportedMusicTrack,
} from './music-storage';
import {
  isNativeNotificationPlatform,
  requestNativeReminderPermission,
  synchronizeNativeRaceNotifications,
} from './native-notifications';
import { cueForPhase, shouldShowMusic } from './phase-audio';
import { projectRace } from './race-projection';
import { initialRaceSession, raceSessionReducer } from './race-session';
import {
  AUDIO_CUES,
  PHASE_SWIPE_DISTANCE_PX,
  PHASE_SWIPE_VELOCITY,
  RACE_CLOCK_TICK_MS,
  SUPPRESS_TAP_AFTER_SWIPE_MS,
} from './race-constants';
import { useMusicPlayer } from './use-music-player';
import { useRaceCues } from './use-race-cues';
import type { RaceSettingsDraft, ViewMode } from './types';

export function useRaceController() {
  const [configuration, setConfiguration] = useState(loadRaceConfiguration);
  const plan = configuration.plan.phases;
  const planRef = useRef(plan);
  const [race, dispatchRace] = useReducer(
    (session: ReturnType<typeof loadRaceSession>, action: Parameters<typeof raceSessionReducer>[1]) =>
      raceSessionReducer(session, action, planRef.current),
    undefined,
    loadRaceSession,
  );
  const [now, setNow] = useState(Date.now);
  const [viewMode, setViewMode] = useState<ViewMode>(configuration.preferences.viewMode);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState<RaceSettingsDraft | null>(null);
  const [libraryTracks, setLibraryTracks] = useState(musicTracks);
  const [storageUsage, setStorageUsage] = useState<{ usedBytes: number; quotaBytes?: number }>({ usedBytes: 0 });
  const [recoveryPending, setRecoveryPending] = useState(() => {
    const saved = loadRaceSession();
    return saved.begun && !saved.finishedAt;
  });
  const raceRef = useRef(race);
  const suppressTapUntil = useRef(0);
  const music = useMusicPlayer(libraryTracks, configuration.preferences.musicVolume);

  useEffect(() => {
    planRef.current = plan;
    saveRaceConfiguration({ ...configuration, preferences: { ...configuration.preferences, viewMode } });
  }, [configuration, plan, viewMode]);
  useEffect(() => {
    raceRef.current = race;
    saveRaceSession(race);
  }, [race]);
  useEffect(() => {
    void loadImportedMusicTracks().then((tracks) => setLibraryTracks((current) => [...current, ...tracks]));
    void musicStorageUsage().then(setStorageUsage);
  }, []);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), RACE_CLOCK_TICK_MS);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    void synchronizeNativeRaceNotifications(
      configuration.plan,
      race,
      configuration.preferences.notificationSounds,
      configuration.preferences.notificationSoundVolumes,
    ).catch(() => undefined);
  }, [
    configuration.plan,
    configuration.preferences.notificationSounds,
    configuration.preferences.notificationSoundVolumes,
    race,
  ]);
  useEffect(() => {
    if (!recoveryPending || race.pausedAt) return;
    dispatchRace({ type: 'PAUSE', now: Date.now() });
  }, [recoveryPending, race.pausedAt]);
  useEffect(() => {
    const checkpoint = () => saveRaceSession(raceRef.current);
    const visible = () => {
      if (document.hidden) checkpoint();
    };
    window.addEventListener('pagehide', checkpoint);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('pagehide', checkpoint);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);

  const cueGel = useCallback(() => {
    const cue = AUDIO_CUES.gel;
    music.beep(cue.firstFrequency, cue.firstDuration);
    window.setTimeout(() => music.beep(cue.secondFrequency, cue.secondDuration), cue.gapMs);
    navigator.vibrate?.(cue.vibration);
    const phase = planRef.current[raceRef.current.phase];
    if ('Notification' in window && Notification.permission === 'granted' && phase)
      new Notification('Gel time', {
        body: `${phase.name} · take your next gel when you can.`,
        icon: 'icon.svg',
        tag: 'race-day-gel',
      });
  }, [music.beep]);
  useRaceCues({
    planRef,
    sessionRef: raceRef,
    dispatch: dispatchRace,
    onInterval: (mode) => {
      const cue = mode === 'RUN' ? AUDIO_CUES.run : AUDIO_CUES.walk;
      music.beep(cue.frequency, cue.duration);
    },
    onGel: cueGel,
  });

  const applyMusicPolicy = useCallback(
    (index: number) => {
      const phase = planRef.current[index];
      if (!phase) return;
      if (phase.music === 'START_TRACK') music.play(phase.musicTrackId);
      if (phase.music === 'STOP_TRACK' || phase.music === 'SILENT') music.pause();
    },
    [music.pause, music.play],
  );
  const startRace = async () => {
    const first = plan.find((phase) => phase.music === 'START_TRACK');
    music.unlockAudio(first?.musicTrackId ?? defaultMusicTrackId);
    if (isNativeNotificationPlatform()) await requestNativeReminderPermission();
    else if ('Notification' in window && Notification.permission === 'default')
      void Notification.requestPermission().catch(() => undefined);
    dispatchRace({ type: 'START', now: Date.now() });
    applyMusicPolicy(0);
  };
  const togglePause = () => {
    if (!race.begun || race.finishedAt || recoveryPending) return;
    if (race.pausedAt) {
      music.unlockAudio();
      dispatchRace({ type: 'RESUME', now: Date.now() });
    } else dispatchRace({ type: 'PAUSE', now: Date.now() });
  };
  const changePhase = (change: number) => {
    if (race.finishedAt) return;
    if (change > 0 && race.phase === plan.length - 1) {
      dispatchRace({ type: 'FINISH', now: Date.now() });
      music.pause();
      return;
    }
    const phase = Math.max(0, Math.min(plan.length - 1, race.phase + change));
    if (phase === race.phase) return;
    dispatchRace({ type: 'CHANGE_PHASE', phase, now: Date.now() });
    music.beep(AUDIO_CUES.phaseChange.frequency, AUDIO_CUES.phaseChange.duration);
    applyMusicPolicy(phase);
  };
  const jumpCue = (direction: -1 | 1) => {
    dispatchRace({ type: 'JUMP_INTERVAL', direction, now: Date.now() });
    const cue = direction === 1 ? AUDIO_CUES.intervalJump : AUDIO_CUES.intervalRewind;
    music.beep(cue.frequency, cue.duration);
  };
  const logGelEarly = () => {
    if (!race.begun || race.pausedAt || race.finishedAt) return;
    dispatchRace({ type: 'LOG_GEL', now: Date.now() });
    cueGel();
  };
  const openSettings = () => {
    setDraft({
      ...configuration.plan,
      ...configuration.preferences,
      notificationSounds: { ...configuration.preferences.notificationSounds },
      notificationSoundVolumes: { ...configuration.preferences.notificationSoundVolumes },
      phases: plan.map((phase) => ({ ...phase, cueOverrides: { ...phase.cueOverrides } })),
    });
    setSettingsOpen(true);
  };
  const saveSettings = () => {
    if (!draft) return;
    const next = {
      plan: { presetId: draft.presetId, phases: draft.phases },
      preferences: {
        notificationSounds: draft.notificationSounds,
        notificationSoundVolumes: draft.notificationSoundVolumes,
        musicVolume: draft.musicVolume,
        viewMode,
      },
    };
    setConfiguration(next);
    planRef.current = next.plan.phases;
    dispatchRace({ type: 'REPLACE_PLAN', phaseCount: next.plan.phases.length, now: Date.now() });
    setSettingsOpen(false);
    music.pause();
  };
  const loadPreset = (id: string) => {
    const next = configurationFromPreset(id);
    setDraft({ ...next.plan, ...next.preferences });
  };
  const addMusicTrack = async (file: File) => {
    const track = await importMusicTrack(file);
    setLibraryTracks((tracks) => [...tracks, track]);
    setStorageUsage(await musicStorageUsage());
  };
  const renameMusicTrack = async (id: string, name: string) => {
    await renameImportedMusicTrack(id, name);
    setLibraryTracks((tracks) =>
      tracks.map((track) => (track.id === id ? { ...track, label: name.trim() || 'Untitled track' } : track)),
    );
  };
  const removeMusicTrack = async (id: string) => {
    await deleteImportedMusicTrack(id);
    setLibraryTracks((tracks) => tracks.filter((track) => track.id !== id));
    setStorageUsage(await musicStorageUsage());
  };
  const bindPhaseSwipe = useDrag(
    ({ last, movement: [x], velocity: [velocityX], direction: [directionX], tap, event }) => {
      if (viewMode !== 'full' || !last || tap) return;
      if (event.target instanceof Element && event.target.closest('button,input,select,textarea,label,.music-player'))
        return;
      if (Math.abs(x) < PHASE_SWIPE_DISTANCE_PX && velocityX < PHASE_SWIPE_VELOCITY) return;
      suppressTapUntil.current = Date.now() + SUPPRESS_TAP_AFTER_SWIPE_MS;
      changePhase(directionX < 0 ? 1 : -1);
    },
    { axis: 'x', filterTaps: true },
  );
  const projection = projectRace(configuration.plan, race, now);
  const phase = projection.phase;
  return {
    configuration,
    plan,
    race,
    projection,
    phase,
    viewMode,
    setViewMode,
    settingsOpen,
    setSettingsOpen,
    draft,
    setDraft,
    libraryTracks,
    storageUsage,
    recoveryPending,
    setRecoveryPending,
    music,
    openSettings,
    saveSettings,
    loadPreset,
    addMusicTrack,
    renameMusicTrack,
    removeMusicTrack,
    startRace,
    togglePause,
    changePhase,
    jumpCue,
    logGelEarly,
    addCycle: () => dispatchRace({ type: 'ADD_CYCLE' }),
    toggleMusic: () => (music.isPlaying ? music.pause() : music.play(phase.musicTrackId)),
    musicEnabled: shouldShowMusic(phase.music),
    musicTrack: musicTrackFor(phase.musicTrackId, libraryTracks),
    bindPhaseSwipe: bindPhaseSwipe(),
    suppressTapUntil,
    discardRace: () => {
      dispatchRace({ type: 'REPLACE_PLAN', phaseCount: plan.length, now: Date.now(), begun: false });
      setRecoveryPending(false);
      music.pause();
    },
    resumeRecoveredRace: () => {
      dispatchRace({ type: 'RESUME', now: Date.now() });
      setRecoveryPending(false);
    },
    cueForPhase: (cue: 'run' | 'walk' | 'gel') =>
      cueForPhase(
        phase,
        cue,
        configuration.preferences.notificationSounds,
        configuration.preferences.notificationSoundVolumes,
      ),
  };
}
