/**
 * Shared helpers for parsing frequency values that show up in the wild.
 * Ported verbatim in behaviour from wsm-wwb-bridge/freq_parse.py.
 *
 * RF coordination tools disagree on notation: plain MHz decimals (470.100),
 * Sennheiser's MHz.kHz style (600.768), a comma-decimal variant (600,768),
 * or raw kHz integers (600768). We normalize all of these to MHz as number.
 */

// UHF wireless mic bands run roughly 30-6000 MHz. A raw kHz value in that
// same band would be >= 30000, so this threshold cleanly separates "already
// MHz" from "still needs /1000" without needing to know the source format.
const KHZ_THRESHOLD = 3000.0;

export class FrequencyParseError extends Error {}

export function parseFrequencyToMhz(raw: string): number {
  let text = raw.trim();
  if (!text) {
    throw new FrequencyParseError('empty frequency value');
  }

  // Comma-as-decimal-separator (e.g. "600,768") vs thousands separator.
  // If there's a comma but no dot, treat the comma as a decimal point.
  if (text.includes(',') && !text.includes('.')) {
    text = text.replace(/,/g, '.');
  } else {
    text = text.replace(/,/g, '');
  }

  const value = Number(text);
  if (!Number.isFinite(value)) {
    throw new FrequencyParseError(`not a number: ${raw}`);
  }
  return value >= KHZ_THRESHOLD ? value / 1000.0 : value;
}

export function formatMhz(value: number): string {
  return value.toFixed(3);
}

export function formatKhz(valueMhz: number): string {
  return String(Math.round(valueMhz * 1000));
}

/**
 * WWB writes group/channel as 'G:-- Ch:--' (report, .cws) or '--,--'
 * (.shw device inventory). '--' means unassigned. Returns [group, channel],
 * either of which may be null.
 */
export function parseWwbGroupChannel(
  raw: string | null | undefined
): [string | null, string | null] {
  if (!raw) return [null, null];
  const trimmed = raw.trim();
  let parts: string[];
  if (trimmed.startsWith('G:')) {
    parts = trimmed.replace(/G:/g, '').replace(/Ch:/g, '').split(/\s+/);
  } else {
    parts = trimmed.split(',');
  }
  parts = parts.map((p) => p.trim());
  const group = parts.length > 0 && parts[0] !== '' && parts[0] !== '--' ? parts[0]! : null;
  const channel = parts.length > 1 && parts[1] !== '' && parts[1] !== '--' ? parts[1]! : null;
  return [group, channel];
}
