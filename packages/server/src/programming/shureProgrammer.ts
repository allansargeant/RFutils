import net from 'node:net';

/**
 * Programs frequencies into Shure receivers over the "Command Strings"
 * protocol (plaintext ASCII, TCP port 2202) — the same transport the Monitor
 * adapter uses to read telemetry.
 *
 * ⚠️ EXPERIMENTAL / UNTESTED against real hardware. The SET command's exact
 * keyword varies by product line (ULX-D, QLX-D, Axient Digital); `FREQUENCY`
 * with a 6-digit kHz value is the common documented form and the default here.
 * Always dry-run first (which returns the exact strings without connecting)
 * and verify against your receiver's Command Strings PDF before sending.
 */

const SHURE_PORT = 2202;
const SEND_TIMEOUT_MS = 3000;

/** Shure frequency value: 6-digit kHz, e.g. 470.125 MHz → "470125". */
export function shureFreqValue(freqMhz: number): string {
  return String(Math.round(freqMhz * 1000)).padStart(6, '0');
}

/** e.g. buildShureSetCommand(1, 470.125) → "< SET 1 FREQUENCY 470125 >". */
export function buildShureSetCommand(channelNum: number | string, freqMhz: number): string {
  return `< SET ${channelNum} FREQUENCY ${shureFreqValue(freqMhz)} >`;
}

export interface ProgramTargetResult {
  channelId: string;
  address: string;
  command: string;
  sent: boolean;
  ok: boolean;
  reply?: string;
  error?: string;
}

/** Open a short-lived TCP connection, send the commands, collect any replies. */
export function sendShureCommands(address: string, commands: string[]): Promise<{ ok: boolean; reply: string; error?: string }> {
  return new Promise((resolve) => {
    let reply = '';
    let settled = false;
    const socket = net.createConnection({ host: address, port: SHURE_PORT, timeout: SEND_TIMEOUT_MS });
    const done = (r: { ok: boolean; reply: string; error?: string }): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(r);
    };
    socket.setEncoding('utf8');
    socket.on('connect', () => {
      for (const cmd of commands) socket.write(cmd);
      // Give the receiver a moment to acknowledge, then close.
      setTimeout(() => done({ ok: true, reply: reply.trim() }), 500);
    });
    socket.on('data', (chunk: string) => {
      reply += chunk;
    });
    socket.on('timeout', () => done({ ok: false, reply, error: 'connection timed out' }));
    socket.on('error', (e) => done({ ok: false, reply, error: e.message }));
  });
}
