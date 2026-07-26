import net from 'node:net';
import type { DeviceRegistry } from '../deviceRegistry.js';
import type { DeviceChannel } from '@rfutils/shared';

/**
 * UNVERIFIED SKELETON — Sennheiser SSC (newline-delimited JSON over TCP:45).
 * Ported verbatim from MicWizard; the metering path names are best-effort
 * guesses from public SSC examples, not confirmed against real hardware.
 * Not started automatically; wired for opt-in connection by address.
 */
const SSC_PORT = 45;

export interface SennheiserDiscoveryHandle {
  stop: () => void;
}

export function connectSennheiserDevice(
  address: string,
  registry: DeviceRegistry
): SennheiserDiscoveryHandle {
  const deviceId = `sennheiser:${address}`;
  const socket = net.createConnection({ host: address, port: SSC_PORT });
  let buffer = '';

  socket.on('connect', () => {
    sendPath(socket, { osc: { rx: { 1: { identity: { name: null, product: null } } } } });
    sendPath(socket, { osc: { rx: { 1: { battery: { gauge: null, lifetime: null } } } } });
    sendPath(socket, { osc: { rx: { 1: { audio: { out1: { level: null } } } } } });
    sendPath(socket, { osc: { rx: { 1: { rf: { rsqi: null, level: null } } } } });
  });

  socket.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      handleMessage(line, deviceId, address, registry);
      newlineIndex = buffer.indexOf('\n');
    }
  });

  socket.on('error', () => registry.remove(deviceId));
  socket.on('close', () => registry.remove(deviceId));

  return { stop: () => socket.end() };
}

function sendPath(socket: net.Socket, path: Record<string, unknown>): void {
  socket.write(JSON.stringify(path) + '\n');
}

function handleMessage(
  line: string,
  deviceId: string,
  address: string,
  registry: DeviceRegistry
): void {
  if (!line.trim()) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return;
  }

  const rx1 = dig(parsed, ['osc', 'rx', '1']);
  if (!rx1 || typeof rx1 !== 'object') return;

  const channel: DeviceChannel = {
    id: `${deviceId}:1`,
    name: asText(dig(rx1, ['identity', 'name'])) || 'Sennheiser RX',
    rfLevel: numeric(dig(rx1, ['rf', 'level'])),
    audioLevelDb: numeric(dig(rx1, ['audio', 'out1', 'level'])),
    batteryPercent: numeric(dig(rx1, ['battery', 'gauge'])),
    batteryMinutesRemaining: numeric(dig(rx1, ['battery', 'lifetime'])),
    antenna: null,
  };

  const existing = registry.get(deviceId);
  const channels = existing?.channels.filter((c) => c.id !== channel.id) ?? [];
  channels.push(channel);

  registry.upsert({
    id: deviceId,
    vendor: 'sennheiser',
    model: asText(dig(rx1, ['identity', 'product'])) || null,
    name: channel.name,
    address,
    port: SSC_PORT,
    transport: 'none',
    identified: true,
    channels,
  });
}

/** Safely coerce an unknown SSC value to a display string (never "[object Object]"). */
function asText(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
}

function dig(obj: unknown, path: string[]): unknown {
  let current = obj;
  for (const key of path) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function numeric(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}
