import { useCallback, useEffect, useRef, useState } from 'react';
import { getPreset, planFromPreset, presets } from './configs';
import { cueJumpOffset, cycleSummaryFor, elapsed, formatTime, gelFor, intervalFor, phaseProgressFor } from './plan';
import { loadMusicPositions, loadPlan, loadRace, loadViewMode, saveMusicPositions, savePlan, saveRace, saveViewMode } from './storage';
import { themeFor } from './theme';
import { isNativeNotificationPlatform, requestNativeReminderPermission, synchronizeNativeRaceNotifications } from './native-notifications';
import { defaultMusicTrackId, musicTrackFor, musicTracks, notificationSounds, notificationSoundSource, notificationSoundVolumes } from './audio-library';
import { importMusicTrack, loadImportedMusicTracks } from './music-storage';
import type { CSSProperties } from 'react';
import type { ActivePlan, EffortLevel, MusicCue, NotificationSoundSettings, Phase, RaceState, ViewMode } from './types';

type RaceStyle = CSSProperties & { '--accent': string; '--deep': string };
type CardStyle = CSSProperties & { '--card-accent': string };

export default function App() {
  const [activePlan, setActivePlan] = useState<ActivePlan>(loadPlan);
  const [race, setRace] = useState<RaceState>(loadRace);
  const [currentTime, setCurrentTime] = useState(Date.now);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(loadViewMode);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicPosition, setMusicPosition] = useState(0);
  const [musicDuration, setMusicDuration] = useState(0);
  const [libraryTracks, setLibraryTracks] = useState(musicTracks);
  const [draft, setDraft] = useState<ActivePlan | null>(null);
  const plan = activePlan.phases;
  const planRef = useRef(plan);
  const raceRef = useRef(race);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const musicTrackIdRef = useRef<string | null>(null);
  const musicTracksRef = useRef(libraryTracks);
  const musicVolumeRef = useRef(activePlan.musicVolume);
  const musicPositionsRef = useRef(loadMusicPositions());
  const keepAliveStarted = useRef(false);
  const touchX = useRef<number | null>(null);
  const suppressTapUntil = useRef(0);

  useEffect(() => { planRef.current = plan; savePlan(activePlan); }, [activePlan, plan]);
  useEffect(() => { saveViewMode(viewMode); }, [viewMode]);
  useEffect(() => { musicTracksRef.current = libraryTracks; }, [libraryTracks]);
  useEffect(() => {
    musicVolumeRef.current = activePlan.musicVolume;
    if (audioRef.current && !audioRef.current.paused) audioRef.current.volume = activePlan.musicVolume;
  }, [activePlan.musicVolume]);
  useEffect(() => { void loadImportedMusicTracks().then(imported => setLibraryTracks(tracks => [...tracks, ...imported])).catch(() => undefined); }, []);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const updatePosition = () => {
      setMusicPosition(audio.currentTime);
      setMusicDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      const trackId = musicTrackIdRef.current;
      if (!trackId) return;
      musicPositionsRef.current[trackId] = audio.currentTime;
      saveMusicPositions(musicPositionsRef.current);
    };
    audio.addEventListener('timeupdate', updatePosition);
    audio.addEventListener('loadedmetadata', updatePosition);
    return () => { audio.removeEventListener('timeupdate', updatePosition); audio.removeEventListener('loadedmetadata', updatePosition); };
  }, []);
  const commitRace = useCallback((next: RaceState) => { raceRef.current = next; setRace(next); saveRace(next); }, []);

  useEffect(() => {
    void synchronizeNativeRaceNotifications(plan, race, activePlan.notificationSounds, activePlan.notificationSoundVolumes).catch(() => undefined);
  }, [activePlan.notificationSounds, activePlan.notificationSoundVolumes, plan, race.anchor, race.begun, race.gelAnchor, race.pausedAt, race.pausedTotal, race.phase]);

  const unlockAudio = useCallback((trackId?: string) => {
    if (!audioContextRef.current) {
      const Context = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Context) audioContextRef.current = new Context();
    }
    void audioContextRef.current?.resume();
    const audio = audioRef.current;
    if (!audio) return;
    const selectedTrackId = trackId ?? musicTrackIdRef.current ?? defaultMusicTrackId;
    if (musicTrackIdRef.current !== selectedTrackId) {
      audio.pause();
      const source = musicTrackFor(selectedTrackId, musicTracksRef.current).source;
      audio.src = source.startsWith('blob:') ? source : `./${source}`;
      musicTrackIdRef.current = selectedTrackId;
    }
    if (!keepAliveStarted.current) {
      audio.loop = true;
      audio.volume = 0;
      void audio.play().catch(() => undefined);
      keepAliveStarted.current = true;
    }
  }, []);
  const startMusic = (trackId: string) => {
    unlockAudio(trackId);
    const audio = audioRef.current;
    if (!audio) return;
    const restorePosition = () => {
      if (musicTrackIdRef.current === trackId) audio.currentTime = musicPositionsRef.current[trackId] ?? 0;
    };
    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) restorePosition();
    else audio.addEventListener('loadedmetadata', restorePosition, { once: true });
    audio.volume = musicVolumeRef.current;
    void audio.play().then(() => setMusicPlaying(true)).catch(() => setMusicPlaying(false));
  };
  const stopMusic = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const trackId = musicTrackIdRef.current;
    if (trackId) {
      musicPositionsRef.current[trackId] = audio.currentTime;
      saveMusicPositions(musicPositionsRef.current);
    }
    audio.pause();
    keepAliveStarted.current = false;
    setMusicPlaying(false);
  };
  const beep = useCallback((frequency = 660, duration = 0.13) => {
    const context = audioContextRef.current;
    if (!context || context.state !== 'running') return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration + 0.02);
  }, []);
  const cueGel = useCallback(() => {
    beep(880, 0.12);
    window.setTimeout(() => beep(1050, 0.18), 180);
    navigator.vibrate?.([120, 80, 120]);
    const phase = planRef.current[raceRef.current.phase];
    if ('Notification' in window && Notification.permission === 'granted' && phase) {
      new Notification('Gel time', { body: `${phase.name} · take your next gel when you can.`, icon: 'icon.svg', tag: 'race-day-gel' });
    }
  }, [beep]);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      setCurrentTime(now);
      const activeRace = raceRef.current;
      if (!activeRace.begun || activeRace.pausedAt) return;
      const interval = intervalFor(planRef.current, activeRace, now);
      const gel = gelFor(planRef.current, activeRace, now);
      let next = activeRace;
      if (!activeRace.lastInterval) next = { ...next, lastInterval: interval.key };
      else if (activeRace.lastInterval !== interval.key) { beep(interval.mode === 'RUN' ? 720 : 420, 0.17); next = { ...next, lastInterval: interval.key }; }
      if (gel.number > next.gelFired) { cueGel(); next = { ...next, gelFired: gel.number }; }
      if (next !== activeRace) commitRace(next);
    };
    const onVisible = () => { if (!document.hidden) tick(); };
    const intervalId = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(intervalId); document.removeEventListener('visibilitychange', onVisible); };
  }, [beep, commitRace, cueGel]);

  useEffect(() => {
    // The wall-clock anchor is enough to reconstruct elapsed time, but checkpoint it
    // whenever Safari backgrounds or discards this page during an accidental refresh.
    const checkpoint = () => saveRace(raceRef.current);
    const onVisibilityChange = () => { if (document.hidden) checkpoint(); };
    window.addEventListener('pagehide', checkpoint);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => { window.removeEventListener('pagehide', checkpoint); document.removeEventListener('visibilitychange', onVisibilityChange); };
  }, []);

  const resetTiming = (phase: number, nextPlan = planRef.current, begun = raceRef.current.begun): RaceState => {
    const next: RaceState = { ...raceRef.current, phase, anchor: Date.now(), pausedAt: null, pausedTotal: 0, gelAnchor: 0, gelFired: 0, begun, lastInterval: undefined };
    next.lastInterval = intervalFor(nextPlan, next, Date.now()).key;
    return next;
  };
  const startRace = async () => {
    unlockAudio(plan.find(phase => phase.music === 'START')?.musicTrackId ?? defaultMusicTrackId);
    if (isNativeNotificationPlatform()) await requestNativeReminderPermission();
    else if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission().catch(() => undefined);
    commitRace(resetTiming(race.phase, plan, true));
  };
  const togglePause = () => {
    if (!race.begun) return;
    const next = race.pausedAt ? { ...race, pausedAt: null, pausedTotal: race.pausedTotal + Date.now() - race.pausedAt } : { ...race, pausedAt: Date.now() };
    if (!next.pausedAt) unlockAudio();
    commitRace(next);
  };
  const changePhase = (change: number) => {
    const phase = Math.max(0, Math.min(plan.length - 1, race.phase + change));
    if (phase === race.phase) return;
    commitRace(resetTiming(phase));
    beep(740, 0.1);
    if (plan[phase]?.music === 'START') startMusic(plan[phase].musicTrackId);
    else stopMusic();
  };
  const jumpCue = (direction: -1 | 1) => {
    const now = Date.now();
    const offset = Math.max(-elapsed(race, now), cueJumpOffset(plan, race, now, direction));
    const next: RaceState = { ...race, anchor: race.anchor - offset, lastInterval: undefined };
    next.lastInterval = intervalFor(plan, next, now).key;
    commitRace(next);
    beep(direction === 1 ? 720 : 420, 0.1);
  };
  const logGelEarly = () => {
    if (!race.begun || race.pausedAt) return;
    const now = Date.now();
    commitRace({ ...race, gelAnchor: elapsed(race, now), gelFired: 0 });
    beep(880, 0.12);
    window.setTimeout(() => beep(1050, 0.18), 180);
    navigator.vibrate?.([120, 80, 120]);
  };
  const addMusicTrack = async (file: File) => {
    const track = await importMusicTrack(file);
    setLibraryTracks(tracks => [...tracks, track]);
  };
  const openSettings = () => { setDraft({ ...activePlan, notificationSounds: { ...activePlan.notificationSounds }, phases: plan.map(phase => ({ ...phase })) }); setSettingsOpen(true); };
  const saveSettings = () => {
    if (!draft) return;
    setActivePlan(draft);
    planRef.current = draft.phases;
    commitRace(resetTiming(Math.min(race.phase, draft.phases.length - 1), draft.phases));
    setSettingsOpen(false);
  };

  const phase = plan[race.phase] ?? plan[0];
  const interval = intervalFor(plan, race, currentTime);
  const gel = gelFor(plan, race, currentTime);
  const cycles = cycleSummaryFor(plan, race, currentTime);
  const phaseProgress = phaseProgressFor(plan, race, currentTime);
  const next = plan[race.phase + 1];
  const preset = getPreset(activePlan.presetId);
  const theme = themeFor(phase.effort);
  const musicTrack = musicTrackFor(phase.musicTrackId, libraryTracks);
  const toggleMusic = () => { if (musicPlaying) stopMusic(); else startMusic(phase.musicTrackId); };
  const seekMusic = (position: number) => {
    const audio = audioRef.current;
    const trackId = musicTrackIdRef.current;
    if (!audio || !trackId || !Number.isFinite(audio.duration)) return;
    audio.currentTime = position;
    musicPositionsRef.current[trackId] = position;
    saveMusicPositions(musicPositionsRef.current);
    setMusicPosition(position);
  };
  const style: RaceStyle = { '--accent': theme.accent, '--deep': theme.deep };

  return <main className={`race ${viewMode === 'simple' ? 'race-simple' : 'race-full'}`} style={style}
    onClick={event => { if (viewMode === 'full' && !(event.target as Element).closest('button') && Date.now() > suppressTapUntil.current) togglePause(); }}
    onPointerDown={event => { if (viewMode === 'full' && event.pointerType === 'touch') touchX.current = event.clientX; }}
    onPointerUp={event => { if (viewMode !== 'full' || event.pointerType !== 'touch' || touchX.current === null) return; const delta = event.clientX - touchX.current; touchX.current = null; if (Math.abs(delta) > 48) { suppressTapUntil.current = Date.now() + 500; jumpCue(delta < 0 ? 1 : -1); } }}
    onPointerCancel={() => { touchX.current = null; }}>
    <audio ref={audioRef} loop playsInline preload="auto" />
    <header className="top"><span className="brand">NYC · RACE DAY</span><span className="top-actions"><button className="view-button" onClick={() => setViewMode(viewMode === 'simple' ? 'full' : 'simple')}>{viewMode === 'simple' ? 'Full controls' : 'Now view'}</button>{viewMode === 'full' && <button className="icon-button" aria-label="Open settings" onClick={openSettings}>⚙</button>}</span></header>
    {viewMode === 'simple'
      ? <SimpleRaceScreen phase={phase} phaseLabel={preset.isTest ? 'TEST CONFIG' : `PHASE ${race.phase + 1} / ${plan.length}`} intervalMode={interval.mode} intervalLeft={formatTime(interval.left)} intervalProgress={interval.progress} phaseProgress={phaseProgress} cycleLabel={`CYCLE ${Math.min(phase.plannedCycles, cycles.done + 1)} OF ${phase.plannedCycles}`} gelLeft={formatTime(gel.left)} paused={Boolean(race.pausedAt)} trackLabel={musicTrack.label} musicPlaying={musicPlaying} musicPosition={musicPosition} musicDuration={musicDuration} onToggleMusic={toggleMusic} onSeekMusic={seekMusic} />
      : <><section className="body"><span className="phase-count">{preset.isTest ? 'TEST CONFIG' : `PHASE ${race.phase + 1} / ${plan.length}`} · {theme.label}</span><h1>{phase.name}</h1><span className="miles">{phase.miles}</span><p className="note">{phase.note}</p>
        <div className="interval"><span className="mode">{interval.mode}</span><strong>{formatTime(interval.left)}</strong>{race.pausedAt && <span className="paused">PAUSED</span>}<ProgressIndicators intervalProgress={interval.progress} phaseProgress={phaseProgress} cycleLabel={`CYCLE ${Math.min(phase.plannedCycles, cycles.done + 1)} OF ${phase.plannedCycles}`} /><button className="gel-action" disabled={Boolean(race.pausedAt)} onClick={event => { event.stopPropagation(); logGelEarly(); }}><i /> GEL IN <b>{formatTime(gel.left)}</b><small>LOG EARLY</small></button><MusicPlayer label={musicTrack.label} isPlaying={musicPlaying} position={musicPosition} duration={musicDuration} onToggle={toggleMusic} onSeek={seekMusic} />{phase.music === 'START' && <span className="music-cue">♫ MUSIC STARTS IN THIS PHASE</span>}<div className="cue-controls"><button onClick={event => { event.stopPropagation(); jumpCue(-1); }}>↶ Previous interval</button><button onClick={event => { event.stopPropagation(); jumpCue(1); }}>Next interval ↷</button></div><span className="tap-hint">Tap to {race.pausedAt ? 'resume' : 'pause'} · swipe left/right for intervals · use arrows to change phase</span></div>
      </section>
      <footer className="phase-footer"><span className="phase-skip">PHASE<br /><b>{race.phase + 1} / {plan.length}</b></span><span className="controls"><button onClick={event => { event.stopPropagation(); changePhase(-1); }} aria-label="Previous phase">←</button><button onClick={event => { event.stopPropagation(); changePhase(1); }} aria-label="Next phase">→</button></span><span className="next">{next ? <>NEXT PHASE<br />{next.name}</> : <>FINISH<br />STRONG</>}</span></footer></>}
    {!race.begun && <div className="intro"><div className="intro-actions"><button className="start" onClick={startRace}>Start race day<small>Sound + lock-screen reminders activate after one tap</small></button></div></div>}
    {settingsOpen && draft && <Settings activePlan={draft} libraryTracks={libraryTracks} setPlan={setDraft} onAddMusic={addMusicTrack} onClose={() => setSettingsOpen(false)} onSave={saveSettings} onLoadPreset={id => { const nextPlan = planFromPreset(id); setDraft(nextPlan); setActivePlan(nextPlan); planRef.current = nextPlan.phases; commitRace(resetTiming(0, nextPlan.phases, false)); stopMusic(); }} onReset={() => setDraft(planFromPreset(draft.presetId))} />}
  </main>;
}

