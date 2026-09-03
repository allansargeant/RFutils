import type { JSX } from 'react';

const MIN_DB = -60;
const MAX_DB = 0;

/** Ported from MicWizard. Presentational dB meter. */
export function LevelMeter({ label, db }: { label: string; db: number | null }): JSX.Element {
  const clamped = db === null ? MIN_DB : Math.min(MAX_DB, Math.max(MIN_DB, db));
  const percent = ((clamped - MIN_DB) / (MAX_DB - MIN_DB)) * 100;
  const zone = db === null ? 'off' : db > -3 ? 'hot' : db > -18 ? 'good' : 'low';

  return (
    <div className="level-meter">
      <span className="level-meter__label">{label}</span>
      <div className="level-meter__track">
        <div
          className={`level-meter__fill level-meter__fill--${zone}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="level-meter__value">{db === null ? '—' : `${db.toFixed(1)} dB`}</span>
    </div>
  );
}
