import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import type { ServerToClientEvent, AudioClientMessage, AudioServerMessage } from '@rfutils/shared';
import { createApiRouter } from './routes.js';
import { MonitorService, type AudioFrame } from './monitor/index.js';

const PORT = Number(process.env.RFUTILS_SERVER_PORT ?? process.env.PORT ?? 8420);
const HOST = process.env.RFUTILS_HOST ?? '0.0.0.0';
const ENABLE_MONITOR = process.env.RFUTILS_DISABLE_MONITOR !== '1';

const monitor = new MonitorService();

const app = express();
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api', createApiRouter(monitor));

// Serve the built web UI in production (dev uses Vite's own server + proxy).
const webDist = path.resolve(fileURLToPath(import.meta.url), '../../../web/dist');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get('*', (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
}

const server = http.createServer(app);

// Two WebSocket endpoints share one HTTP server, so route upgrades by path
// ourselves (noServer) — passing {server, path} to multiple WebSocketServers
// makes each reject the other's upgrades with a 400.
const wss = new WebSocketServer({ noServer: true });
function broadcast(event: ServerToClientEvent): void {
  const payload = JSON.stringify(event);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
}
monitor.on('event', broadcast);

wss.on('connection', (socket) => {
  // Send the current device snapshot immediately on connect.
  socket.send(JSON.stringify({ type: 'devices-snapshot', devices: monitor.snapshot() } satisfies ServerToClientEvent));
});

// Audio cue: a separate binary WebSocket so PCM frames don't contend with the
// device-state channel. One channel cued per socket; server relays PCM16 mono.
const MAX_AUDIO_BACKLOG = 1 << 20; // 1 MB: drop frames rather than buffer unbounded
const audioWss = new WebSocketServer({ noServer: true });
audioWss.on('connection', (socket) => {
  let cued: string | null = null;

  const onAudio = (frame: AudioFrame): void => {
    if (frame.channelId !== cued) return;
    if (socket.readyState !== WebSocket.OPEN) return;
    if (socket.bufferedAmount > MAX_AUDIO_BACKLOG) return; // client can't keep up; drop
    socket.send(frame.pcm);
  };
  monitor.on('audio', onAudio);

  const send = (msg: AudioServerMessage): void => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
  };

  socket.on('message', (data, isBinary) => {
    if (isBinary) return; // clients don't send audio
    let msg: AudioClientMessage;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (msg.type === 'cue') {
      if (cued && cued !== msg.channelId) monitor.stopCue(cued);
      const format = monitor.startCue(msg.channelId);
      if (!format) {
        cued = null;
        send({ type: 'audio-error', channelId: msg.channelId, message: 'Channel is not cueable (AES67 audio only, and its stream must be live).' });
        return;
      }
      cued = msg.channelId;
      send({ type: 'audio-format', channelId: msg.channelId, sampleRate: format.sampleRate, channels: 1, encoding: 'pcm16' });
    } else if (msg.type === 'stop') {
      if (cued) monitor.stopCue(cued);
      cued = null;
    }
  });

  const cleanup = (): void => {
    monitor.off('audio', onAudio);
    if (cued) monitor.stopCue(cued);
    cued = null;
  };
  socket.on('close', cleanup);
  socket.on('error', cleanup);
});

// Route WebSocket upgrades by path to the right server.
server.on('upgrade', (req, socket, head) => {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
  if (pathname === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  } else if (pathname === '/ws/audio') {
    audioWss.handleUpgrade(req, socket, head, (ws) => audioWss.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[rfutils] server listening on http://${HOST}:${PORT}`);
  if (ENABLE_MONITOR) {
    monitor.start();
    console.log('[rfutils] device discovery started (mDNS / Shure / AES67)');
  } else {
    console.log('[rfutils] device discovery disabled (RFUTILS_DISABLE_MONITOR=1)');
  }
});

function shutdown(): void {
  console.log('[rfutils] shutting down');
  monitor.stop();
  wss.close();
  audioWss.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
