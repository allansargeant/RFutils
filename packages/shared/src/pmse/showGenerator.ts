/**
 * Generates a Shure Wireless Workbench 7 .shw show file.
 * Ported from pmse-to-wwb/backend/show_generator.py.
 *
 * EXPERIMENTAL: WWB's native show-file format is undocumented. This works by
 * cloning real, structurally-verified XML fragments (extracted from a working
 * WWB7 7.8.1 show file) for a Shure AD4Q-A quad receiver in the G56 band, and
 * substituting only frequency/name/identity fields. Everything else is copied
 * verbatim. Open the generated file in WWB and check it before relying on it.
 */

// Templates are inlined by scripts/gen-templates.mjs rather than read from
// disk: this module runs in the browser too (the static build), where there is
// no filesystem. The .tpl files under templates/ remain the source of truth.
import { SKELETON, DEVICE_TPL, PROFILE_TPL, FREQ_ENTRY_TPL } from './templates.generated.js';

const CHANNELS_PER_DEVICE = 4;
const FILLER_NAME = 'Unused';

const ORIG_DEVICE_ID = '83DD8AE3-F353-4378-B294-69C905285801';
const ORIG_ZONE = 'Room 8/9';
const ORIG_CHANNEL_FREQS = ['550375', '551625', '551125', '554875'];
const ORIG_CHANNEL_NAME_TAG = '<channel_name type="10"><![CDATA[Shure]]></channel_name>';

const ORIG_FE_ID = `${ORIG_DEVICE_ID}-0`;
const ORIG_FE_ZONE = 'Room 8/9';
const ORIG_FE_VALUE = '578875';
const ORIG_FE_CHANN_NUM = '0';

const ORIG_PROFILE_ZONE = 'Room 10';

/** xml.sax.saxutils.escape: escapes &, <, > only (not quotes). */
function escapeXml(text: string): string {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function cdata(text: string): string {
  const safe = String(text).replace(/]]>/g, ']] >');
  return `<![CDATA[${safe}]]>`;
}

/**
 * Uppercase RFC 4122 v4 UUID, matching what the Python original produced with
 * `str(uuid.uuid4()).upper()`. Uses Web Crypto, which both Node 19+ and every
 * target browser provide; the manual path covers older/insecure contexts where
 * `randomUUID` is absent but `getRandomValues` is not.
 */
function newId(): string {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto?.randomUUID === 'function') return webCrypto.randomUUID().toUpperCase();

  const bytes = new Uint8Array(16);
  webCrypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant 10x
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-').toUpperCase();
}

/** Python str.replace(old, new, 1) — replace only the first occurrence. */
function replaceFirst(haystack: string, needle: string, replacement: string): string {
  const idx = haystack.indexOf(needle);
  if (idx === -1) return haystack;
  return haystack.slice(0, idx) + replacement + haystack.slice(idx + needle.length);
}

export interface ShowAssignment {
  frequencyMhz: number;
  suggestedName?: string;
}

function buildDevice(
  deviceId: string,
  zone: string,
  freqsKhz: string[],
  names: string[]
): string {
  let block = replaceFirst(
    DEVICE_TPL,
    `<id dcid="04DFAE08-FD5A-11E3-A18A-0015C5F3F612">${ORIG_DEVICE_ID}</id>`,
    `<id dcid="04DFAE08-FD5A-11E3-A18A-0015C5F3F612">${deviceId}</id>`
  );
  block = replaceFirst(
    block,
    `<zone type="12">${ORIG_ZONE}</zone>`,
    `<zone type="12">${escapeXml(zone)}</zone>`
  );

  const parts = block.split(ORIG_CHANNEL_NAME_TAG);
  if (parts.length !== CHANNELS_PER_DEVICE + 1) {
    throw new Error('device template channel_name pattern not found as expected');
  }
  let rebuilt = parts[0]!;
  for (let i = 0; i < CHANNELS_PER_DEVICE; i++) {
    const name = i < names.length ? names[i]! : FILLER_NAME;
    rebuilt += `<channel_name type="10">${cdata(name)}</channel_name>`;
    rebuilt += parts[i + 1]!;
  }
  block = rebuilt;

  for (let i = 0; i < ORIG_CHANNEL_FREQS.length; i++) {
    const origFreq = ORIG_CHANNEL_FREQS[i]!;
    const freq = i < freqsKhz.length ? freqsKhz[i]! : origFreq;
    block = replaceFirst(
      block,
      `<frequency type="3">${origFreq}</frequency>`,
      `<frequency type="3">${freq}</frequency>`
    );
  }
  return block;
}

