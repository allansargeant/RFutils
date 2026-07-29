import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Where logs, crash reports and bundles live.
 *
 * Platform convention rather than a dot-directory next to the app: the server
 * is often started from a read-only bundle or a share, and a log that cannot
 * be written is worse than no log because nobody finds out until they need it.
 *
 * `{PREFIX}_LOG_DIR` overrides it, which is how you point a whole rack at one
 * collected location.
 */
export function logDir(app: string, envPrefix: string): string {
  const override = process.env[`${envPrefix}_LOG_DIR`];
  if (override) return override;

  switch (process.platform) {
    case 'darwin':
      return join(homedir(), 'Library', 'Logs', app);
    case 'win32':
      return join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), app, 'logs');
    default:
      // XDG puts logs under state, not cache: a cache directory may be cleared
      // at any time, and the point of a crash report is to outlive the crash.
      return join(
        process.env.XDG_STATE_HOME ?? join(homedir(), '.local', 'state'),
        app,
        'logs',
      );
  }
}
