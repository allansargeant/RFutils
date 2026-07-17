import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import type { CoordinationList, ExportFormat, CrosspointRequest } from '@rfutils/shared';
import { EXPORT_FORMATS } from '@rfutils/shared';
import {
  readText,
  writeFormat,
  detectFormat,
  readHeaderAndRows,
  sniffMapping,
  type FieldMapping,
} from './formats/index.js';
import { convertLicence, generateShow } from './pmse/index.js';
import type { MonitorService } from './monitor/index.js';
import { coordinate, analyze } from './coordination/engine.js';
import { loadInventory, saveInventory } from './inventory/store.js';
import type { CoordinationParams, InventoryItem } from '@rfutils/shared';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

function decodeText(buf: Buffer): string {
  let text = buf.toString('utf-8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
  return text;
}

export function createApiRouter(monitor: MonitorService): Router {
  const router = Router();

  // --- File conversion (WSM / WWB / generic) -------------------------------

  /** Parse an uploaded text file into the model. For generic CSV, also return
   * the detected header + suggested column mapping so the UI can offer a
   * column-map dialog (the equivalent of wsm-wwb-bridge's mapping dialog). */
  router.post('/convert', upload.single('file'), (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded (field name must be "file").' });
      return;
    }
    const text = decodeText(req.file.buffer);
    let mapping: FieldMapping | undefined;
    if (typeof req.body?.mapping === 'string' && req.body.mapping.trim()) {
      try {
        mapping = JSON.parse(req.body.mapping);
      } catch {
        res.status(400).json({ error: 'mapping must be valid JSON' });
        return;
      }
    }
    try {
      const { format, list } = readText(text, mapping);
      const response: Record<string, unknown> = {
        format,
        filename: req.file.originalname,
        channelCount: list.channels.length,
        list,
        exportFormats: EXPORT_FORMATS,
      };
      if (format === 'generic') {
        const { header } = readHeaderAndRows(text);
        response.header = header;
        response.suggestedMapping = sniffMapping(header);
      }
      res.json(response);
    } catch (err) {
      res.status(422).json({ error: `Could not parse this file: ${(err as Error).message}` });
    }
  });

  /** Detect format only (cheap preview). */
  router.post('/detect', upload.single('file'), (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded.' });
      return;
    }
    res.json({ format: detectFormat(decodeText(req.file.buffer)) });
  });

  /** Export a model to a target format. Body: { list, format }. */
  router.post('/export', (req: Request, res: Response) => {
    const list = req.body?.list as CoordinationList | undefined;
    const format = req.body?.format as ExportFormat | undefined;
    if (!list || !Array.isArray(list.channels) || !format) {
      res.status(400).json({ error: 'Body must be { list: {channels}, format }.' });
      return;
    }
    const info = EXPORT_FORMATS.find((f) => f.id === format);
    if (!info) {
      res.status(400).json({ error: `Unknown export format: ${format}` });
      return;
    }
    try {
      let content: string;
      if (format === 'wwb-shw') {
        content = generateShow(
          list.channels.map((c) => ({ frequencyMhz: c.frequencyMhz, suggestedName: c.name })),
          { showName: 'RFutils Export' }
        );
      } else {
        content = writeFormat(list, format);
      }
      res.setHeader('Content-Type', info.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="rfutils-export.${info.extension}"`);
      res.send(content);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // --- PMSE licence PDF -> WWB ---------------------------------------------

  router.post('/pmse/convert', upload.single('file'), async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'No PDF uploaded (field name must be "file").' });
      return;
    }
    const isPdf =
      req.file.mimetype === 'application/pdf' ||
      req.file.mimetype === 'application/x-pdf' ||
      req.file.originalname.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      res.status(400).json({ error: 'Please upload a PDF file.' });
      return;
    }
    try {
      const conversion = await convertLicence(new Uint8Array(req.file.buffer));
      if (conversion.assignmentCount === 0) {
        res.status(422).json({
          error:
            'No frequency assignments were found in this PDF. It may not be an Ofcom PMSE licence schedule.',
          warnings: conversion.warnings,
        });
        return;
      }
      res.json(conversion);
    } catch (err) {
      res.status(422).json({ error: `Could not parse this PDF: ${(err as Error).message}` });
    }
  });

  // --- Frequency coordination ---------------------------------------------

  /** Coordinate `count` new frequencies. Body: { count, params, names? }. */
  router.post('/coordinate', (req: Request, res: Response) => {
    const count = Number(req.body?.count);
    const params = req.body?.params as CoordinationParams | undefined;
    const names = req.body?.names as string[] | undefined;
    if (!Number.isFinite(count) || !params || !Array.isArray(params.ranges)) {
      res.status(400).json({ error: 'Body must be { count, params: { ranges, ... } }.' });
      return;
    }
    try {
      res.json(coordinate(count, params, names));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  /** Analyze an existing set for conflicts. Body: { frequencies: number[], params }. */
  router.post('/analyze', (req: Request, res: Response) => {
    const frequencies = req.body?.frequencies as number[] | undefined;
    const params = req.body?.params as CoordinationParams | undefined;
    if (!Array.isArray(frequencies) || !params) {
      res.status(400).json({ error: 'Body must be { frequencies: number[], params }.' });
      return;
    }
    try {
      res.json(analyze(frequencies, params));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // --- System inventory (persisted equipment list) -------------------------

  router.get('/inventory', (_req: Request, res: Response) => {
    res.json(loadInventory());
  });

  /** Replace the whole inventory. Body: { items: InventoryItem[] }. */
  router.put('/inventory', (req: Request, res: Response) => {
    const items = req.body?.items as InventoryItem[] | undefined;
    if (!Array.isArray(items)) {
      res.status(400).json({ error: 'Body must be { items: InventoryItem[] }.' });
      return;
    }
    try {
      res.json(saveInventory(items));
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // --- Live monitoring (device snapshot + Companion routing) ---------------

  router.get('/devices', (_req: Request, res: Response) => {
    res.json({ devices: monitor.snapshot() });
  });

  /** Which audio-cue mode is active: 'capture' (DVS/Dante interface via
   * Companion) or 'direct' (decode AES67 multicast). */
  router.get('/audio/mode', (_req: Request, res: Response) => {
    res.json({ mode: monitor.audioMode(), cueBusConfigured: monitor.cueBusConfigured() });
  });

  router.get('/companion/status', async (_req: Request, res: Response) => {
    res.json(await monitor.companionStatus());
  });

  router.post('/companion/make-crosspoint', async (req: Request, res: Response) => {
    try {
      await monitor.makeCrosspoint(req.body as CrosspointRequest);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  router.post('/companion/clear-crosspoint', async (req: Request, res: Response) => {
    try {
      const { destinationChannel, destinationDevice } = req.body ?? {};
      await monitor.clearCrosspoint(destinationChannel, destinationDevice);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  return router;
}
