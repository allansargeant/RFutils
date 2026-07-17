import { useState } from 'react';
import type {
  CoordinationParams,
  CoordinationResult,
  AnalysisResult,
  FreqRange,
  ExportFormat,
} from '@rfutils/shared';
import { defaultCoordinationParams, EXPORT_FORMATS } from '@rfutils/shared';
import { coordinateFrequencies, analyzeFrequencies, exportModel } from '../api.js';
import { usePlanStore } from '../planStore.js';

function parseRanges(text: string): FreqRange[] {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((seg) => {
      const [a, b] = seg.split('-').map((x) => Number(x.trim()));
      return { startMhz: a ?? 0, endMhz: b ?? a ?? 0 };
    })
    .filter((r) => r.startMhz > 0 && r.endMhz >= r.startMhz);
}

function parseFreqList(text: string): number[] {
  return text
    .split(/[,\s]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function download(text: string, filename: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function CoordinationTab(): JSX.Element {
  const d = defaultCoordinationParams();
  const [rangesText, setRangesText] = useState('606.5-614');
  const [exclusionsText, setExclusionsText] = useState('');
  const [lockedText, setLockedText] = useState('');
  const [count, setCount] = useState(8);
  const [spacing, setSpacing] = useState(d.minSpacingMhz);
  const [step, setStep] = useState(d.stepMhz);
  const [imGuard, setImGuard] = useState(d.imGuardMhz);
  const [exGuard, setExGuard] = useState(d.exclusionGuardMhz);
  const [thirdOrder, setThirdOrder] = useState(true);
  const [fifthOrder, setFifthOrder] = useState(false);

  const [result, setResult] = useState<CoordinationResult | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('wwb-frequency-list');

  const buildParams = (): CoordinationParams => ({
    ranges: parseRanges(rangesText),
    stepMhz: step,
    minSpacingMhz: spacing,
    exclusionGuardMhz: exGuard,
    imGuardMhz: imGuard,
    thirdOrder,
    fifthOrder,
    exclusions: parseRanges(exclusionsText),
    locked: parseFreqList(lockedText),
    seed: 1,
  });

  const run = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    setAnalysis(null);
    try {
      const res = await coordinateFrequencies(count, buildParams());
      setResult(res);
      usePlanStore.getState().setCoordination(res); // share with Allocation/Deployment
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const runAnalyze = async (): Promise<void> => {
    if (!result) return;
    setBusy(true);
    setError(null);
    try {
      const a = await analyzeFrequencies(
        result.assigned.map((x) => x.frequencyMhz),
        buildParams()
      );
      setAnalysis(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const doExport = async (): Promise<void> => {
    if (!result) return;
    try {
      const list = {
        channels: result.assigned.map((a) => ({ name: a.name, frequencyMhz: a.frequencyMhz })),
        sourceFormat: 'coordination',
      };
      const info = EXPORT_FORMATS.find((f) => f.id === exportFormat)!;
      const blob = await exportModel(list, exportFormat);
      download(await blob.text(), `coordination.${info.extension}`, info.mimeType);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="tab-panel">
      <p className="tab-panel__intro">
        Compute a set of mutually-compatible frequencies — spaced, clear of excluded spectrum, and
        free of third/fifth-order intermodulation products.
      </p>

      <div className="coord-form">
        <label className="field field--wide">
          <span>
            Tuning ranges — MHz, e.g. <code>606.5-614, 470-478</code>
          </span>
          <input value={rangesText} onChange={(e) => setRangesText(e.target.value)} />
        </label>
        <label className="field">
          How many
          <input type="number" min={1} value={count} onChange={(e) => setCount(Number(e.target.value))} />
        </label>
        <label className="field">
          Min spacing (MHz)
          <input type="number" step="0.025" value={spacing} onChange={(e) => setSpacing(Number(e.target.value))} />
        </label>
        <label className="field">
          Grid step (MHz)
          <input type="number" step="0.005" value={step} onChange={(e) => setStep(Number(e.target.value))} />
        </label>
        <label className="field">
          IM guard (MHz)
          <input type="number" step="0.005" value={imGuard} onChange={(e) => setImGuard(Number(e.target.value))} />
        </label>
        <label className="field">
          Exclusion guard (MHz)
          <input type="number" step="0.005" value={exGuard} onChange={(e) => setExGuard(Number(e.target.value))} />
        </label>
        <label className="field field--wide">
          <span>
            Exclusions — MHz ranges, e.g. <code>500-510, 520.5-521</code>
          </span>
          <input value={exclusionsText} onChange={(e) => setExclusionsText(e.target.value)} />
        </label>
        <label className="field field--wide">
          Locked / existing (MHz, comma-separated)
          <input value={lockedText} onChange={(e) => setLockedText(e.target.value)} />
        </label>
        <label className="field field--check">
          <input type="checkbox" checked={thirdOrder} onChange={(e) => setThirdOrder(e.target.checked)} />
          Avoid 3rd-order IM
        </label>
        <label className="field field--check">
          <input type="checkbox" checked={fifthOrder} onChange={(e) => setFifthOrder(e.target.checked)} />
          Avoid 5th-order IM
        </label>
      </div>

      <div className="export-bar">
        <button className="btn btn--primary" onClick={run} disabled={busy}>
          {busy ? 'Coordinating…' : 'Coordinate'}
        </button>
        {result && (
          <button className="btn" onClick={runAnalyze} disabled={busy}>
            Re-check conflicts
          </button>
        )}
      </div>
      {error && <p className="status status--error">{error}</p>}

      {result && (
        <>
          <p className="status">
            Placed <strong>{result.placed}</strong> of {result.requested} requested
            {result.unplaced > 0 && <span className="status--error"> ({result.unplaced} unplaced)</span>} ·{' '}
            {result.candidateCount} candidate grid points.
          </p>
          {result.notes.map((n, i) => (
            <p className="export-note" key={i}>
              {n}
            </p>
          ))}

          <div className="export-bar">
            <label>
              Export as
              <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as ExportFormat)}>
                {EXPORT_FORMATS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                    {f.experimental ? ' — experimental' : ''}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn" onClick={doExport}>
              Download
            </button>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Frequency (MHz)</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {result.assigned.map((a, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{a.name}</td>
                    <td className="mono">{a.frequencyMhz.toFixed(3)}</td>
                    <td>{a.locked ? 'locked' : 'coordinated'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {analysis && (
            <div className={`callout ${analysis.ok ? '' : 'callout--warn'}`}>
              {analysis.ok ? (
                <strong>✓ No conflicts — {analysis.frequencyCount} frequencies are compatible.</strong>
              ) : (
                <>
                  <strong>{analysis.conflicts.length} conflict(s):</strong>
                  <ul>
                    {analysis.conflicts.slice(0, 40).map((c, i) => (
                      <li key={i}>
                        <code>{c.kind}</code> — {c.message}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
