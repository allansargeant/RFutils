import { useEffect, useState } from 'react';
import { cuePlayer, type CueState } from './cuePlayer.js';

/** React binding for the single app-wide cue player. */
export function useCue(): {
  state: CueState;
  toggle: (channelId: string) => void;
  stop: () => void;
} {
  const [state, setState] = useState<CueState>(cuePlayer.state());
  useEffect(() => cuePlayer.subscribe(setState), []);
  return {
    state,
    toggle: (channelId) => void cuePlayer.toggle(channelId),
    stop: () => cuePlayer.stop(),
  };
}
