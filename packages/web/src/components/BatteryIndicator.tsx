/** Ported from MicWizard. Presentational battery gauge. */
import type { JSX } from 'react';

export function BatteryIndicator({
  percent,
  minutesRemaining,
}: {
  percent: number | null;
  minutesRemaining: number | null;
}): JSX.Element {
  const level =
    percent === null ? 'unknown' : percent < 20 ? 'low' : percent < 50 ? 'medium' : 'high';

  return (
    <div className="battery-indicator" data-level={level}>
      <div className="battery-indicator__shell">
        <div className="battery-indicator__fill" style={{ width: `${percent ?? 0}%` }} />
      </div>
      <span className="battery-indicator__label">
        {percent === null ? 'No battery data' : `${percent}%`}
        {minutesRemaining !== null && ` · ${minutesRemaining}m`}
      </span>
    </div>
  );
}
