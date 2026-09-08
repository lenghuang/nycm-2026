export function RaceMetrics({
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
