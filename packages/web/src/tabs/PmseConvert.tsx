import { useState } from 'react';
import type { PmseConversion } from '@rfwizard/shared';
import { convertPmsePdf } from '../api.js';
import { FileDrop } from '../components/FileDrop.js';

/** Ofcom PMSE licence PDF → WWB files (frequency list, reference CSV, .shw). */
export function PmseConvert({
  onDownload,
}: {
  onDownload: (blob: Blob, filename: string) => void;
}): JSX.Element {
  const [result, setResult] = useState<PmseConversion | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onPick = async (f: File | undefined): Promise<void> => {
    if (!f) return;
    setStatus(`Parsing ${f.name}…`);
    setError(null);
    setResult(null);
    try {
      const res = await convertPmsePdf(f);
      setResult(res);
      setStatus(`Parsed ${res.assignmentCount} frequency assignment(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('');
    }
  };

  return (
    <>
      <FileDrop
        accept="application/pdf,.pdf"
        label="Drop an Ofcom PMSE licence schedule PDF here, or click to choose"
        onPick={(f) => void onPick(f)}
      />
      {status && <p className="status">{status}</p>}
      {error && <p className="status status--error">{error}</p>}

      {result && (
        <>
          {result.warnings.map((w, i) => (
            <p className="callout callout--warn" key={i}>
              {w}
            </p>
          ))}

          <dl className="meta">
            <dt>Licence No.</dt>
            <dd>{result.metadata.licenceNo || '—'}</dd>
            <dt>Licensee</dt>
            <dd>{result.metadata.licensee || '—'}</dd>
            <dt>Address</dt>
            <dd>{result.metadata.licenseeAddress || '—'}</dd>
            <dt>Period</dt>
            <dd>
              {result.metadata.licenceStart || '?'} – {result.metadata.licenceEnd || '?'}
            </dd>
            <dt>PMSE ref.</dt>
            <dd>{result.metadata.pmseRef || '—'}</dd>
          </dl>

          <div className="downloads">
            <button
              className="btn"
              onClick={() =>
                onDownload(
                  new Blob([result.wwbFrequencyList], { type: 'text/plain' }),
                  'wwb-frequency-list.txt'
                )
              }
            >
              WWB frequency list (.txt)
            </button>
            <button
              className="btn"
              onClick={() =>
                onDownload(
                  new Blob([result.referenceCsv], { type: 'text/csv' }),
                  'frequency-reference.csv'
                )
              }
            >
              Reference sheet (.csv)
            </button>
            <button
              className="btn btn--warn"
              onClick={() =>
                onDownload(
                  new Blob([result.wwbShowFile], { type: 'application/xml' }),
                  'wwb-import.shw'
                )
              }
            >
              WWB7 show file (.shw) — experimental
            </button>
          </div>
          <p className="export-note">
            The frequency list is the safe file to import directly into Wireless Workbench (Import ›
            frequencies from file). The reference sheet maps each frequency to a suggested name and
            its coordination group.
          </p>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Freq (MHz)</th>
                  <th>Equipment</th>
                  <th>Model</th>
                  <th>Group</th>
                  <th>Site</th>
                </tr>
              </thead>
              <tbody>
                {result.assignments.slice(0, 200).map((a, i) => (
                  <tr key={i}>
                    <td className="mono">{a.frequencyMhz.toFixed(3)}</td>
                    <td>{a.equipmentType}</td>
                    <td>{a.model}</td>
                    <td>{a.feeCategory}</td>
                    <td>{a.site}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
