import dgram from 'node:dgram';
import { computeLevels, LevelSmoother } from './levels.js';
import type { Aes67SessionInfo } from './sap.js';

/** RTP audio decode + per-channel level metering for one AES67 session.
 * Ported verbatim from MicWizard. */
const RTP_HEADER_BYTES = 12;

export interface ChannelLevelUpdate {
  channelIndex: number;
  smoothedDb: number;
  peakDb: number;
}

export interface Aes67StreamHandle {
  stop: () => void;
  setSampleStreaming: (channelIndex: number, enabled: boolean) => void;
}

export function monitorAes67Stream(
  session: Aes67SessionInfo,
  onLevels: (updates: ChannelLevelUpdate[]) => void,
  onSamples: (channelIndex: number, samples: Float32Array, sampleRate: number) => void
): Aes67StreamHandle {
  const bytesPerSample = session.encoding === 'L24' ? 3 : 2;
  const smoothers = Array.from({ length: session.channelCount }, () => new LevelSmoother());
  const streamingChannels = new Set<number>();

  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  socket.on('error', () => {
    /* non-fatal */
  });
  socket.on('message', (msg) => {
    const frames = decodeRtpAudio(msg, bytesPerSample, session.channelCount);
    if (!frames) return;

    const updates: ChannelLevelUpdate[] = frames.map((samples, channelIndex) => {
      const { rmsDb, peakDb } = computeLevels(samples);
      if (streamingChannels.has(channelIndex)) onSamples(channelIndex, samples, session.sampleRate);
      return {
        channelIndex,
        smoothedDb: smoothers[channelIndex]!.push(rmsDb),
        peakDb,
      };
    });
    onLevels(updates);
  });

  socket.bind(session.port, () => {
    try {
      socket.addMembership(session.multicastAddress);
    } catch {
      /* no multicast interface */
    }
  });

  return {
    stop: () => socket.close(),
    setSampleStreaming: (channelIndex, enabled) => {
      if (enabled) streamingChannels.add(channelIndex);
      else streamingChannels.delete(channelIndex);
    },
  };
}

function decodeRtpAudio(
  packet: Buffer,
  bytesPerSample: number,
  channelCount: number
): Float32Array[] | null {
  if (packet.length <= RTP_HEADER_BYTES) return null;
  const version = packet[0]! >> 6;
  if (version !== 2) return null;

  const payload = packet.subarray(RTP_HEADER_BYTES);
  const frameBytes = bytesPerSample * channelCount;
  const frameCount = Math.floor(payload.length / frameBytes);
  if (frameCount === 0) return null;

  const channels = Array.from({ length: channelCount }, () => new Float32Array(frameCount));

  for (let frame = 0; frame < frameCount; frame++) {
    for (let ch = 0; ch < channelCount; ch++) {
      const offset = frame * frameBytes + ch * bytesPerSample;
      channels[ch]![frame] = readSample(payload, offset, bytesPerSample);
    }
  }
  return channels;
}

function readSample(buf: Buffer, offset: number, bytesPerSample: number): number {
  if (bytesPerSample === 2) {
    return buf.readInt16BE(offset) / 32768;
  }
  // 24-bit big-endian PCM, sign-extended
  const raw = (buf[offset]! << 16) | (buf[offset + 1]! << 8) | buf[offset + 2]!;
  const signed = raw & 0x800000 ? raw - 0x1000000 : raw;
  return signed / 8388608;
}
