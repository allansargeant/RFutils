import { useState } from 'react';
import type {
  ChannelField,
  ExportFormat,
  ExportFormatInfo,
  FieldMapping,
} from '@rfutils/shared';
import { EXPORT_FORMATS } from '@rfutils/shared';
import { convertFile, exportModel, type ConvertResponse } from '../api.js';
import { FileDrop } from '../components/FileDrop.js';
import { PmseConvert } from './PmseConvert.js';

type Mode = 'coordination' | 'pmse';

const FORMAT_LABELS: Record<string, string> = {
  'wwb-xml': 'Shure WWB (.shw / .cws)',
  'wsm-xml': 'Sennheiser WSM project (.wsm)',
  'wsm-html': 'WSM Coordination Report (HTML)',
  wsm: 'WSM Frequencies/Bands (CSV)',
  'wwb-report': 'WWB Coordination Report (CSV)',
  'wwb-frequency-list': 'WWB frequency list',
  'pmse-pdf': 'Ofcom PMSE licence (PDF)',
  generic: 'Generic CSV (needs column mapping)',
};

const MAPPING_FIELDS: ChannelField[] = [
  'name',
  'frequencyMhz',
  'group',
  'channel',
  'deviceType',
  'manufacturer',
  'notes',
  'zone',
];

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ConvertTab(): JSX.Element {
  const [mode, setMode] = useState<Mode>('coordination');

  return (
    <div className="tab-panel">
      <div className="segmented">
        <button
          className={mode === 'coordination' ? 'segmented__btn segmented__btn--active' : 'segmented__btn'}
          onClick={() => setMode('coordination')}
        >
          Coordination files (WSM · WWB · CSV)
        </button>
        <button
          className={mode === 'pmse' ? 'segmented__btn segmented__btn--active' : 'segmented__btn'}
          onClick={() => setMode('pmse')}
        >
          Ofcom PMSE licence (PDF)
        </button>
      </div>
      {mode === 'coordination' ? <CoordinationConvert /> : <PmseConvert onDownload={download} />}
    </div>
  );
}

function CoordinationConvert(): JSX.Element {
  const [result, setResult] = useState<ConvertResponse | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('wwb-frequency-list');
  const [busy, setBusy] = useState(false);

  const runConvert = async (f: File, m?: FieldMapping): Promise<void> => {
    setBusy(true);
    setError(null);
    setStatus(`Parsing ${f.name}…`);
    try {
      const res = await convertFile(f, m);
      setResult(res);
      if (res.suggestedMapping) setMapping(res.suggestedMapping);
      setStatus(
        `Detected ${FORMAT_LABELS[res.format] ?? res.format} — ${res.channelCount} channel(s).`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResult(null);
      setStatus('');
    } finally {
      setBusy(false);
    }
  };

  const onPick = (f: File | undefined): void => {
    if (!f) return;
    setFile(f);
    void runConvert(f);
  };

  const remapAndConvert = (field: ChannelField, colIndex: number | null): void => {
    const next = { ...mapping, [field]: colIndex };
    setMapping(next);
    if (file) void runConvert(file, next);
  };

  const doExport = async (): Promise<void> => {
    if (!result) return;
    setError(null);
    try {
      const info = EXPORT_FORMATS.find((x) => x.id === exportFormat)!;
      const blob = await exportModel(result.list, exportFormat);
      download(blob, `rfutils-export.${info.extension}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const selectedInfo: ExportFormatInfo | undefined = EXPORT_FORMATS.find((x) => x.id === exportFormat);

  return (
    <>
      <FileDrop
        accept=".shw,.cws,.wsm,.csv,.html,.htm,.txt,text/csv,text/html,text/plain,application/xml"
        label="Drop a WWB / WSM export or CSV here, or click to choose"
        onPick={onPick}
      />
      {status && <p className="status">{status}</p>}
      {error && <p className="status status--error">{error}</p>}

      {result?.format === 'generic' && result.header && (
        <div className="mapping">
          <h3>Map columns</h3>
          <p className="mapping__hint">
            This file wasn't a recognised vendor format, so tell RFutils which column is which.
          </p>
          <div className="mapping__grid">
            {MAPPING_FIELDS.map((field) => (
              <label key={field} className="mapping__field">
                {field}
                <select
                  value={mapping[field] ?? ''}
                  onChange={(e) =>
                    remapAndConvert(field, e.target.value === '' ? null : Number(e.target.value))
                  }
                >
                  <option value="">—</option>
                  {result.header!.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `column ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      )}

      {result && result.channelCount > 0 && (
        <>
          <div className="export-bar">
            <label>
              Export as
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
              >
                {EXPORT_FORMATS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                    {f.experimental ? ' — experimental' : ''}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn btn--primary" onClick={doExport} disabled={busy}>
              Download
            </button>
          </div>
          {selectedInfo?.note && (
            <p className={`export-note${selectedInfo.experimental ? ' export-note--warn' : ''}`}>
              {selectedInfo.experimental ? '⚠ ' : ''}
              {selectedInfo.note}
            </p>
          )}
          <ChannelTable list={result.list} />
        </>
      )}
    </>
  );
}

function ChannelTable({ list }: { list: ConvertResponse['list'] }): JSX.Element {
  const rows = list.channels.slice(0, 200);
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Freq (MHz)</th>
            <th>Zone</th>
            <th>Group</th>
            <th>Ch</th>
            <th>Type</th>
            <th>Manufacturer</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => (
            <tr key={i}>
              <td>{c.name}</td>
              <td className="mono">{c.frequencyMhz.toFixed(3)}</td>
              <td>{c.zone ?? ''}</td>
              <td>{c.group ?? ''}</td>
              <td>{c.channel ?? ''}</td>
              <td>{c.deviceType ?? ''}</td>
              <td>{c.manufacturer ?? ''}</td>
              <td>{c.notes ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.channels.length > rows.length && (
        <p className="table-more">…and {list.channels.length - rows.length} more</p>
      )}
    </div>
  );
}
