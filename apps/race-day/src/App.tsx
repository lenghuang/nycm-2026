import { useCallback, useEffect, useRef, useState } from 'react';
import { getPreset, planFromPreset, presets } from './configs';
import { cueJumpOffset, cycleSummaryFor, elapsed, formatTime, gelFor, intervalFor } from './plan';
import { loadPlan, loadRace, savePlan, saveRace } from './storage';
import { themeFor } from './theme';
import { scheduleLockedScreenTest } from './native-notifications';
import type { CSSProperties } from 'react';
import type { ActivePlan, EffortLevel, MusicCue, Phase, RaceState } from './types';

type RaceStyle = CSSProperties & { '--accent': string; '--deep': string };
type CardStyle = CSSProperties & { '--card-accent': string };

export default function App() {
  const [activePlan, setActivePlan] = useState<ActivePlan>(loadPlan);
  const [race, setRace] = useState<RaceState>(loadRace);
  const [currentTime, setCurrentTime] = useState(Date.now);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [draft, setDraft] = useState<ActivePlan | null>(null);
  const plan = activePlan.phases;
  const planRef = useRef(plan);
  const raceRef = useRef(race);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const keepAliveStarted = useRef(false);
  const touchX = useRef<number | null>(null);
  const suppressTapUntil = useRef(0);

  useEffect(() => { planRef.current = plan; savePlan(activePlan); }, [activePlan, plan]);
  const commitRace = useCallback((next: RaceState) => { raceRef.current = next; setRace(next); saveRace(next); }, []);

  const unlockAudio = useCallback(() => {
    if (!audioContextRef.current) {
      const Context = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Context) audioContextRef.current = new Context();
    }
    void audioContextRef.current?.resume();
    if (!keepAliveStarted.current && audioRef.current) {
      audioRef.current.src = './race-day.mp3';
      audioRef.current.loop = true;
      audioRef.current.volume = 0;
      void audioRef.current.play().catch(() => undefined);
      keepAliveStarted.current = true;
    }
  }, []);
  const startMusic = () => {
    unlockAudio();
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.volume = 0.78;
    void audio.play().catch(() => undefined);
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
    const next: RaceState = { ...raceRef.current, phase, anchor: Date.now(), pausedAt: null, pausedTotal: 0, gelFired: 0, begun, lastInterval: undefined };
    next.lastInterval = intervalFor(nextPlan, next, Date.now()).key;
    return next;
  };
  const startRace = () => {
    unlockAudio();
    if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission().catch(() => undefined);
    commitRace(resetTiming(race.phase, plan, true));
  };
  const testLockedScreenCue = async () => setTestStatus(await scheduleLockedScreenTest());
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
    if (plan[phase]?.music === 'START') startMusic();
  };
  const jumpCue = (direction: -1 | 1) => {
    const now = Date.now();
    const offset = Math.max(-elapsed(race, now), cueJumpOffset(plan, race, now, direction));
    const next: RaceState = { ...race, anchor: race.anchor - offset, lastInterval: undefined };
    next.lastInterval = intervalFor(plan, next, now).key;
    commitRace(next);
    beep(direction === 1 ? 720 : 420, 0.1);
  };
  const openSettings = () => { setDraft({ presetId: activePlan.presetId, phases: plan.map(phase => ({ ...phase })) }); setSettingsOpen(true); };
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
  const next = plan[race.phase + 1];
  const preset = getPreset(activePlan.presetId);
  const theme = themeFor(phase.effort);
  const style: RaceStyle = { '--accent': theme.accent, '--deep': theme.deep };

  return <main className="race" style={style}
    onClick={event => { if (!(event.target as Element).closest('button') && Date.now() > suppressTapUntil.current) togglePause(); }}
    onTouchStart={event => { touchX.current = event.changedTouches[0]?.clientX ?? null; }}
    onTouchEnd={event => { const end = event.changedTouches[0]?.clientX; if (touchX.current === null || end === undefined) return; const delta = end - touchX.current; touchX.current = null; if (Math.abs(delta) > 60) { suppressTapUntil.current = Date.now() + 500; changePhase(delta < 0 ? 1 : -1); } }}>
    <audio ref={audioRef} loop playsInline preload="auto" />
    <header className="top"><span className="brand">NYC · RACE DAY</span><button className="icon-button" aria-label="Open settings" onClick={openSettings}>⚙</button></header>
    <section className="body"><span className="phase-count">{preset.isTest ? 'TEST CONFIG' : `PHASE ${race.phase + 1} / ${plan.length}`} · {theme.label}</span><h1>{phase.name}</h1><span className="miles">{phase.miles}</span>{phase.music === 'START' && <span className="music-cue">♫ MUSIC STARTS HERE</span>}<p className="note">{phase.note}</p>
      <div className="interval"><span className="mode">{interval.mode}</span><strong>{formatTime(interval.left)}</strong>{race.pausedAt && <span className="paused">PAUSED</span>}<div className="cycle-summary"><span>INTERVALS DONE <b>{cycles.done} / {phase.plannedCycles}</b></span><span><b>{cycles.left}</b> LEFT</span></div><div className="cue-controls"><button onClick={event => { event.stopPropagation(); jumpCue(-1); }}>↶ Previous cue</button><button onClick={event => { event.stopPropagation(); jumpCue(1); }}>Next cue ↷</button></div><span className="tap-hint">Tap anywhere to {race.pausedAt ? 'resume' : 'pause'}</span></div>
    </section>
    <footer><span className="gel"><i /> GEL <b>in {formatTime(gel.left)}</b></span><span className="controls"><button onClick={event => { event.stopPropagation(); changePhase(-1); }} aria-label="Previous phase">←</button><button onClick={event => { event.stopPropagation(); changePhase(1); }} aria-label="Next phase">→</button></span><span className="next">{next ? <>NEXT<br />{next.name}</> : <>FINISH<br />STRONG</>}</span></footer>
    {!race.begun && <div className="intro"><div className="intro-actions"><button className="start" onClick={startRace}>Start race day<small>Sound + reminders activate after one tap</small></button><button className="native-test" onClick={testLockedScreenCue}>Test locked-screen cue<small>Schedules one native notification in 10 seconds</small></button>{testStatus && <p className="test-status">{testStatus}</p>}</div></div>}
    {settingsOpen && draft && <Settings activePlan={draft} setPlan={setDraft} onClose={() => setSettingsOpen(false)} onSave={saveSettings} onLoadPreset={id => setDraft(planFromPreset(id))} onReset={() => setDraft(planFromPreset(draft.presetId))} />}
  </main>;
}

