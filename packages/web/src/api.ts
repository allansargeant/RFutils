/**
 * Browser-side client for the RFutils server. Replaces MicWizard's Electron
 * `window.micMonitor` IPC bridge: file conversion + Companion actions go over
 * REST (/api), live device state arrives over a WebSocket (/ws).
 */

import type {
  CompanionStatus,
  CoordinationList,
  CrosspointRequest,
  DetectedFormat,
  ExportFormat,
  ExportFormatInfo,
  FieldMapping,
  PmseConversion,
  ServerToClientEvent,
  CoordinationParams,
  CoordinationResult,
  AnalysisResult,
} from '@rfutils/shared';

async function asJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export interface ConvertResponse {
  format: DetectedFormat;
  filename: string;
  channelCount: number;
  list: CoordinationList;
  exportFormats: ExportFormatInfo[];
  header?: string[];
  suggestedMapping?: FieldMapping;
}

export async function convertFile(file: File, mapping?: FieldMapping): Promise<ConvertResponse> {
  const form = new FormData();
  form.append('file', file);
  if (mapping) form.append('mapping', JSON.stringify(mapping));
  return asJson<ConvertResponse>(await fetch('/api/convert', { method: 'POST', body: form }));
}

export async function exportModel(list: CoordinationList, format: ExportFormat): Promise<Blob> {
  const res = await fetch('/api/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ list, format }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Export failed (${res.status})`);
  }
  return res.blob();
}

export async function convertPmsePdf(file: File): Promise<PmseConversion> {
  const form = new FormData();
  form.append('file', file);
  return asJson<PmseConversion>(await fetch('/api/pmse/convert', { method: 'POST', body: form }));
}

export async function coordinateFrequencies(
  count: number,
  params: CoordinationParams,
  names?: string[]
): Promise<CoordinationResult> {
  return asJson<CoordinationResult>(
    await fetch('/api/coordinate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count, params, names }),
    })
  );
}

export async function analyzeFrequencies(
  frequencies: number[],
  params: CoordinationParams
): Promise<AnalysisResult> {
  return asJson<AnalysisResult>(
    await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frequencies, params }),
    })
  );
}

export async function companionStatus(): Promise<CompanionStatus> {
  return asJson<CompanionStatus>(await fetch('/api/companion/status'));
}

export interface AudioModeInfo {
  mode: 'capture' | 'direct';
  cueBusConfigured: boolean;
}

export async function audioMode(): Promise<AudioModeInfo> {
  return asJson<AudioModeInfo>(await fetch('/api/audio/mode'));
}

export async function makeCrosspoint(request: CrosspointRequest): Promise<void> {
  await asJson(
    await fetch('/api/companion/make-crosspoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
  );
}

export async function clearCrosspoint(
  destinationChannel: string,
  destinationDevice: string
): Promise<void> {
  await asJson(
    await fetch('/api/companion/clear-crosspoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destinationChannel, destinationDevice }),
    })
  );
}

/**
 * Subscribe to live device events over WebSocket. Reconnects automatically.
 * Returns a disconnect function.
 */
export function connectDeviceSocket(
  onEvent: (event: ServerToClientEvent) => void,
  onOpenChange?: (open: boolean) => void
): () => void {
  let socket: WebSocket | null = null;
  let closed = false;
  let retry: ReturnType<typeof setTimeout> | null = null;

  const open = () => {
    if (closed) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    socket = new WebSocket(`${proto}://${location.host}/ws`);
    socket.onopen = () => onOpenChange?.(true);
    socket.onmessage = (ev) => {
      try {
        onEvent(JSON.parse(ev.data) as ServerToClientEvent);
      } catch {
        /* ignore malformed frames */
      }
    };
    socket.onclose = () => {
      onOpenChange?.(false);
      if (!closed) retry = setTimeout(open, 2000);
    };
    socket.onerror = () => socket?.close();
  };
  open();

  return () => {
    closed = true;
    if (retry) clearTimeout(retry);
    socket?.close();
  };
}
