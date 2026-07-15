import dgram from 'node:dgram';
import { EventEmitter } from 'node:events';

/**
 * SAP (RFC 2974) announcement listener for AES67 streams. Ported verbatim
 * from MicWizard. Senders announce active streams via periodic multicast
 * packets on 224.2.127.254:9875 carrying an SDP payload.
 */
const SAP_MULTICAST_ADDRESS = '224.2.127.254';
const SAP_PORT = 9875;

export interface Aes67SessionInfo {
  sessionId: string;
  name: string;
  originAddress: string;
  multicastAddress: string;
  port: number;
  payloadType: number;
  encoding: 'L16' | 'L24';
  sampleRate: number;
  channelCount: number;
}

export declare interface SapListener {
  on(event: 'session', listener: (session: Aes67SessionInfo) => void): this;
  on(event: 'session-deleted', listener: (sessionId: string) => void): this;
}

export class SapListener extends EventEmitter {
  private socket: dgram.Socket | null = null;

  start(): void {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    socket.on('message', (msg) => this.handlePacket(msg));
    socket.on('error', () => {
      /* bind/multicast errors are non-fatal for the rest of the app */
    });
    socket.bind(SAP_PORT, () => {
      try {
        socket.addMembership(SAP_MULTICAST_ADDRESS);
      } catch {
        /* no multicast-capable interface; monitoring simply stays empty */
      }
    });
    this.socket = socket;
  }

  stop(): void {
    this.socket?.close();
    this.socket = null;
  }

  private handlePacket(msg: Buffer): void {
    if (msg.length < 8) return;
    const flags = msg[0]!;
    const deleteFlag = (flags & 0b0000_0100) !== 0;
    const addressFamilyIsV6 = (flags & 0b0001_0000) !== 0;
    if (addressFamilyIsV6) return; // AES67 devices are overwhelmingly IPv4

    const authLen = msg[1]!;
    let offset = 4; // flags(1) + authLen(1) + msgIdHash(2)
    offset += 4; // originating source, IPv4
    offset += authLen * 4;

    const payload = msg.subarray(offset).toString('utf8');
    const sdp = extractSdp(payload);
    if (!sdp) return;

    const session = parseSdp(sdp);
    if (!session) return;

    if (deleteFlag) {
      this.emit('session-deleted', session.sessionId);
    } else {
      this.emit('session', session);
    }
  }
}

function extractSdp(payload: string): string | null {
  const start = payload.indexOf('v=0');
  return start >= 0 ? payload.slice(start) : null;
}

function parseSdp(sdp: string): Aes67SessionInfo | null {
  const lines = sdp.split(/\r?\n/);
  const originLine = lines.find((l) => l.startsWith('o='));
  const nameLine = lines.find((l) => l.startsWith('s='));
  const connLine = lines.find((l) => l.startsWith('c='));
  const mediaLine = lines.find((l) => l.startsWith('m=audio'));
  const rtpmapLine = lines.find((l) => l.startsWith('a=rtpmap'));
  if (!originLine || !connLine || !mediaLine || !rtpmapLine) return null;

  const originParts = originLine.split(' ');
  const sessionId = originParts[1] ?? originLine;
  const originAddress = originParts[5] ?? '';

  const connParts = connLine.split(' ');
  const multicastAddress = connParts[2]?.split('/')[0];
  if (!multicastAddress) return null;

  const mediaParts = mediaLine.split(' ');
  const port = Number(mediaParts[1]);
  const payloadType = Number(mediaParts[3]);

  // a=rtpmap:97 L24/48000/2
  const rtpmapMatch = rtpmapLine.match(/a=rtpmap:(\d+)\s+(L16|L24)\/(\d+)\/?(\d+)?/);
  if (!rtpmapMatch) return null;
  const encoding = rtpmapMatch[2] as 'L16' | 'L24';
  const sampleRate = Number(rtpmapMatch[3]);
  const channelCount = Number(rtpmapMatch[4] ?? '1');

  return {
    sessionId,
    name: nameLine?.slice(2).trim() || sessionId,
    originAddress,
    multicastAddress,
    port,
    payloadType,
    encoding,
    sampleRate,
    channelCount,
  };
}