function Settings({ activePlan, libraryTracks, setPlan, onAddMusic, onClose, onSave, onLoadPreset, onReset }: { activePlan: ActivePlan; libraryTracks: typeof musicTracks; setPlan: (plan: ActivePlan) => void; onAddMusic: (file: File) => Promise<void>; onClose: () => void; onSave: () => void; onLoadPreset: (id: string) => void; onReset: () => void }) {
  const preset = getPreset(activePlan.presetId);
  const unitMs = preset.isTest ? 1_000 : 60_000;
  const unit = preset.isTest ? 'seconds' : 'minutes';
  const theme = (phase: Phase): CardStyle => { const colors = themeFor(phase.effort); return { '--card-accent': colors.accent }; };
  const update = (index: number, field: keyof Phase, value: string | number) => setPlan({ ...activePlan, phases: activePlan.phases.map((phase, itemIndex) => itemIndex === index ? { ...phase, [field]: value } : phase) });
  const updateSound = (cue: keyof NotificationSoundSettings, soundId: string) => setPlan({ ...activePlan, notificationSounds: { ...activePlan.notificationSounds, [cue]: soundId } });
  const updateSoundVolume = (cue: keyof NotificationSoundSettings, volume: ActivePlan['notificationSoundVolumes'][keyof ActivePlan['notificationSoundVolumes']]) => setPlan({ ...activePlan, notificationSoundVolumes: { ...activePlan.notificationSoundVolumes, [cue]: volume } });
  const previewSound = (soundId: string, volume: ActivePlan['notificationSoundVolumes'][keyof ActivePlan['notificationSoundVolumes']]) => { const audio = new Audio(`./${notificationSoundSource(soundId, volume)}`); audio.volume = 0.8; void audio.play().catch(() => undefined); };
  const importTrack = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void onAddMusic(file).catch(() => undefined); };
  return <section className="sheet" aria-label="Race plan settings" onClick={event => event.stopPropagation()}><header><h2>Race plan</h2><button onClick={onClose}>Done</button></header><p>Loading a configuration replaces the current plan and resets the race. Saving edits resets the current phase’s interval and gel clock.</p>
    <div className="config-picker"><label>Configuration<select value={activePlan.presetId} onChange={event => onLoadPreset(event.target.value)}>{presets.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><span>{preset.description}</span></div>
    <div className="audio-picker"><h3>Sound balance</h3><p>Notification intensity uses bundled quiet, normal, and loud variants. Music volume is continuous.</p><div className="fields"><Field label="Run"><SoundSelect value={activePlan.notificationSounds.run} volume={activePlan.notificationSoundVolumes.run} onChange={soundId => updateSound('run', soundId)} onVolumeChange={volume => updateSoundVolume('run', volume)} onPreview={previewSound} /></Field><Field label="Walk"><SoundSelect value={activePlan.notificationSounds.walk} volume={activePlan.notificationSoundVolumes.walk} onChange={soundId => updateSound('walk', soundId)} onVolumeChange={volume => updateSoundVolume('walk', volume)} onPreview={previewSound} /></Field><Field label="Gel" wide><SoundSelect value={activePlan.notificationSounds.gel} volume={activePlan.notificationSoundVolumes.gel} onChange={soundId => updateSound('gel', soundId)} onVolumeChange={volume => updateSoundVolume('gel', volume)} onPreview={previewSound} /></Field><Field label={`Music volume ${Math.round(activePlan.musicVolume * 100)}%`} wide><input type="range" min="0" max="100" value={Math.round(activePlan.musicVolume * 100)} onChange={event => setPlan({ ...activePlan, musicVolume: Number(event.target.value) / 100 })} /></Field></div></div>
    <div className="audio-picker"><h3>Music library</h3><p>Import an MP3 from Files. It remains available offline on this phone.</p><label className="import-track">Add MP3<input type="file" accept="audio/mpeg,audio/mp3,audio/*" onChange={importTrack} /></label></div>
    {activePlan.phases.map((phase, index) => <article className="phase-card" key={index} style={theme(phase)}><h3>{index + 1}. {phase.name}</h3><div className="fields">
      <Field label="Phase name"><input value={phase.name} onChange={event => update(index, 'name', event.target.value)} /></Field><Field label="Mile range"><input value={phase.miles} onChange={event => update(index, 'miles', event.target.value)} /></Field><Field label="Effort level"><select value={phase.effort} onChange={event => update(index, 'effort', event.target.value as EffortLevel)}>{(['RECOVERY', 'CONTROLLED', 'SURGE', 'FINISH', 'TEST'] as EffortLevel[]).map(level => <option key={level}>{level}</option>)}</select></Field><Field label="Start with"><select value={phase.startsWith} onChange={event => update(index, 'startsWith', event.target.value)}><option>RUN</option><option>WALK</option></select></Field><Field label="Music cue" wide><select value={phase.music} onChange={event => update(index, 'music', event.target.value as MusicCue)}><option value="NONE">No change</option><option value="START">Start selected track</option></select></Field><Field label="Music track" wide><select value={phase.musicTrackId} onChange={event => update(index, 'musicTrackId', event.target.value)}>{libraryTracks.map(track => <option key={track.id} value={track.id}>{track.label}</option>)}</select></Field>
      <Field label="Effort / vibe note" wide><textarea value={phase.note} onChange={event => update(index, 'note', event.target.value)} /></Field><Field label={`Run ${unit}`}><input type="number" min="1" max="999" value={phase.runDurationMs / unitMs} onChange={event => update(index, 'runDurationMs', Number(event.target.value) * unitMs)} /></Field><Field label={`Walk ${unit}`}><input type="number" min="1" max="999" value={phase.walkDurationMs / unitMs} onChange={event => update(index, 'walkDurationMs', Number(event.target.value) * unitMs)} /></Field><Field label="Planned intervals"><input type="number" min="1" max="999" value={phase.plannedCycles} onChange={event => update(index, 'plannedCycles', Number(event.target.value))} /></Field><Field label={`Gel every (${unit})`} wide><input type="number" min="1" max="999" value={phase.gelIntervalMs / unitMs} onChange={event => update(index, 'gelIntervalMs', Number(event.target.value) * unitMs)} /></Field>
    </div></article>)}
    <div className="settings-actions"><button className="reset" onClick={onReset}>Reset configuration</button><button className="save" onClick={onSave}>Save plan</button></div>
  </section>;
}
function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={wide ? 'wide' : ''}>{label}{children}</label>; }
function SoundSelect({ value, volume, onChange, onVolumeChange, onPreview }: { value: string; volume: ActivePlan['notificationSoundVolumes'][keyof ActivePlan['notificationSoundVolumes']]; onChange: (soundId: string) => void; onVolumeChange: (volume: ActivePlan['notificationSoundVolumes'][keyof ActivePlan['notificationSoundVolumes']]) => void; onPreview: (soundId: string, volume: ActivePlan['notificationSoundVolumes'][keyof ActivePlan['notificationSoundVolumes']]) => void }) { return <span className="sound-select"><select value={value} onChange={event => onChange(event.target.value)}>{notificationSounds.map(sound => <option key={sound.id} value={sound.id}>{sound.label}</option>)}</select><select value={volume} onChange={event => onVolumeChange(event.target.value as ActivePlan['notificationSoundVolumes'][keyof ActivePlan['notificationSoundVolumes']])}>{notificationSoundVolumes.map(level => <option key={level.id} value={level.id}>{level.label}</option>)}</select><button type="button" onClick={() => onPreview(value, volume)}>Preview</button></span>; }

