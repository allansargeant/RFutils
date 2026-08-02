/// <reference types="vite/client" />

/** Injected by vite.config.ts from package.json. Shown in the About dialog. */
declare const __APP_VERSION__: string;

interface Window {
  STOATWORKS_ABOUT?: Record<string, string>
}
