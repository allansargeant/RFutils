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

/**
 * Audio-cue protocol on the separate `/ws/audio` WebSocket.
 *
 * A browser can't join the AES67 RTP multicast group directly, so to
 * monitor ("cue") a channel to headphones the client asks the server to
 * relay that one channel: the server enables per-channel PCM streaming on
 * the already-decoded AES67 stream and forwards it here. Control messages
 * are JSON (text frames); the audio itself is sent as raw binary frames of
 * signed 16-bit little-endian mono PCM at the announced sample rate.
 *
 * Only one channel is cued per audio socket; a new `cue` replaces the
 * previous one. Cueing is only available on AES67 channels — Shure/Sennheiser
 * command protocols carry telemetry, not audio.
 */
export type AudioClientMessage =
  | { type: 'cue'; channelId: string }
  | { type: 'stop' };

export type AudioServerMessage =
  | { type: 'audio-format'; channelId: string; sampleRate: number; channels: 1; encoding: 'pcm16' }
  | { type: 'audio-error'; channelId: string; message: string };
