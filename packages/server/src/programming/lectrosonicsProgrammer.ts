import net from 'node:net';
import { lectroPort, frameCommand } from '../monitor/discovery/lectrosonicsProtocol.js';

/**
 * Programs frequencies into Lectrosonics receivers over their Ethernet control
 * port — the same transport the Monitor adapter uses. The command string comes
 * from the product plugin's `programTemplate` (rendered by the caller); this
 * module only frames + sends it.
 *
 * ⚠️ EXPERIMENTAL / UNTESTED against real hardware, and the wire format is an
 * unverified placeholder (see lectrosonicsProtocol.ts). Always dry-run first
 * (which returns the exact strings without connecting) and verify against the
 * Lectrosonics IP-control spec before sending.
 */
const SEND_TIMEOUT_MS = 3000;

/** Open a short-lived TCP connection, send the framed commands, collect replies. */
export function sendLectrosonicsCommands(
  address: string,
  commands: string[]
): Promise<{ ok: boolean; reply: string; error?: string }> {
  return new Promise((resolve) => {
    let reply = '';
    let settled = false;
    const socket = net.createConnection({ host: address, port: lectroPort(), timeout: SEND_TIMEOUT_MS });
    const done = (r: { ok: boolean; reply: string; error?: string }): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(r);
    };
    socket.setEncoding('utf8');
    socket.on('connect', () => {
      for (const cmd of commands) socket.write(frameCommand(cmd));
      setTimeout(() => done({ ok: true, reply: reply.trim() }), 500);
    });
    socket.on('data', (chunk: string) => {
      reply += chunk;
    });
    socket.on('timeout', () => done({ ok: false, reply, error: 'connection timed out' }));
    socket.on('error', (e) => done({ ok: false, reply, error: e.message }));
  });
}
