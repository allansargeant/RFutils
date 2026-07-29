import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { availableParallelism, hostname, tmpdir } from 'node:os';
import { join } from 'node:path';

/** Identifies the document shape to anything reading it later. */
export const SCHEMA = 'stoatworks.diagnostics/1';

/** How many rotated log files to include in a bundle, newest first. */
const MAX_LOG_FILES = 3;
/** Per-file line cap, so one runaway log cannot make a bundle unusable. */
const MAX_LINES_PER_FILE = 5_000;
/** How many crash reports to carry in a bundle, newest first. */
const MAX_CRASH_REPORTS = 5;

export interface AppInfo {
  name: string;
  version: string;
  /** Short git revision, `-dirty` if the tree had uncommitted changes. */
  gitRev: string;
}

export interface PlatformInfo {
  os: string;
  arch: string;
  node: string;
  hostname: string;
  cpus: number;
}

export interface ProcessInfo {
  pid: number;
  argv: string[];
  startedAt: string;
  uptimeSeconds: number;
  memory: NodeJS.MemoryUsage;
}

export interface CrashReport {
  schema: string;
  kind: 'crash-report';
  generatedAt: string;
  /** `uncaughtException` or `unhandledRejection` — they fail differently. */
  trigger: string;
  app: AppInfo;
  platform: PlatformInfo;
  process: ProcessInfo;
  config: unknown;
  error: { name: string; message: string; stack: string[] };
  recentLog: string[];
}

export function capturePlatform(): PlatformInfo {
  return {
    os: `${process.platform} ${process.arch}`,
    arch: process.arch,
    node: process.version,
    hostname: hostname(),
    // availableParallelism, not cpus().length: it respects cgroup limits, so
    // it tells the truth inside a container.
    cpus: availableParallelism(),
  };
}

/**
 * Short git revision of the working tree, or `unknown`.
 *
 * Node ships as source, so unlike a compiled binary this can be read at
 * runtime. It is still best-effort: an installed copy has no `.git`.
 */
export function gitRev(cwd: string): string {
  try {
    const sha = execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();
    const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();
    return dirty ? `${sha}-dirty` : sha;
  } catch {
    return 'unknown';
  }
}

export function describeError(err: unknown): CrashReport['error'] {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: (err.stack ?? '').split('\n').map((l) => l.trim()),
    };
  }
  return { name: 'NonError', message: String(err), stack: [] };
}

/**
 * Write JSON, synchronously.
 *
 * Sync on purpose: this runs while the process is dying, and an async write
 * would not survive the `process.exit` that follows. Falls back to the temp
 * directory — a report that cannot be written because the log directory
 * vanished is the one case where writing somewhere unexpected beats writing
 * nowhere.
 */
export function writeJsonSync(dir: string, name: string, value: unknown): string {
  try {
    return writeInto(dir, name, value);
  } catch {
    return writeInto(tmpdir(), name, value);
  }
}

function writeInto(dir: string, name: string, value: unknown): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  writeFileSync(path, JSON.stringify(value, null, 2));
  return path;
}

/** `20260729T141500Z` — safe in a filename on Windows, where `:` is not. */
export function stampCompact(date = new Date()): string {
  return `${date.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, '')}Z`;
}

export interface BundleInput {
  dir: string;
  app: AppInfo;
  process: ProcessInfo;
  config: unknown;
  recentLog: string[];
}

/** Assemble a single-file diagnostics bundle and write it into `dir`. */
export function writeBundle(input: BundleInput): string {
  const warnings: string[] = [];
  const entries = newestFirst(input.dir, warnings);

  const crashReports = entries
    .filter((f) => f.includes('-crash-') && f.endsWith('.json'))
    .slice(0, MAX_CRASH_REPORTS)
    .map((f) => {
      try {
        return JSON.parse(readFileSync(join(input.dir, f), 'utf8')) as unknown;
      } catch (err) {
        warnings.push(`${f}: ${(err as Error).message}`);
        return null;
      }
    })
    .filter((r): r is unknown => r !== null);

  const logs = entries
    .filter((f) => f.endsWith('.log'))
    .slice(0, MAX_LOG_FILES)
    .map((f) => {
      try {
        const text = readFileSync(join(input.dir, f), 'utf8');
        const all = text.split('\n');
        // Keep the tail, not the head: whatever went wrong happened at the end.
        return {
          file: f,
          bytes: statSync(join(input.dir, f)).size,
          truncated: all.length > MAX_LINES_PER_FILE,
          lines: all.slice(-MAX_LINES_PER_FILE),
        };
      } catch (err) {
        warnings.push(`${f}: ${(err as Error).message}`);
        return null;
      }
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  const bundle = {
    schema: SCHEMA,
    kind: 'diagnostics-bundle' as const,
    generatedAt: new Date().toISOString(),
    app: input.app,
    platform: capturePlatform(),
    process: input.process,
    config: input.config,
    logDir: input.dir,
    crashReports,
    logs,
    recentLog: input.recentLog,
    collectionWarnings: warnings,
  };

  return writeJsonSync(input.dir, `${input.app.name}-diagnostics-${stampCompact()}.json`, bundle);
}

function newestFirst(dir: string, warnings: string[]): string[] {
  try {
    return readdirSync(dir)
      .map((f) => ({ f, m: statSync(join(dir, f)).mtimeMs }))
      .sort((a, b) => b.m - a.m)
      .map((e) => e.f);
  } catch (err) {
    warnings.push(`could not read ${dir}: ${(err as Error).message}`);
    return [];
  }
}
