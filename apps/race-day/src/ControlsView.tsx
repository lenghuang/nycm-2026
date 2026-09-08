import { MusicPlayer } from './MusicPlayer';
import { RaceMetrics } from './RaceMetrics';
import { formatTime } from './plan';
import type { RaceProjection } from './race-projection';
import type { Phase } from './types';

export function ControlsView({
  projection,
  phaseIndex,
  phaseCount,
  phaseLabel,
  next,
  paused,
  bindSwipe,
  onPhase,
  onJump,
  onAddCycle,
  onLogGel,
  showMusic,
  trackLabel,
  musicPlaying,
  musicPosition,
  musicDuration,
  onToggleMusic,
  onSeekMusic,
}: {
  projection: RaceProjection;
  phaseIndex: number;
  phaseCount: number;
  phaseLabel: string;
  next?: Phase;
  paused: boolean;
  bindSwipe: Record<string, unknown>;
  onPhase: (change: number) => void;
  onJump: (direction: -1 | 1) => void;
  onAddCycle: () => void;
  onLogGel: () => void;
  showMusic: boolean;
  trackLabel: string;
  musicPlaying: boolean;
  musicPosition: number;
  musicDuration: number;
  onToggleMusic: () => void;
  onSeekMusic: (position: number) => void;
}) {
  const { phase, interval, gel, cycles, phaseProgress, effectivePlannedCycles } = projection;
  return (
    <>
      <section className="body" {...bindSwipe}>
        <span className="phase-count">{phaseLabel}</span>
        <h1>{phase.name}</h1>
        <span className="miles">{phase.miles}</span>
        <p className="note">{phase.note}</p>
        <div className="interval">
          <span className="mode">{interval.mode}</span>
          <strong>{formatTime(interval.left)}</strong>
          {paused && <span className="paused">PAUSED</span>}
          <RaceMetrics
            intervalProgress={interval.progress}
            phaseProgress={phaseProgress}
            cycleLabel={`CYCLE ${Math.min(effectivePlannedCycles, cycles.done + 1)} OF ${effectivePlannedCycles}`}
          />
          <button
            className="gel-action"
            disabled={paused}
            onClick={(event) => {
              event.stopPropagation();
              onLogGel();
            }}
          >
            <i /> GEL IN <b>{formatTime(gel.left)}</b>
            <small>LOG EARLY</small>
          </button>
          {showMusic && (
            <MusicPlayer
              label={trackLabel}
              isPlaying={musicPlaying}
              position={musicPosition}
              duration={musicDuration}
              onToggle={onToggleMusic}
              onSeek={onSeekMusic}
            />
          )}
          <div className="cue-controls">
            <button
              onClick={(event) => {
                event.stopPropagation();
                onJump(-1);
              }}
            >
              ↶ Previous interval
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                onJump(1);
              }}
            >
              Next interval ↷
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                onAddCycle();
              }}
            >
              ＋ Add cycle
            </button>
          </div>
          <span className="tap-hint">Tap to {paused ? 'resume' : 'pause'} · swipe left/right to change phase</span>
        </div>
      </section>
      <footer className="phase-footer">
        <span className="phase-skip">
          PHASE
          <br />
          <b>
            {phaseIndex + 1} / {phaseCount}
          </b>
        </span>
        <span className="controls">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onPhase(-1);
            }}
            aria-label="Previous phase"
          >
            ←
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onPhase(1);
            }}
            aria-label={next ? 'Next phase' : 'Finish race'}
          >
            {next ? '→' : '✓'}
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
  );
}