function MusicPlayer({ label, isPlaying, position, duration, onToggle, onSeek, compact = false }: { label: string; isPlaying: boolean; position: number; duration: number; onToggle: () => void; onSeek: (position: number) => void; compact?: boolean }) {
  const hasDuration = duration > 0;
  return <section className={`music-player ${compact ? 'music-player-compact' : ''}`} onClick={event => event.stopPropagation()}><button className="music-toggle" onClick={onToggle}><span>NOW PLAYING</span><strong>{label}</strong><b>{isPlaying ? '❚❚ Pause' : '▶ Play'}</b></button>{!compact && <div className="music-seek"><input type="range" min="0" max={hasDuration ? duration : 1} step="0.1" value={hasDuration ? Math.min(position, duration) : 0} disabled={!hasDuration} aria-label="Music position" onChange={event => onSeek(Number(event.target.value))} /><span>{formatTime(Math.floor(position))} / {hasDuration ? formatTime(Math.floor(duration)) : '--:--'}</span></div>}</section>;
}

function ProgressIndicators({ intervalProgress, phaseProgress, cycleLabel }: { intervalProgress: number; phaseProgress: number; cycleLabel: string }) {
  return <div className="progress-indicators"><div><span>THIS INTERVAL</span><i><b style={{ width: `${intervalProgress * 100}%` }} /></i></div><div><span>{cycleLabel}</span><i><b style={{ width: `${phaseProgress * 100}%` }} /></i></div></div>;
}

