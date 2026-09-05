import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useDrag } from '@use-gesture/react';
import { configurationFromPreset, getPreset, presets } from './configs';
import { formatTime, gelFor, intervalFor } from './plan';
import {
  loadRaceConfiguration,
  loadRaceSession,
  saveRaceConfiguration,
  saveRaceSession,
  saveRunnerPreferences,
} from './configuration-repository';
import { raceSessionReducer } from './race-session';
import { projectRace } from './race-projection';
import { themeFor } from './theme';
import {
  isNativeNotificationPlatform,
  requestNativeReminderPermission,
  synchronizeNativeRaceNotifications,
} from './native-notifications';
import {
  defaultMusicTrackId,
  musicTrackFor,
  musicTracks,
  notificationSounds,
  notificationSoundSource,
  notificationSoundVolumes,
} from './audio-library';
import { importMusicTrack, loadImportedMusicTracks } from './music-storage';
import { useMusicPlayer } from './use-music-player';
import { useRaceCues } from './use-race-cues';
import {
  AUDIO_CUES,
  PHASE_SWIPE_DISTANCE_PX,
  PHASE_SWIPE_VELOCITY,
  RACE_CLOCK_TICK_MS,
  SUPPRESS_TAP_AFTER_SWIPE_MS,
} from './race-constants';
import type { CSSProperties } from 'react';
import type {
  EffortLevel,
  MusicCue,
  NotificationSoundSettings,
  Phase,
  RaceConfiguration,
  RaceSettingsDraft,
  ViewMode,
} from './types';

type RaceStyle = CSSProperties & { '--accent': string; '--deep': string };
type CardStyle = CSSProperties & { '--card-accent': string };

