import { useState } from 'react';
import { getPreset, presets } from './configs';
import {
  notificationSoundSource,
  notificationSounds,
  notificationSoundVolumes,
  type MusicTrack,
} from './audio-library';
import { musicPolicyLabel } from './phase-audio';
import { themeFor } from './theme';
import type { CSSProperties } from 'react';
import type { EffortLevel, NotificationCue, NotificationSoundSettings, Phase, RaceSettingsDraft } from './types';

type CardStyle = CSSProperties & { '--card-accent': string };
export function SettingsSheet({
  activePlan,
  libraryTracks,
  storageUsage,
  setPlan,
  onAddMusic,
  onRenameMusic,
  onDeleteMusic,
  onClose,
  onSave,
  onLoadPreset,
  onReset,
}: {
  activePlan: RaceSettingsDraft;
  libraryTracks: readonly MusicTrack[];
  storageUsage: { usedBytes: number; quotaBytes?: number };
  setPlan: (plan: RaceSettingsDraft) => void;
  onAddMusic: (file: File) => Promise<void>;
  onRenameMusic: (id: string, name: string) => Promise<void>;
  onDeleteMusic: (id: string) => Promise<void>;
  onClose: () => void;
  onSave: () => void;
  onLoadPreset: (id: string) => void;
  onReset: () => void;
}) {
  const preset = getPreset(activePlan.presetId);
  const unitMs = preset.isTest ? 1_000 : 60_000;
  const unit = preset.isTest ? 'seconds' : 'minutes';
  const update = (index: number, field: keyof Phase, value: string | number | Phase['cueOverrides']) =>
    setPlan({
      ...activePlan,
      phases: activePlan.phases.map((phase, item) => (item === index ? { ...phase, [field]: value } : phase)),
    });
  const updateCue = (index: number, cue: NotificationCue, field: 'soundId' | 'volume', value: string) => {
    const phase = activePlan.phases[index];
    const current = phase.cueOverrides?.[cue] ?? {
      soundId: activePlan.notificationSounds[cue],
      volume: activePlan.notificationSoundVolumes[cue],
    };
    update(index, 'cueOverrides', { ...phase.cueOverrides, [cue]: { ...current, [field]: value } });
  };
  const clearCue = (index: number, cue: NotificationCue) => {
    const { [cue]: _, ...rest } = activePlan.phases[index].cueOverrides ?? {};
    update(index, 'cueOverrides', rest);
  };
  const imported = libraryTracks.filter((track) => track.id !== 'race-day');
  return (
    <section className="sheet" aria-label="Race plan settings" onClick={(event) => event.stopPropagation()}>
      <header>
        <h2>Race plan</h2>
        <button onClick={onClose}>Done</button>
      </header>
      <p>
        Saving plan edits resets the active interval and gel clock. Audio and notification changes apply at the next
        phase boundary.
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
        <div className="fields">
          {(['run', 'walk', 'gel'] as NotificationCue[]).map((cue) => (
            <SoundSelect
              key={cue}
              label={cue}
              value={activePlan.notificationSounds[cue]}
              volume={activePlan.notificationSoundVolumes[cue]}
              onChange={(soundId) =>
                setPlan({ ...activePlan, notificationSounds: { ...activePlan.notificationSounds, [cue]: soundId } })
              }
              onVolumeChange={(volume) =>
                setPlan({
                  ...activePlan,
                  notificationSoundVolumes: { ...activePlan.notificationSoundVolumes, [cue]: volume },
                })
              }
            />
          ))}
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
      <MusicLibrary
        tracks={imported}
        phaseReferences={Object.fromEntries(
          imported.map((track) => [
            track.id,
            activePlan.phases.filter((phase) => phase.musicTrackId === track.id).length,
          ]),
        )}
        usage={storageUsage}
        onAdd={onAddMusic}
        onRename={onRenameMusic}
        onDelete={onDeleteMusic}
      />
      {activePlan.phases.map((phase, index) => (
        <article
          className="phase-card"
          key={index}
          style={{ '--card-accent': themeFor(phase.effort).accent } as CardStyle}
        >
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
            <Field label="Music policy" wide>
              <select value={phase.music} onChange={(event) => update(index, 'music', event.target.value)}>
                {Object.entries(musicPolicyLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
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
          <CueOverrides phase={phase} index={index} onUpdate={updateCue} onClear={clearCue} />
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
  label,
  value,
  volume,
  onChange,
  onVolumeChange,
}: {
  label: string;
  value: string;
  volume: 'quiet' | 'normal' | 'loud';
  onChange: (id: string) => void;
  onVolumeChange: (value: 'quiet' | 'normal' | 'loud') => void;
}) {
  return (
    <Field label={label}>
      <span className="sound-select">
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {notificationSounds.map((sound) => (
            <option key={sound.id} value={sound.id}>
              {sound.label}
            </option>
          ))}
        </select>
        <select value={volume} onChange={(event) => onVolumeChange(event.target.value as 'quiet' | 'normal' | 'loud')}>
          {notificationSoundVolumes.map((level) => (
            <option key={level.id} value={level.id}>
              {level.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            const audio = new Audio(`./${notificationSoundSource(value, volume)}`);
            void audio.play();
          }}
        >
          Preview
        </button>
      </span>
    </Field>
  );
}
function CueOverrides({
  phase,
  index,
  onUpdate,
  onClear,
}: {
  phase: Phase;
  index: number;
  onUpdate: (index: number, cue: NotificationCue, field: 'soundId' | 'volume', value: string) => void;
  onClear: (index: number, cue: NotificationCue) => void;
}) {
  return (
    <div className="cue-overrides">
      <h4>Phase cue overrides</h4>
      <p>Optional replacements for your normal run, walk, or gel notification sound.</p>
      {(['run', 'walk', 'gel'] as NotificationCue[]).map((cue) => {
        const value = phase.cueOverrides?.[cue];
        return (
          <div className="cue-override" key={cue}>
            <span>{cue}</span>
            <select
              value={value?.soundId ?? ''}
              onChange={(event) =>
                event.target.value ? onUpdate(index, cue, 'soundId', event.target.value) : onClear(index, cue)
              }
            >
              <option value="">Use global sound</option>
              {notificationSounds.map((sound) => (
                <option key={sound.id} value={sound.id}>
                  {sound.label}
                </option>
              ))}
            </select>
            <select
              value={value?.volume ?? 'normal'}
              disabled={!value}
              onChange={(event) => onUpdate(index, cue, 'volume', event.target.value)}
            >
              {notificationSoundVolumes.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.label}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
function MusicLibrary({
  tracks,
  phaseReferences,
  usage,
  onAdd,
  onRename,
  onDelete,
}: {
  tracks: readonly MusicTrack[];
  phaseReferences: Record<string, number>;
  usage: { usedBytes: number; quotaBytes?: number };
  onAdd: (file: File) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [names, setNames] = useState<Record<string, string>>({});
  const format = (bytes: number) => `${(bytes / 1_048_576).toFixed(bytes > 100_000_000 ? 0 : 1)} MB`;
  return (
    <div className="audio-picker">
      <h3>Music library</h3>
      <p>
        {format(usage.usedBytes)} stored{usage.quotaBytes ? ` of ${format(usage.quotaBytes)} available` : ''}. Imported
        tracks remain offline on this phone.
      </p>
      <label className="import-track">
        Add MP3
        <input
          type="file"
          accept="audio/mpeg,audio/mp3"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void onAdd(file);
          }}
        />
      </label>
      {tracks.map((track) => (
        <div className="track-management" key={track.id}>
          <input
            value={names[track.id] ?? track.label}
            aria-label={`Name for ${track.label}`}
            onChange={(event) => setNames({ ...names, [track.id]: event.target.value })}
          />
          <button onClick={() => void onRename(track.id, names[track.id] ?? track.label)}>Rename</button>
          <button className="delete-track" onClick={() => void onDelete(track.id)}>
            Delete
          </button>
          <small>
            Referenced by {phaseReferences[track.id] ?? 0} phase{phaseReferences[track.id] === 1 ? '' : 's'}
          </small>
        </div>
      ))}
    </div>
  );
}
