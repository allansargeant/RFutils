import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import type { ServerToClientEvent } from '@rfwizard/shared';
import { createApiRouter } from './routes.js';
import { MonitorService } from './monitor/index.js';

const PORT = Number(process.env.RFWIZARD_SERVER_PORT ?? process.env.PORT ?? 8420);
const HOST = process.env.RFWIZARD_HOST ?? '0.0.0.0';
const ENABLE_MONITOR = process.env.RFWIZARD_DISABLE_MONITOR !== '1';

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

// WebSocket: push device state to browsers (server owns the raw sockets).
const wss = new WebSocketServer({ server, path: '/ws' });
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

server.listen(PORT, HOST, () => {
  console.log(`[rfwizard] server listening on http://${HOST}:${PORT}`);
  if (ENABLE_MONITOR) {
    monitor.start();
    console.log('[rfwizard] device discovery started (mDNS / Shure / AES67)');
  } else {
    console.log('[rfwizard] device discovery disabled (RFWIZARD_DISABLE_MONITOR=1)');
  }
});

function shutdown(): void {
  console.log('[rfwizard] shutting down');
  monitor.stop();
  wss.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
