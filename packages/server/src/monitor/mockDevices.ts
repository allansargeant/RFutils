import type { DeviceRegistry } from './deviceRegistry.js';

/**
 * Seeds the registry with representative simulated receivers so the Monitor
 * dashboard can be demoed (and screenshotted) without real hardware on the
 * network. Enabled with RFUTILS_MOCK_DEVICES=1. Purely fictional data — no
 * real device, address, or telemetry.
 */
export function seedMockDevices(registry: DeviceRegistry): void {
  registry.upsert({
    id: 'shure:10.0.0.21',
    vendor: 'shure',
    model: 'ULXD4Q',
    name: 'Shure ULXD4Q (Stage L)',
    address: '10.0.0.21',
    port: 2202,
    transport: 'none',
    identified: true,
    channels: [
      chan('shure:10.0.0.21:1', 'Lead Vocal', 82, -9.4, 88, 255, 'A'),
      chan('shure:10.0.0.21:2', 'Guitar', 68, -18.7, 61, 165, 'B'),
      chan('shure:10.0.0.21:3', 'Bass', 74, -27.1, 17, 35, 'diversity'),
      chan('shure:10.0.0.21:4', 'Backing Vox', 59, -6.2, 93, 300, 'A'),
    ],
  });

  registry.upsert({
    id: 'sennheiser:10.0.0.34',
    vendor: 'sennheiser',
    model: 'EW-DX EM 2',
    name: 'Sennheiser EW-DX (IEM Rack)',
    address: '10.0.0.34',
    port: 45,
    transport: 'none',
    identified: true,
    channels: [
      chan('sennheiser:10.0.0.34:1', 'IEM Mix A', 71, -5.8, 46, 120, null),
      chan('sennheiser:10.0.0.34:2', 'IEM Mix B', 66, -12.0, 79, 240, null),
    ],
  });

  registry.upsert({
    id: 'aes67:studio-console',
    vendor: 'unknown-dante',
    model: null,
    name: 'Studio Console (AES67)',
    address: '239.69.0.12',
    port: 5004,
    transport: 'aes67',
    identified: true,
    channels: [
      chan('aes67:studio-console:0', 'Console ch1', null, -14.2, null, null, null),
      chan('aes67:studio-console:1', 'Console ch2', null, -19.6, null, null, null),
    ],
  });
}

function chan(
  id: string,
  name: string,
  rfLevel: number | null,
  audioLevelDb: number | null,
  batteryPercent: number | null,
  batteryMinutesRemaining: number | null,
  antenna: 'A' | 'B' | 'diversity' | null
) {
  return { id, name, rfLevel, audioLevelDb, batteryPercent, batteryMinutesRemaining, antenna };
}
