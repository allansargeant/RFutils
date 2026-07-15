import { useEffect, useState } from 'react';
import { audioMode, type AudioModeInfo } from '../api.js';

let cached: AudioModeInfo | null = null;
let inflight: Promise<AudioModeInfo> | null = null;

/**
 * Fetches the server's audio-cue mode once and caches it.
 *   'capture' — DVS/Dante interface routed via Companion: any channel is cueable.
 *   'direct'  — decode AES67 multicast: only AES67 channels are cueable.
 */
export function useAudioMode(): AudioModeInfo | null {
  const [mode, setMode] = useState<AudioModeInfo | null>(cached);
  useEffect(() => {
    if (cached) {
      setMode(cached);
      return;
    }
    inflight ??= audioMode().then((m) => {
      cached = m;
      return m;
    });
    let alive = true;
    inflight.then((m) => alive && setMode(m)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return mode;
}
