import type { CSSProperties } from 'react';
import { ControlsView } from './ControlsView';
import { NowView } from './NowView';
import { SettingsSheet } from './SettingsSheet';
import { formatTime } from './plan';
import { themeFor } from './theme';
import { useRaceController } from './use-race-controller';

type RaceStyle = CSSProperties & { '--accent': string; '--deep': string };

export default function App() {
  const controller = useRaceController();
  const { configuration, plan, race, projection, phase, music, viewMode } = controller;
  const theme = themeFor(phase.effort);
  const phaseLabel = `${configuration.plan.presetId === '10s-5s-demo' ? 'TEST CONFIG' : `PHASE ${race.phase + 1} / ${plan.length}`} · ${theme.label}`;
  const cycleLabel = `CYCLE ${Math.min(projection.effectivePlannedCycles, projection.cycles.done + 1)} OF ${projection.effectivePlannedCycles}`;
  const style: RaceStyle = { '--accent': theme.accent, '--deep': theme.deep };
  return (
    <main
      className={`race ${viewMode === 'simple' ? 'race-simple' : 'race-full'}`}
      style={style}
      onClick={(event) => {
        if (
          viewMode === 'full' &&
          !(event.target as Element).closest('button') &&
          Date.now() > controller.suppressTapUntil.current
        )
          controller.togglePause();
      }}
    >
      <audio ref={music.audioRef} loop playsInline preload="auto" />
      <header className="top">
        <span className="brand">NYC · RACE DAY</span>
        <span className="top-actions">
          <button
            className="view-button"
            onClick={() => controller.setViewMode(viewMode === 'simple' ? 'full' : 'simple')}
          >
            {viewMode === 'simple' ? 'Full controls' : 'Now view'}
          </button>
          {viewMode === 'full' && (
            <button className="icon-button" aria-label="Open settings" onClick={controller.openSettings}>
              ⚙
            </button>
          )}
        </span>
      </header>
      {viewMode === 'simple' ? (
        <NowView
          phase={phase}
          phaseLabel={phaseLabel}
          intervalMode={projection.interval.mode}
          intervalLeft={formatTime(projection.interval.left)}
          intervalProgress={projection.interval.progress}
          phaseProgress={projection.phaseProgress}
          cycleLabel={cycleLabel}
          gelLeft={formatTime(projection.gel.left)}
          paused={Boolean(race.pausedAt)}
          showMusic={controller.musicEnabled}
          trackLabel={controller.musicTrack.label}
          musicPlaying={music.isPlaying}
          musicPosition={music.position}
          musicDuration={music.duration}
          onToggleMusic={controller.toggleMusic}
          onSeekMusic={music.seek}
        />
      ) : (
        <ControlsView
          projection={projection}
          phaseIndex={race.phase}
          phaseCount={plan.length}
          phaseLabel={phaseLabel}
          next={plan[race.phase + 1]}
          paused={Boolean(race.pausedAt)}
          bindSwipe={controller.bindPhaseSwipe}
          onPhase={controller.changePhase}
          onJump={controller.jumpCue}
          onAddCycle={controller.addCycle}
          onLogGel={controller.logGelEarly}
          showMusic={controller.musicEnabled}
          trackLabel={controller.musicTrack.label}
          musicPlaying={music.isPlaying}
          musicPosition={music.position}
          musicDuration={music.duration}
          onToggleMusic={controller.toggleMusic}
          onSeekMusic={music.seek}
        />
      )}
      {!race.begun && !race.finishedAt && (
        <div className="intro">
          <div className="intro-actions">
            <button className="start" onClick={controller.startRace}>
              Start race day<small>Sound + lock-screen reminders activate after one tap</small>
            </button>
          </div>
        </div>
      )}
      {controller.recoveryPending && (
        <div className="intro recovery">
          <div className="intro-actions">
            <h2>Resume your interrupted race?</h2>
            <p>Your timer was paused while the app was away.</p>
            <button className="start" onClick={controller.resumeRecoveredRace}>
              Resume race
            </button>
            <button className="recovery-discard" onClick={controller.discardRace}>
              Discard and start over
            </button>
          </div>
        </div>
      )}
      {race.finishedAt && (
        <div className="intro finish-summary">
          <div className="intro-actions">
            <h2>Race complete</h2>
            <p>
              {phase.name} · {formatTime(Math.floor((race.finishedAt - race.anchor - race.pausedTotal) / 1000))} active
              time
            </p>
            <button className="start" onClick={controller.discardRace}>
              Start a new race
            </button>
          </div>
        </div>
      )}
      {controller.settingsOpen && controller.draft && (
        <SettingsSheet
          activePlan={controller.draft}
          libraryTracks={controller.libraryTracks}
          storageUsage={controller.storageUsage}
          setPlan={controller.setDraft}
          onAddMusic={controller.addMusicTrack}
          onRenameMusic={controller.renameMusicTrack}
          onDeleteMusic={controller.removeMusicTrack}
          onClose={() => controller.setSettingsOpen(false)}
          onSave={controller.saveSettings}
          onLoadPreset={controller.loadPreset}
          onReset={() => controller.setDraft({ ...configuration.plan, ...configuration.preferences })}
        />
      )}
    </main>
  );
}