export default function App() {
  const [configuration, setConfiguration] = useState<RaceConfiguration>(loadRaceConfiguration);
  const plan = configuration.plan.phases;
  const activePlan: RaceSettingsDraft = { ...configuration.plan, ...configuration.preferences };
  const planRef = useRef(plan);
  const [race, dispatchRace] = useReducer(
    (session: ReturnType<typeof loadRaceSession>, action: Parameters<typeof raceSessionReducer>[1]) =>
      raceSessionReducer(session, action, planRef.current),
    undefined,
    loadRaceSession,
  );
  const [currentTime, setCurrentTime] = useState(Date.now);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(configuration.preferences.viewMode);
  const [libraryTracks, setLibraryTracks] = useState(musicTracks);
  const [draft, setDraft] = useState<RaceSettingsDraft | null>(null);
  const raceRef = useRef(race);
  const suppressTapUntil = useRef(0);
  const music = useMusicPlayer(libraryTracks, activePlan.musicVolume);

  useEffect(() => {
    planRef.current = plan;
    saveRaceConfiguration(configuration);
  }, [configuration, plan]);
  useEffect(() => {
    saveRunnerPreferences({ ...configuration.preferences, viewMode });
  }, [configuration.preferences, viewMode]);
  useEffect(() => {
    void loadImportedMusicTracks()
      .then((imported) => setLibraryTracks((tracks) => [...tracks, ...imported]))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    raceRef.current = race;
    saveRaceSession(race);
  }, [race]);

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

  const {
    audioRef,
    beep,
    duration: musicDuration,
    isPlaying: musicPlaying,
    pause: stopMusic,
    play: startMusic,
    position: musicPosition,
    seek: seekMusic,
    unlockAudio,
  } = music;
  const cueGel = useCallback(() => {
    beep(AUDIO_CUES.gel.firstFrequency, AUDIO_CUES.gel.firstDuration);
    window.setTimeout(() => beep(AUDIO_CUES.gel.secondFrequency, AUDIO_CUES.gel.secondDuration), AUDIO_CUES.gel.gapMs);
    navigator.vibrate?.(AUDIO_CUES.gel.vibration);
    const phase = planRef.current[raceRef.current.phase];
    if ('Notification' in window && Notification.permission === 'granted' && phase) {
      new Notification('Gel time', {
        body: `${phase.name} · take your next gel when you can.`,
        icon: 'icon.svg',
        tag: 'race-day-gel',
      });
    }
  }, [beep]);

  useEffect(() => {
    const id = window.setInterval(() => setCurrentTime(Date.now()), RACE_CLOCK_TICK_MS);
    return () => window.clearInterval(id);
  }, []);
  useRaceCues({
    planRef,
    sessionRef: raceRef,
    dispatch: dispatchRace,
    onInterval: (mode) => {
      const cue = mode === 'RUN' ? AUDIO_CUES.run : AUDIO_CUES.walk;
      beep(cue.frequency, cue.duration);
    },
    onGel: cueGel,
  });

  useEffect(() => {
    // The wall-clock anchor is enough to reconstruct elapsed time, but checkpoint it
    // whenever Safari backgrounds or discards this page during an accidental refresh.
    const checkpoint = () => saveRaceSession(raceRef.current);
    const onVisibilityChange = () => {
      if (document.hidden) checkpoint();
    };
    window.addEventListener('pagehide', checkpoint);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', checkpoint);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const startRace = async () => {
    unlockAudio(plan.find((phase) => phase.music === 'START')?.musicTrackId ?? defaultMusicTrackId);
    if (isNativeNotificationPlatform()) await requestNativeReminderPermission();
    else if ('Notification' in window && Notification.permission === 'default')
      void Notification.requestPermission().catch(() => undefined);
    dispatchRace({ type: 'START', now: Date.now() });
  };
  const togglePause = () => {
    if (!race.begun) return;
    if (race.pausedAt) {
      unlockAudio();
      dispatchRace({ type: 'RESUME', now: Date.now() });
    } else dispatchRace({ type: 'PAUSE', now: Date.now() });
  };
  const changePhase = (change: number) => {
    const phase = Math.max(0, Math.min(plan.length - 1, race.phase + change));
    if (phase === race.phase) return;
    dispatchRace({ type: 'CHANGE_PHASE', phase, now: Date.now() });
    beep(AUDIO_CUES.phaseChange.frequency, AUDIO_CUES.phaseChange.duration);
    if (plan[phase]?.music === 'START') startMusic(plan[phase].musicTrackId);
    else stopMusic();
  };
  const jumpCue = (direction: -1 | 1) => {
    dispatchRace({ type: 'JUMP_INTERVAL', direction, now: Date.now() });
    const cue = direction === 1 ? AUDIO_CUES.intervalJump : AUDIO_CUES.intervalRewind;
    beep(cue.frequency, cue.duration);
  };
  const logGelEarly = () => {
    if (!race.begun || race.pausedAt) return;
    dispatchRace({ type: 'LOG_GEL', now: Date.now() });
    beep(AUDIO_CUES.gel.firstFrequency, AUDIO_CUES.gel.firstDuration);
    window.setTimeout(() => beep(AUDIO_CUES.gel.secondFrequency, AUDIO_CUES.gel.secondDuration), AUDIO_CUES.gel.gapMs);
    navigator.vibrate?.(AUDIO_CUES.gel.vibration);
  };
  const addCycle = () => dispatchRace({ type: 'ADD_CYCLE' });
  const addMusicTrack = async (file: File) => {
    const track = await importMusicTrack(file);
    setLibraryTracks((tracks) => [...tracks, track]);
  };
  const openSettings = () => {
    setDraft({
      ...activePlan,
      notificationSounds: { ...activePlan.notificationSounds },
      notificationSoundVolumes: { ...activePlan.notificationSoundVolumes },
      phases: plan.map((phase) => ({ ...phase })),
    });
    setSettingsOpen(true);
  };
  const saveSettings = () => {
    if (!draft) return;
    setConfiguration({
      plan: { presetId: draft.presetId, phases: draft.phases },
      preferences: {
        notificationSounds: draft.notificationSounds,
        notificationSoundVolumes: draft.notificationSoundVolumes,
        musicVolume: draft.musicVolume,
        viewMode,
      },
    });
    planRef.current = draft.phases;
    dispatchRace({ type: 'REPLACE_PLAN', phaseCount: draft.phases.length, now: Date.now() });
    setSettingsOpen(false);
  };

  const projection = projectRace(configuration.plan, race, currentTime);
  const phase = projection.phase;
  const interval = projection.interval;
  const gel = projection.gel;
  const cycles = projection.cycles;
  const phaseProgress = projection.phaseProgress;
  const next = plan[race.phase + 1];
  const preset = getPreset(activePlan.presetId);
  const theme = themeFor(phase.effort);
  const musicTrack = musicTrackFor(phase.musicTrackId, libraryTracks);
  const musicEnabled = phase.music === 'START';
  const toggleMusic = () => {
    if (musicPlaying) stopMusic();
    else startMusic(phase.musicTrackId);
  };
  const bindPhaseSwipe = useDrag(
    ({ last, movement: [movementX], velocity: [velocityX], direction: [directionX], tap, event }) => {
      if (viewMode !== 'full' || !last || tap) return;
      if (
        event.target instanceof Element &&
        event.target.closest('button, input, select, textarea, label, .music-player')
      )
        return;
      if (Math.abs(movementX) < PHASE_SWIPE_DISTANCE_PX && velocityX < PHASE_SWIPE_VELOCITY) return;
      suppressTapUntil.current = Date.now() + SUPPRESS_TAP_AFTER_SWIPE_MS;
      changePhase(directionX < 0 ? 1 : -1);
    },
    { axis: 'x', filterTaps: true },
  );
  const style: RaceStyle = { '--accent': theme.accent, '--deep': theme.deep };

  return (
    <main
      className={`race ${viewMode === 'simple' ? 'race-simple' : 'race-full'}`}
      style={style}
      onClick={(event) => {
        if (
          viewMode === 'full' &&
          !(event.target as Element).closest('button') &&
          Date.now() > suppressTapUntil.current
        )
          togglePause();
      }}
    >
      <audio ref={audioRef} loop playsInline preload="auto" />
      <header className="top">
        <span className="brand">NYC · RACE DAY</span>
        <span className="top-actions">
          <button
            className="view-button"
            onClick={() => {
              const nextView = viewMode === 'simple' ? 'full' : 'simple';
              setViewMode(nextView);
              setConfiguration((current) => ({
                ...current,
                preferences: { ...current.preferences, viewMode: nextView },
              }));
            }}
          >
            {viewMode === 'simple' ? 'Full controls' : 'Now view'}
          </button>
          {viewMode === 'full' && (
            <button className="icon-button" aria-label="Open settings" onClick={openSettings}>
              ⚙
            </button>
          )}
        </span>
      </header>
      {viewMode === 'simple' ? (
        <SimpleRaceScreen
          phase={phase}
          phaseLabel={preset.isTest ? 'TEST CONFIG' : `PHASE ${race.phase + 1} / ${plan.length}`}
          intervalMode={interval.mode}
          intervalLeft={formatTime(interval.left)}
          intervalProgress={interval.progress}
          phaseProgress={phaseProgress}
          cycleLabel={`CYCLE ${Math.min(projection.effectivePlannedCycles, cycles.done + 1)} OF ${projection.effectivePlannedCycles}`}
          gelLeft={formatTime(gel.left)}
          paused={Boolean(race.pausedAt)}
          showMusic={musicEnabled}
          trackLabel={musicTrack.label}
          musicPlaying={musicPlaying}
          musicPosition={musicPosition}
          musicDuration={musicDuration}
          onToggleMusic={toggleMusic}
          onSeekMusic={seekMusic}
        />
      ) : (
        <>
          <section className="body" {...bindPhaseSwipe()}>
            <span className="phase-count">
              {preset.isTest ? 'TEST CONFIG' : `PHASE ${race.phase + 1} / ${plan.length}`} · {theme.label}
            </span>
            <h1>{phase.name}</h1>
            <span className="miles">{phase.miles}</span>
            <p className="note">{phase.note}</p>
            <div className="interval">
              <span className="mode">{interval.mode}</span>
              <strong>{formatTime(interval.left)}</strong>
              {race.pausedAt && <span className="paused">PAUSED</span>}
              <ProgressIndicators
                intervalProgress={interval.progress}
                phaseProgress={phaseProgress}
                cycleLabel={`CYCLE ${Math.min(projection.effectivePlannedCycles, cycles.done + 1)} OF ${projection.effectivePlannedCycles}`}
              />
              <button
                className="gel-action"
                disabled={Boolean(race.pausedAt)}
                onClick={(event) => {
                  event.stopPropagation();
                  logGelEarly();
                }}
              >
                <i /> GEL IN <b>{formatTime(gel.left)}</b>
                <small>LOG EARLY</small>
              </button>
              {musicEnabled && (
                <MusicPlayer
                  label={musicTrack.label}
                  isPlaying={musicPlaying}
                  position={musicPosition}
                  duration={musicDuration}
                  onToggle={toggleMusic}
                  onSeek={seekMusic}
                />
              )}
              <div className="cue-controls">
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    jumpCue(-1);
                  }}
                >
                  ↶ Previous interval
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    jumpCue(1);
                  }}
                >
                  Next interval ↷
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    addCycle();
                  }}
                >
                  ＋ Add cycle
                </button>
              </div>
              <span className="tap-hint">
                Tap to {race.pausedAt ? 'resume' : 'pause'} · swipe left/right to change phase
              </span>
            </div>
          </section>
          <footer className="phase-footer">
            <span className="phase-skip">
              PHASE
              <br />
              <b>
                {race.phase + 1} / {plan.length}
              </b>
            </span>
            <span className="controls">
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  changePhase(-1);
                }}
                aria-label="Previous phase"
              >
                ←
              </button>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  changePhase(1);
                }}
                aria-label="Next phase"
              >
                →
              </button>
            </span>
            <span className="next">
              {next ? (
                <>
                  NEXT PHASE
                  <br />
                  {next.name}
                </>
              ) : (
                <>
                  FINISH
                  <br />
                  STRONG
                </>
              )}
            </span>
          </footer>
        </>
      )}
      {!race.begun && (
        <div className="intro">
          <div className="intro-actions">
            <button className="start" onClick={startRace}>
              Start race day<small>Sound + lock-screen reminders activate after one tap</small>
            </button>
          </div>
        </div>
      )}
      {settingsOpen && draft && (
        <Settings
          activePlan={draft}
          libraryTracks={libraryTracks}
          setPlan={setDraft}
          onAddMusic={addMusicTrack}
          onClose={() => setSettingsOpen(false)}
          onSave={saveSettings}
          onLoadPreset={(id) => {
            const next = configurationFromPreset(id);
            const nextDraft: RaceSettingsDraft = { ...next.plan, ...next.preferences };
            setDraft(nextDraft);
            setConfiguration(next);
            planRef.current = next.plan.phases;
            dispatchRace({ type: 'REPLACE_PLAN', phaseCount: next.plan.phases.length, now: Date.now(), begun: false });
            stopMusic();
          }}
          onReset={() => {
            const next = configurationFromPreset(draft.presetId);
            setDraft({ ...next.plan, ...next.preferences });
          }}
        />
      )}
    </main>
  );
}