function buildFreqEntry(deviceId: string, index: number, freqKhz: string, zone: string): string {
  const feId = `${deviceId}-${index}`;
  let block = replaceFirst(FREQ_ENTRY_TPL, `id="${ORIG_FE_ID}"`, `id="${feId}"`);
  block = replaceFirst(block, `<zone>${ORIG_FE_ZONE}</zone>`, `<zone>${escapeXml(zone)}</zone>`);
  block = replaceFirst(block, `<value>${ORIG_FE_VALUE}</value>`, `<value>${freqKhz}</value>`);
  block = replaceFirst(
    block,
    `<chann_num>${ORIG_FE_CHANN_NUM}</chann_num>`,
    `<chann_num>${index}</chann_num>`
  );
  block = replaceFirst(block, `<source_id>${ORIG_FE_ID}</source_id>`, `<source_id>${feId}</source_id>`);
  return block;
}

function buildProfile(zone: string): string {
  return replaceFirst(
    PROFILE_TPL,
    `<zone>${ORIG_PROFILE_ZONE}</zone>`,
    `<zone>${escapeXml(zone)}</zone>`
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const pad2 = (n: number) => String(n).padStart(2, '0');

/** strftime "%a %b %d %Y" */
function formatDate(d: Date): string {
  return `${WEEKDAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${pad2(d.getDate())} ${d.getFullYear()}`;
}
/** strftime "%H:%M:%S" */
function formatTime(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

export interface GenerateShowOptions {
  showName?: string;
  customer?: string;
  pocName?: string;
  venueName?: string;
  venueAddress?: string;
  now?: Date;
}

export function generateShow(
  assignments: ShowAssignment[],
  opts: GenerateShowOptions = {}
): string {
  const showName = opts.showName ?? 'PMSE Licence Import';
  const customer = opts.customer ?? '';
  const pocName = opts.pocName ?? '';
  const venueName = opts.venueName ?? '';
  const venueAddress = opts.venueAddress ?? '';
  const now = opts.now ?? new Date();

  const chunks = chunk(assignments, CHANNELS_PER_DEVICE);

  const devicesXml: string[] = [];
  const channelIdsXml: string[] = [];
  const freqEntriesXml: string[] = [];
  const profilesXml: string[] = [];
  const allFreqsKhz: string[] = [];

  chunks.forEach((chunkItems, chunkIdx) => {
    const deviceId = newId();
    const startN = chunkIdx * CHANNELS_PER_DEVICE + 1;
    const endN = startN + chunkItems.length - 1;
    const zone = chunkItems.length > 1 ? `Ch ${startN}-${endN}` : `Ch ${startN}`;

    const freqsKhz = chunkItems.map((a) => String(Math.round(a.frequencyMhz * 1000)));
    const names = chunkItems.map((a, i) => a.suggestedName || `Ch${startN + i}`);

    devicesXml.push(buildDevice(deviceId, zone, freqsKhz, names));

    for (let i = 0; i < CHANNELS_PER_DEVICE; i++) {
      const active = i < chunkItems.length;
      channelIdsXml.push(
        `<id active_channel="${active ? 'true' : 'false'}" ` +
          `coordination_include="${active ? 'true' : 'false'}">${deviceId}-${i}</id>`
      );
      if (active) {
        freqEntriesXml.push(buildFreqEntry(deviceId, i, freqsKhz[i]!, zone));
        allFreqsKhz.push(freqsKhz[i]!);
      }
    }

    profilesXml.push(buildProfile(zone));
  });

  const totalChannels = chunks.length * CHANNELS_PER_DEVICE;

  let out = SKELETON;
  const subs: Record<string, string> = {
    '{{SHOW_NAME}}': escapeXml(showName),
    '{{CUSTOMER}}': escapeXml(customer),
    '{{POC_NAME}}': escapeXml(pocName),
    '{{VENUE_NAME}}': escapeXml(venueName),
    '{{VENUE_ADDRESS}}': escapeXml(venueAddress),
    '{{BAND_PLAN_NAME}}': escapeXml(showName).slice(0, 40) || 'List 1',
    '{{GROUP_NAME}}': 'Ofcom Licence',
    '{{DATE}}': formatDate(now),
    '{{TIME}}': formatTime(now),
    '{{INVENTORY_DEVICES}}': devicesXml.join(''),
    '{{CHANNEL_IDS}}': channelIdsXml.join(''),
    '{{MIC_CHANNEL_COUNT}}': String(totalChannels),
    '{{FREQ_ENTRIES}}': freqEntriesXml.join(''),
    '{{PROFILE_COUNT}}': String(profilesXml.length),
    '{{COMPAT_PROFILES}}': profilesXml.join(''),
    '{{INCL_FREQ_COUNT}}': String(allFreqsKhz.length),
    '{{INCL_FREQS}}': allFreqsKhz.map((f) => `<f>${f}</f>`).join(''),
  };
  for (const [token, value] of Object.entries(subs)) {
    out = out.split(token).join(value);
  }
  return out;
}
