import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import type { CompanionButtonLocation, CompanionCrosspointConfig } from '@rfutils/shared';
import { say } from '../../diag/index.js';

/**
 * Where the user's own companion-routes.json lives. Absence of this file is
 * the default, expected state — RFutils ships with no Dante routing
 * capability until the user opts in by creating it. Ported from MicWizard's
 * routesConfig.ts; Electron's app.getPath('userData') is replaced with a
 * plain config dir: RFUTILS_CONFIG_DIR if set, else ~/.rfutils.
 * See companion-routes.example.json and the README.
 */
export function companionConfigDir(): string {
  return process.env.RFUTILS_CONFIG_DIR ?? path.join(os.homedir(), '.rfutils');
}

export function companionConfigPath(): string {
  return path.join(companionConfigDir(), 'companion-routes.json');
}

export function loadCompanionConfig(): CompanionCrosspointConfig | null {
  const configPath = companionConfigPath();
  if (!fs.existsSync(configPath)) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    say.error(`[companion] failed to parse ${configPath}`, err);
    return null;
  }

  const parsed = validate(raw);
  if (!parsed) {
    say.error(
      `[companion] ${configPath} does not match the expected shape — see companion-routes.example.json`
    );
    return null;
  }
  return parsed;
}

function validate(raw: unknown): CompanionCrosspointConfig | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  const companion = obj.companion;
  if (typeof companion !== 'object' || companion === null) return null;
  const { host, port } = companion as Record<string, unknown>;
  if (typeof host !== 'string' || typeof port !== 'number') return null;

  if (typeof obj.variablePrefix !== 'string' || obj.variablePrefix.length === 0) return null;

  const makeCrosspointButton = validateLocation(obj.makeCrosspointButton);
  if (!makeCrosspointButton) return null;

  let clearCrosspointButton: CompanionButtonLocation | null = null;
  if (obj.clearCrosspointButton !== undefined && obj.clearCrosspointButton !== null) {
    clearCrosspointButton = validateLocation(obj.clearCrosspointButton);
    if (!clearCrosspointButton) return null;
  }

  return {
    host,
    port,
    variablePrefix: obj.variablePrefix,
    makeCrosspointButton,
    clearCrosspointButton,
  };
}

function validateLocation(raw: unknown): CompanionButtonLocation | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { page, row, column } = raw as Record<string, unknown>;
  if (typeof page !== 'number' || typeof row !== 'number' || typeof column !== 'number') return null;
  return { page, row, column };
}
