import { useEffect, useRef } from 'react';
import { useCue } from '../audio/useCue.js';
import { useAudioMode } from '../audio/useAudioMode.js';
import { cuePlayer } from '../audio/cuePlayer.js';

/**
 * Per-channel "cue to headphones" toggle.
 *   direct AES67 mode — only AES67 channels carry audio.
 *   capture mode (DVS/Dante interface via Companion) — any channel is cueable
 *   (Companion routes it to the cue bus the server captures).
 * When active it shows a live level meter fed from the cue player's analyser.
 */
export function CueButton({
  channelId,
  transport,
}: {
  channelId: string;
  transport: string;
}): JSX.Element {
  const { state, toggle } = useCue();
  const mode = useAudioMode();
  const cueable = mode?.mode === 'capture' || transport === 'aes67';

  if (!cueable) {
    return (
      <span
        className="cue cue--na"
        title="In direct AES67 mode, cueing is available on AES67 channels only"
      >
        —
      </span>
    );
  }

  const active = state.channelId === channelId;
  const status = active ? state.status : 'idle';
  const glyph = status === 'connecting' ? '…' : '🎧';
  const title =
    status === 'error'
      ? (state.error ?? 'Cue error')
      : active
        ? 'Stop cue'
        : 'Cue to headphones';

  return (
    <span className="cue">
      <button
        className={`cue-btn${active ? ' cue-btn--active' : ''}${status === 'error' ? ' cue-btn--error' : ''}`}
        onClick={() => toggle(channelId)}
        title={title}
        aria-pressed={active}
      >
        {glyph}
      </button>
      {active && status === 'playing' && <CueMeter />}
    </span>
  );
}

function CueMeter(): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = (): void => {
      const db = cuePlayer.levelDb();
      const pct = db === -Infinity ? 0 : Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
      if (ref.current) ref.current.style.width = `${pct}%`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <span className="cue-meter">
      <span className="cue-meter__fill" ref={ref} />
    </span>
  );
}
