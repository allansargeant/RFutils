/**
 * Wire protocol between the RFutils server and browser.
 *
 * Device monitoring is a server→client push over WebSocket (the server owns
 * the raw sockets — mDNS, Shure TCP, AES67 RTP — that a browser can't open).
 * Per-channel level/battery/RF telemetry rides inside `device-updated`
 * rather than as separate high-rate messages, so the client always has a
 * consistent device snapshot.
 *
 * File conversion and Companion routing are request/response over REST
 * (see the /api routes), not this channel.
 */

import type { DiscoveredDevice } from './devices.js';

export type ServerToClientEvent =
  | { type: 'device-updated'; device: DiscoveredDevice }
  | { type: 'device-removed'; deviceId: string }
  | { type: 'devices-snapshot'; devices: DiscoveredDevice[] }
  | { type: 'discovery-status'; scanning: boolean; message?: string };

/** Optional client→server messages (kept minimal; most actions are REST). */
export type ClientToServerMessage = { type: 'request-snapshot' };