function Settings({
  activePlan,
  libraryTracks,
  setPlan,
  onAddMusic,
  onClose,
  onSave,
  onLoadPreset,
  onReset,
}: {
  activePlan: RaceSettingsDraft;
  libraryTracks: typeof musicTracks;
  setPlan: (plan: RaceSettingsDraft) => void;
  onAddMusic: (file: File) => Promise<void>;
  onClose: () => void;
  onSave: () => void;
  onLoadPreset: (id: string) => void;
  onReset: () => void;
}) {
  const preset = getPreset(activePlan.presetId);
  const unitMs = preset.isTest ? 1_000 : 60_000;
  const unit = preset.isTest ? 'seconds' : 'minutes';
  const theme = (phase: Phase): CardStyle => {
    const colors = themeFor(phase.effort);
    return { '--card-accent': colors.accent };
  };
  const update = (index: number, field: keyof Phase, value: string | number) =>
    setPlan({
      ...activePlan,
      phases: activePlan.phases.map((phase, itemIndex) => (itemIndex === index ? { ...phase, [field]: value } : phase)),
    });
  const updateSound = (cue: keyof NotificationSoundSettings, soundId: string) =>
    setPlan({ ...activePlan, notificationSounds: { ...activePlan.notificationSounds, [cue]: soundId } });
  const updateSoundVolume = (
    cue: keyof NotificationSoundSettings,
    volume: RaceSettingsDraft['notificationSoundVolumes'][keyof RaceSettingsDraft['notificationSoundVolumes']],
  ) => setPlan({ ...activePlan, notificationSoundVolumes: { ...activePlan.notificationSoundVolumes, [cue]: volume } });
  const previewSound = (
    soundId: string,
    volume: RaceSettingsDraft['notificationSoundVolumes'][keyof RaceSettingsDraft['notificationSoundVolumes']],
  ) => {
    const audio = new Audio(`./${notificationSoundSource(soundId, volume)}`);
    audio.volume = 0.8;
    void audio.play().catch(() => undefined);
  };
  const importTrack = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void onAddMusic(file).catch(() => undefined);
  };
  return (
    <section className="sheet" aria-label="Race plan settings" onClick={(event) => event.stopPropagation()}>
      <header>
        <h2>Race plan</h2>
        <button onClick={onClose}>Done</button>
      </header>
      <p>
        Loading a configuration replaces the current plan and resets the race. Saving edits resets the current phase’s
        interval and gel clock.
      </p>
      <div className="config-picker">
        <label>
          Configuration
          <select value={activePlan.presetId} onChange={(event) => onLoadPreset(event.target.value)}>
            {presets.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <span>{preset.description}</span>
      </div>
      <div className="audio-picker">
        <h3>Sound balance</h3>
        <p>Notification intensity uses bundled quiet, normal, and loud variants. Music volume is continuous.</p>
        <div className="fields">
          <Field label="Run">
            <SoundSelect
              value={activePlan.notificationSounds.run}
              volume={activePlan.notificationSoundVolumes.run}
              onChange={(soundId) => updateSound('run', soundId)}
              onVolumeChange={(volume) => updateSoundVolume('run', volume)}
              onPreview={previewSound}
            />
          </Field>
          <Field label="Walk">
            <SoundSelect
              value={activePlan.notificationSounds.walk}
              volume={activePlan.notificationSoundVolumes.walk}
              onChange={(soundId) => updateSound('walk', soundId)}
              onVolumeChange={(volume) => updateSoundVolume('walk', volume)}
              onPreview={previewSound}
            />
          </Field>
          <Field label="Gel" wide>
            <SoundSelect
              value={activePlan.notificationSounds.gel}
              volume={activePlan.notificationSoundVolumes.gel}
              onChange={(soundId) => updateSound('gel', soundId)}
              onVolumeChange={(volume) => updateSoundVolume('gel', volume)}
              onPreview={previewSound}
            />
          </Field>
          <Field label={`Music volume ${Math.round(activePlan.musicVolume * 100)}%`} wide>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(activePlan.musicVolume * 100)}
              onChange={(event) => setPlan({ ...activePlan, musicVolume: Number(event.target.value) / 100 })}
            />
          </Field>
        </div>
      </div>
      <div className="audio-picker">
        <h3>Music library</h3>
        <p>Import an MP3 from Files. It remains available offline on this phone.</p>
        <label className="import-track">
          Add MP3
          <input type="file" accept="audio/mpeg,audio/mp3,audio/*" onChange={importTrack} />
        </label>
      </div>
      {activePlan.phases.map((phase, index) => (
        <article className="phase-card" key={index} style={theme(phase)}>
          <h3>
            {index + 1}. {phase.name}
          </h3>
          <div className="fields">
            <Field label="Phase name">
              <input value={phase.name} onChange={(event) => update(index, 'name', event.target.value)} />
            </Field>
            <Field label="Mile range">
              <input value={phase.miles} onChange={(event) => update(index, 'miles', event.target.value)} />
            </Field>
            <Field label="Effort level">
              <select
                value={phase.effort}
                onChange={(event) => update(index, 'effort', event.target.value as EffortLevel)}
              >
                {(['RECOVERY', 'CONTROLLED', 'SURGE', 'FINISH', 'TEST'] as EffortLevel[]).map((level) => (
                  <option key={level}>{level}</option>
                ))}
              </select>
            </Field>
            <Field label="Start with">
              <select value={phase.startsWith} onChange={(event) => update(index, 'startsWith', event.target.value)}>
                <option>RUN</option>
                <option>WALK</option>
              </select>
            </Field>
            <Field label="Music cue" wide>
              <select value={phase.music} onChange={(event) => update(index, 'music', event.target.value as MusicCue)}>
                <option value="NONE">No change</option>
                <option value="START">Start selected track</option>
              </select>
            </Field>
            <Field label="Music track" wide>
              <select
                value={phase.musicTrackId}
                onChange={(event) => update(index, 'musicTrackId', event.target.value)}
              >
                {libraryTracks.map((track) => (
                  <option key={track.id} value={track.id}>
                    {track.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Effort / vibe note" wide>
              <textarea value={phase.note} onChange={(event) => update(index, 'note', event.target.value)} />
            </Field>
            <Field label={`Run ${unit}`}>
              <input
                type="number"
                min="1"
                max="999"
                value={phase.runDurationMs / unitMs}
                onChange={(event) => update(index, 'runDurationMs', Number(event.target.value) * unitMs)}
              />
            </Field>
            <Field label={`Walk ${unit}`}>
              <input
                type="number"
                min="1"
                max="999"
                value={phase.walkDurationMs / unitMs}
                onChange={(event) => update(index, 'walkDurationMs', Number(event.target.value) * unitMs)}
              />
            </Field>
            <Field label="Planned intervals">
              <input
                type="number"
                min="1"
                max="999"
                value={phase.plannedCycles}
                onChange={(event) => update(index, 'plannedCycles', Number(event.target.value))}
              />
            </Field>
            <Field label={`Gel every (${unit})`} wide>
              <input
                type="number"
                min="1"
                max="999"
                value={phase.gelIntervalMs / unitMs}
                onChange={(event) => update(index, 'gelIntervalMs', Number(event.target.value) * unitMs)}
              />
            </Field>
          </div>
        </article>
      ))}
      <div className="settings-actions">
        <button className="reset" onClick={onReset}>
          Reset configuration
        </button>
        <button className="save" onClick={onSave}>
          Save plan
        </button>
      </div>
    </section>
  );
}
function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={wide ? 'wide' : ''}>
      {label}
      {children}
    </label>
  );
}
function SoundSelect({
  value,
  volume,
  onChange,
  onVolumeChange,
  onPreview,
}: {
  value: string;
  volume: RaceSettingsDraft['notificationSoundVolumes'][keyof RaceSettingsDraft['notificationSoundVolumes']];
  onChange: (soundId: string) => void;
  onVolumeChange: (
    volume: RaceSettingsDraft['notificationSoundVolumes'][keyof RaceSettingsDraft['notificationSoundVolumes']],
  ) => void;
  onPreview: (
    soundId: string,
    volume: RaceSettingsDraft['notificationSoundVolumes'][keyof RaceSettingsDraft['notificationSoundVolumes']],
  ) => void;
}) {
  return (
    <span className="sound-select">
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {notificationSounds.map((sound) => (
          <option key={sound.id} value={sound.id}>
            {sound.label}
          </option>
        ))}
      </select>
      <select
        value={volume}
        onChange={(event) =>
          onVolumeChange(
            event.target
              .value as RaceSettingsDraft['notificationSoundVolumes'][keyof RaceSettingsDraft['notificationSoundVolumes']],
          )
        }
      >
        {notificationSoundVolumes.map((level) => (
          <option key={level.id} value={level.id}>
            {level.label}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => onPreview(value, volume)}>
        Preview
      </button>
    </span>
  );
}

function MusicPlayer({
  label,
  isPlaying,
  position,
  duration,
  onToggle,
  onSeek,
  compact = false,
}: {
  label: string;
  isPlaying: boolean;
  position: number;
  duration: number;
  onToggle: () => void;
  onSeek: (position: number) => void;
  compact?: boolean;
}) {
  const hasDuration = duration > 0;
  return (
    <section
      className={`music-player ${compact ? 'music-player-compact' : ''}`}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button className="music-toggle" onClick={onToggle} aria-label={`${isPlaying ? 'Pause' : 'Play'} ${label}`}>
        <span aria-hidden="true">♫</span>
        <strong>{label}</strong>
        <b>{isPlaying ? '❚❚' : '▶'}</b>
      </button>
      {!compact && (
        <div className="music-seek">
          <input
            type="range"
            min="0"
            max={hasDuration ? duration : 1}
            step="0.1"
            value={hasDuration ? Math.min(position, duration) : 0}
            disabled={!hasDuration}
            aria-label="Music position"
            onChange={(event) => onSeek(Number(event.target.value))}
          />
          <span>
            {formatTime(Math.floor(position))} / {hasDuration ? formatTime(Math.floor(duration)) : '--:--'}
          </span>
        </div>
      )}
    </section>
  );
}

function ProgressIndicators({
  intervalProgress,
  phaseProgress,
  cycleLabel,
}: {
  intervalProgress: number;
  phaseProgress: number;
  cycleLabel: string;
}) {
  return (
    <div className="progress-indicators">
      <div>
        <span>THIS INTERVAL</span>
        <i>
          <b style={{ width: `${intervalProgress * 100}%` }} />
        </i>
      </div>
      <div>
        <span>{cycleLabel}</span>
        <i>
          <b style={{ width: `${phaseProgress * 100}%` }} />
        </i>
      </div>
    </div>
  );
}

function SimpleRaceScreen({
  phase,
  phaseLabel,
  intervalMode,
  intervalLeft,
  intervalProgress,
  phaseProgress,
  cycleLabel,
  gelLeft,
  paused,
  showMusic,
  trackLabel,
  musicPlaying,
  musicPosition,
  musicDuration,
  onToggleMusic,
  onSeekMusic,
}: {
  phase: Phase;
  phaseLabel: string;
  intervalMode: string;
  intervalLeft: string;
  intervalProgress: number;
  phaseProgress: number;
  cycleLabel: string;
  gelLeft: string;
  paused: boolean;
  showMusic: boolean;
  trackLabel: string;
  musicPlaying: boolean;
  musicPosition: number;
  musicDuration: number;
  onToggleMusic: () => void;
  onSeekMusic: (position: number) => void;
}) {
  return (
    <section className="simple-race-screen">
      <span className="phase-count">{phaseLabel}</span>
      <h1>{phase.name}</h1>
      <span className="miles">{phase.miles}</span>
      <div className="simple-interval">
        <span>{paused ? 'PAUSED' : intervalMode}</span>
        <strong>{intervalLeft}</strong>
        <small>{paused ? 'Open full controls to resume' : 'Until your next switch'}</small>
      </div>
      <ProgressIndicators intervalProgress={intervalProgress} phaseProgress={phaseProgress} cycleLabel={cycleLabel} />
      <div className="simple-gel">
        <i /> GEL IN <b>{gelLeft}</b>
      </div>
      {showMusic && (
        <MusicPlayer
          label={trackLabel}
          isPlaying={musicPlaying}
          position={musicPosition}
          duration={musicDuration}
          onToggle={onToggleMusic}
          onSeek={onSeekMusic}
          compact
        />
      )}
    </section>
  );
}
