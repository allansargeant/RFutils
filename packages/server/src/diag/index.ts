import { closeSync, mkdirSync, openSync, readdirSync, unlinkSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { format } from 'node:util';
import { Writable } from 'node:stream';

import pino, { type Logger } from 'pino';

import { logDir } from './paths.js';
import { redact } from './redact.js';
import {
  SCHEMA,
  capturePlatform,
  describeError,
  gitRev,
  stampCompact,
  writeBundle,
  writeJsonSync,
  type AppInfo,
  type CrashReport,
  type ProcessInfo,
} from './reports.js';

export { redact } from './redact.js';

/** Lines held in memory for crash reports. Enough to cover the run-up to a
 *  fault without making the report too big to read. */
const RING_CAPACITY = 500;
/** Days of rotated logs kept on disk. */
const KEEP_LOG_FILES = 7;

const LEVEL_NAMES: Record<number, string> = {
  10: 'TRACE',
  20: 'DEBUG',
  30: 'INFO',
  40: 'WARN',
  50: 'ERROR',
  60: 'FATAL',
};

export interface DiagOptions {
  /** Names the log files, e.g. `atem-overseer`. */
  app: string;
  /** Scopes the environment variables: `{PREFIX}_LOG`, `{PREFIX}_LOG_DIR`. */
  envPrefix: string;
  version: string;
  /** Level used when `{PREFIX}_LOG` is unset. */
  defaultLevel?: string;
  /** Effective configuration; secret-looking keys are redacted here, once. */
  config?: unknown;
  /** Directory to read the git revision from. */
  cwd?: string;
}

interface State {
  app: AppInfo;
  dir: string;
  config: unknown;
  ring: Ring;
  startedAt: string;
  file: RotatingFile;
}

let state: State | null = null;
/** Exported so modules can log before/without threading a logger through.
 *  Replaced by `init`; the no-op default keeps imports safe at module load. */
export let log: Logger = pino({ level: 'silent' });

/**
 * Install logging and the crash handlers.
 *
 * Call once, as early as possible — before anything that can fail, so a
 * failure during startup is logged and captured like any other.
 */
export function init(options: DiagOptions): Logger {
  if (state) throw new Error('diag.init called twice');

  const dir = logDir(options.app, options.envPrefix);
  mkdirSync(dir, { recursive: true });

  const ring = new Ring(RING_CAPACITY);
  const file = new RotatingFile(dir, options.app, KEEP_LOG_FILES);
  const level = process.env[`${options.envPrefix}_LOG`] ?? options.defaultLevel ?? 'info';

  // One destination that fans out. pino hands us each record as a JSON line;
  // we render it once and send the text to the console and the file, and keep
  // it in the ring.
  //
  // Deliberately not a pino transport: transports run in a worker thread, and
  // on a hard crash the tail — the part that explains the crash — can die with
  // the main thread before the worker drains it.
  const destination = new Writable({
    write(chunk, _enc, cb) {
      let line: string;
      try {
        line = formatRecord(JSON.parse(String(chunk)) as Record<string, unknown>);
      } catch {
        line = String(chunk).trimEnd();
      }
      // Console logs go to stderr, never stdout. Anything on stdout is program
      // output — `--collect-diagnostics` prints a path there and nothing else.
      process.stderr.write(`${line}\n`);
      file.write(`${line}\n`);
      ring.push(line);
      cb();
    },
  });

  log = pino({ level, base: undefined, timestamp: pino.stdTimeFunctions.isoTime }, destination);

  state = {
    app: {
      name: options.app,
      version: options.version,
      gitRev: gitRev(options.cwd ?? process.cwd()),
    },
    dir,
    config: redact(options.config ?? null),
    ring,
    startedAt: new Date().toISOString(),
    file,
  };

  installCrashHandlers();

  // `logLevel`, not `level`: `level` is pino's own key for the record's
  // severity, and passing it as a field silently overwrites it — the startup
  // line then reports whatever the configured level is instead of INFO.
  log.info(
    { version: state.app.version, gitRev: state.app.gitRev, logDir: dir, logLevel: level },
    'logging started',
  );
  return log;
}

/**
 * console-shaped logging.
 *
 * Existing code calls `console.error('thing failed:', err)` — variadic, message
 * first. pino's signature is `(fields, message)`, so a mechanical swap to `log`
 * does not typecheck. This keeps those call sites exactly as they were while
 * still routing everything into the log file and the crash ring.
 *
 * New code should prefer `log` with structured fields: `log.warn({ device },
 * 'reconnecting')` is greppable and machine-readable in a way that an
 * interpolated sentence is not.
 */
export const say = {
  trace: (...args: unknown[]) => log.trace(format(...args)),
  debug: (...args: unknown[]) => log.debug(format(...args)),
  info: (...args: unknown[]) => log.info(format(...args)),
  warn: (...args: unknown[]) => log.warn(format(...args)),
  error: (...args: unknown[]) => log.error(format(...args)),
  fatal: (...args: unknown[]) => log.fatal(format(...args)),
};

/**
 * Attach the effective configuration to crash reports and bundles.
 *
 * Separate from `init` so logging can be up *before* the config is read —
 * otherwise a fault while parsing the config file happens before there is
 * anywhere to record it. Secret-looking keys are redacted here.
 */
export function setConfig(config: unknown): void {
  required().config = redact(config);
}

/** Write a diagnostics bundle and return its path. */
export function collectDiagnostics(): string {
  const s = required();
  return writeBundle({
    dir: s.dir,
    app: s.app,
    process: processInfo(s),
    config: s.config,
    recentLog: s.ring.snapshot(),
  });
}

/** The directory logs, crash reports and bundles are written to. */
export function logDirectory(): string {
  return required().dir;
}

function required(): State {
  if (!state) throw new Error('diag.init has not been called');
  return state;
}

function processInfo(s: State): ProcessInfo {
  return {
    pid: process.pid,
    argv: process.argv,
    startedAt: s.startedAt,
    uptimeSeconds: Math.round(process.uptime()),
    memory: process.memoryUsage(),
  };
}

function installCrashHandlers(): void {
  // Both, because they fail differently and knowing which one fired is part of
  // the diagnosis: an unhandled rejection usually means a missing `await`.
  process.on('uncaughtException', (err) => {
    writeCrashReport('uncaughtException', err);
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    writeCrashReport('unhandledRejection', reason);
    process.exit(1);
  });
}

/**
 * Write a crash report for a fault the base hooks cannot see.
 *
 * Exported for the Electron layer, where a renderer or GPU process dying
 * raises nothing in the main process.
 */
export function writeCrashReport(trigger: string, err: unknown): void {
  const s = state;
  if (!s) {
    console.error(`${trigger}:`, err);
    return;
  }
  const report: CrashReport = {
    schema: SCHEMA,
    kind: 'crash-report',
    generatedAt: new Date().toISOString(),
    trigger,
    app: s.app,
    platform: capturePlatform(),
    process: processInfo(s),
    config: s.config,
    error: describeError(err),
    recentLog: s.ring.snapshot(),
  };

  try {
    const path = writeJsonSync(s.dir, `${s.app.name}-crash-${stampCompact()}.json`, report);
    process.stderr.write(
      `\n${s.app.name} crashed (${trigger}). A diagnostic report was written to:\n  ${path}\n` +
        'Send that file with your bug report — it contains the build, the configuration ' +
        '(secrets removed), the last log lines and a stack trace.\n\n',
    );
  } catch (writeErr) {
    process.stderr.write(
      `\n${s.app.name} crashed (${trigger}), and the diagnostic report could not be written: ` +
        `${(writeErr as Error).message}\n`,
    );
  }
  process.stderr.write(`${(err as Error)?.stack ?? String(err)}\n`);
}

/** `2026-07-29T13:36:29.536Z INFO  atem-overseer: message field=value` */
function formatRecord(record: Record<string, unknown>): string {
  const { level, time, msg, ...rest } = record;
  const name = LEVEL_NAMES[Number(level)] ?? String(level);
  const fields = Object.entries(rest)
    .map(([k, v]) => ` ${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join('');
  return `${String(time)} ${name.padEnd(5)} ${String(msg ?? '')}${fields}`;
}

/**
 * The most recent log lines, held in memory.
 *
 * A crash report is only useful if it says what the program was doing on the
 * way down, and the file stream is asynchronous — at the moment of a crash its
 * buffer may not have reached the disk.
 */
class Ring {
  private readonly lines: string[] = [];

  constructor(private readonly capacity: number) {}

  push(line: string): void {
    if (this.lines.length === this.capacity) this.lines.shift();
    this.lines.push(line);
  }

  snapshot(): string[] {
    return [...this.lines];
  }
}

/**
 * A log file per day, oldest pruned.
 *
 * Hand-rolled rather than a rotation package: it is forty lines, and it is the
 * same shape in every repo that copies this module.
 *
 * Writes are **synchronous**, which matters more than it looks. An async
 * `createWriteStream` loses everything still in its buffer when the crash
 * handler calls `process.exit`, so the log file for the run that crashed comes
 * out empty — precisely the run you needed it for. Appending to a regular file
 * is cheap; correctness here is worth more than the microseconds.
 */
class RotatingFile {
  private fd: number | null = null;
  private day = '';

  constructor(
    private readonly dir: string,
    private readonly app: string,
    private readonly keep: number,
  ) {}

  write(text: string): void {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.day || this.fd === null) {
      if (this.fd !== null) closeSync(this.fd);
      this.day = today;
      this.fd = openSync(join(this.dir, `${this.app}.${today}.log`), 'a');
      this.prune();
    }
    try {
      writeSync(this.fd, text);
    } catch {
      // A failed log write must never take the process down with it.
    }
  }

  private prune(): void {
    try {
      const pattern = new RegExp(`^${escapeRegExp(this.app)}\\.\\d{4}-\\d{2}-\\d{2}\\.log$`);
      readdirSync(this.dir)
        .filter((f) => pattern.test(f))
        .sort()
        .reverse()
        .slice(this.keep)
        .forEach((f) => unlinkSync(join(this.dir, f)));
    } catch {
      // Pruning is housekeeping; failing at it is not worth an error path.
    }
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