function SimpleRaceScreen({ phase, phaseLabel, intervalMode, intervalLeft, intervalProgress, phaseProgress, cycleLabel, gelLeft, paused, trackLabel, musicPlaying, musicPosition, musicDuration, onToggleMusic, onSeekMusic }: { phase: Phase; phaseLabel: string; intervalMode: string; intervalLeft: string; intervalProgress: number; phaseProgress: number; cycleLabel: string; gelLeft: string; paused: boolean; trackLabel: string; musicPlaying: boolean; musicPosition: number; musicDuration: number; onToggleMusic: () => void; onSeekMusic: (position: number) => void }) {
  return <section className="simple-race-screen"><span className="phase-count">{phaseLabel}</span><h1>{phase.name}</h1><span className="miles">{phase.miles}</span><div className="simple-interval"><span>{paused ? 'PAUSED' : intervalMode}</span><strong>{intervalLeft}</strong><small>{paused ? 'Open full controls to resume' : 'Until your next switch'}</small></div><ProgressIndicators intervalProgress={intervalProgress} phaseProgress={phaseProgress} cycleLabel={cycleLabel} /><div className="simple-gel"><i /> GEL IN <b>{gelLeft}</b></div><MusicPlayer label={trackLabel} isPlaying={musicPlaying} position={musicPosition} duration={musicDuration} onToggle={onToggleMusic} onSeek={onSeekMusic} compact /></section>;
}
