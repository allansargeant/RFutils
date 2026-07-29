const SENSITIVE = [
  'password',
  'passwd',
  'passphrase',
  'secret',
  'token',
  'apikey',
  'credential',
  'auth',
  'private',
];

/**
 * Replace values whose key looks like a secret, at any depth.
 *
 * Deliberately over-eager: a redacted port number costs nothing, a token left
 * in a file that gets forwarded to a mailing list costs a great deal. Note
 * that this repo's config really does carry `restreamer.password` and
 * `rtmpToken`, so this is not theoretical.
 */
export function redact(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== 'object') return value;

  // Config objects are plain, but a caller may hand us something with a cycle.
  // Losing the whole report to a stack overflow would be a poor trade.
  if (seen.has(value)) return '<circular>';
  seen.add(value);

  if (Array.isArray(value)) return value.map((item) => redact(item, seen));

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = isSensitive(key) ? '<redacted>' : redact(item, seen);
  }
  return out;
}

function isSensitive(key: string): boolean {
  const flat = key.toLowerCase().replace(/[-_]/g, '');
  return SENSITIVE.some((word) => flat.includes(word.replace(/_/g, '')));
}
