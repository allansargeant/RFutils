/**
 * Live-monitoring device model, ported from MicWizard's src/shared/types.ts.
 * These describe wireless receivers discovered on the network and their
 * real-time RF / audio / battery telemetry.
 */

export type DeviceVendor = 'shure' | 'sennheiser' | 'unknown-dante';

export type TransportKind = 'aes67' | 'dante-api' | 'usb' | 'none';

export interface DeviceChannel {
  id: string;
  name: string;
  /** RF signal strength 0-100 (vendor-normalized), null if not reported/connected. */
  rfLevel: number | null;
  /** Audio level in dBFS, null if not currently metering. */
  audioLevelDb: number | null;
  batteryPercent: number | null;
  /** Minutes of battery runtime remaining, if the receiver reports it. */
  batteryMinutesRemaining: number | null;
  antenna: 'A' | 'B' | 'diversity' | null;
}

export interface DiscoveredDevice {
  id: string;
  vendor: DeviceVendor;
  model: string | null;
  name: string;
  address: string;
  port: number | null;
  transport: TransportKind;
  /** True once a vendor adapter has completed its identify/handshake. */
  identified: boolean;
  channels: DeviceChannel[];
  lastSeen: number;
}

export interface CompanionButtonLocation {
  page: number;
  row: number;
  column: number;
}

/** See MicWizard's CompanionCrosspointConfig doc comment for the full contract. */
export interface CompanionCrosspointConfig {
  host: string;
  port: number;
  variablePrefix: string;
  makeCrosspointButton: CompanionButtonLocation;
  clearCrosspointButton: CompanionButtonLocation | null;
}

export interface CompanionStatus {
  configured: boolean;
  host: string | null;
  port: number | null;
  reachable: boolean | null;
  canClear: boolean;
}

export interface CrosspointRequest {
  sourceChannel: string;
  sourceDevice: string;
  destinationChannel: string;
  destinationDevice: string;
}