function Settings({ activePlan, setPlan, onClose, onSave, onLoadPreset, onReset }: { activePlan: ActivePlan; setPlan: (plan: ActivePlan) => void; onClose: () => void; onSave: () => void; onLoadPreset: (id: string) => void; onReset: () => void }) {
  const preset = getPreset(activePlan.presetId);
  const unitMs = preset.isTest ? 1_000 : 60_000;
  const unit = preset.isTest ? 'seconds' : 'minutes';
  const theme = (phase: Phase): CardStyle => { const colors = themeFor(phase.effort); return { '--card-accent': colors.accent }; };
  const update = (index: number, field: keyof Phase, value: string | number) => setPlan({ ...activePlan, phases: activePlan.phases.map((phase, itemIndex) => itemIndex === index ? { ...phase, [field]: value } : phase) });
  return <section className="sheet" aria-label="Race plan settings" onClick={event => event.stopPropagation()}><header><h2>Race plan</h2><button onClick={onClose}>Done</button></header><p>Load a configuration to replace this draft. Saving resets the current phase’s interval and gel clock.</p>
    <div className="config-picker"><label>Configuration<select value={activePlan.presetId} onChange={event => onLoadPreset(event.target.value)}>{presets.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><span>{preset.description}</span></div>
    {activePlan.phases.map((phase, index) => <article className="phase-card" key={index} style={theme(phase)}><h3>{index + 1}. {phase.name}</h3><div className="fields">
      <Field label="Phase name"><input value={phase.name} onChange={event => update(index, 'name', event.target.value)} /></Field><Field label="Mile range"><input value={phase.miles} onChange={event => update(index, 'miles', event.target.value)} /></Field><Field label="Effort level"><select value={phase.effort} onChange={event => update(index, 'effort', event.target.value as EffortLevel)}>{(['RECOVERY', 'CONTROLLED', 'SURGE', 'FINISH', 'TEST'] as EffortLevel[]).map(level => <option key={level}>{level}</option>)}</select></Field><Field label="Start with"><select value={phase.startsWith} onChange={event => update(index, 'startsWith', event.target.value)}><option>RUN</option><option>WALK</option></select></Field><Field label="Music cue" wide><select value={phase.music} onChange={event => update(index, 'music', event.target.value as MusicCue)}><option value="NONE">No change</option><option value="START">Start the bundled track</option></select></Field>
      <Field label="Effort / vibe note" wide><textarea value={phase.note} onChange={event => update(index, 'note', event.target.value)} /></Field><Field label={`Run ${unit}`}><input type="number" min="1" max="999" value={phase.runDurationMs / unitMs} onChange={event => update(index, 'runDurationMs', Number(event.target.value) * unitMs)} /></Field><Field label={`Walk ${unit}`}><input type="number" min="1" max="999" value={phase.walkDurationMs / unitMs} onChange={event => update(index, 'walkDurationMs', Number(event.target.value) * unitMs)} /></Field><Field label="Planned intervals"><input type="number" min="1" max="999" value={phase.plannedCycles} onChange={event => update(index, 'plannedCycles', Number(event.target.value))} /></Field><Field label={`Gel every (${unit})`} wide><input type="number" min="1" max="999" value={phase.gelIntervalMs / unitMs} onChange={event => update(index, 'gelIntervalMs', Number(event.target.value) * unitMs)} /></Field>
    </div></article>)}
    <div className="settings-actions"><button className="reset" onClick={onReset}>Reset configuration</button><button className="save" onClick={onSave}>Save plan</button></div>
  </section>;
}
function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={wide ? 'wide' : ''}>{label}{children}</label>; }
