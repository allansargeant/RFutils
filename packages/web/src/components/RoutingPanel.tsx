import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { CompanionStatus } from '@rfutils/shared';
import { useDeviceStore } from '../store.js';
import { companionStatus, makeCrosspoint, clearCrosspoint } from '../api.js';

type SubmitState = 'idle' | 'sending' | 'ok' | 'error';

const FIELD_LABELS = {
  sourceChannel: 'Source channel',
  sourceDevice: 'Source device',
  destinationChannel: 'Destination channel',
  destinationDevice: 'Destination device',
} as const;

/** Ported from MicWizard's RoutingPanel; window.micMonitor IPC → REST client. */
export function RoutingPanel(): JSX.Element | null {
  const [status, setStatus] = useState<CompanionStatus | null>(null);
  const [fields, setFields] = useState({
    sourceChannel: '',
    sourceDevice: '',
    destinationChannel: '',
    destinationDevice: '',
  });
  const [routeState, setRouteState] = useState<SubmitState>('idle');
  const [clearState, setClearState] = useState<SubmitState>('idle');
  const [error, setError] = useState<string | null>(null);
  // useShallow is load-bearing, not tidiness. zustand v5 compares the selector's
  // result by reference; a selector building a fresh array every call never
  // compares equal, so it re-renders forever until React throws "Maximum update
  // depth exceeded" — and with no error boundary above it, that unmounts the
  // whole app and leaves a blank page.
  const knownDeviceNames = useDeviceStore(
    useShallow((state) => [...new Set([...state.devices.values()].map((d) => d.name))])
  );

  useEffect(() => {
    companionStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  if (!status) return null;

  if (!status.configured) {
    return (
      <section className="routing-panel routing-panel--unavailable">
        <h2>Dante routing</h2>
        <p>
          No <code>companion-routes.json</code> found — RFutils only monitors audio/battery/RF by
          default. To route Dante channels from here, run your own{' '}
          <a href="https://bitfocus.io/companion" target="_blank" rel="noreferrer">
            Bitfocus Companion
          </a>{' '}
          with a single "Make Crosspoint" button configured (see the README), then place a{' '}
          <code>companion-routes.json</code> in <code>~/.rfutils/</code> (or the directory set by{' '}
          <code>RFUTILS_CONFIG_DIR</code>).
        </p>
      </section>
    );
  }

  const setField =
    (key: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setFields((f) => ({ ...f, [key]: e.target.value }));

  const route = async (): Promise<void> => {
    setRouteState('sending');
    setError(null);
    try {
      await makeCrosspoint(fields);
      setRouteState('ok');
    } catch (err) {
      setRouteState('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const clear = async (): Promise<void> => {
    setClearState('sending');
    setError(null);
    try {
      await clearCrosspoint(fields.destinationChannel, fields.destinationDevice);
      setClearState('ok');
    } catch (err) {
      setClearState('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <section className="routing-panel">
      <h2>
        Dante routing via Companion ({status.host}:{status.port}){' '}
        <span
          className={`routing-panel__reachable routing-panel__reachable--${
            status.reachable ? 'ok' : 'down'
          }`}
        >
          {status.reachable ? 'connected' : 'unreachable'}
        </span>
      </h2>
      <datalist id="known-device-names">
        {knownDeviceNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <div className="routing-panel__form">
        {(Object.keys(FIELD_LABELS) as Array<keyof typeof fields>).map((key) => (
          <label key={key} className="routing-panel__field">
            {FIELD_LABELS[key]}
            <input
              type="text"
              value={fields[key]}
              onChange={setField(key)}
              list={key.startsWith('source') ? 'known-device-names' : undefined}
            />
          </label>
        ))}
      </div>
      <div className="routing-panel__actions">
        <button onClick={route} disabled={routeState === 'sending'}>
          {actionLabel(routeState, 'Route')}
        </button>
        {status.canClear && (
          <button onClick={clear} disabled={clearState === 'sending'}>
            {actionLabel(clearState, 'Clear destination')}
          </button>
        )}
      </div>
      {error && <p className="routing-panel__error">{error}</p>}
    </section>
  );
}

function actionLabel(state: SubmitState, idleLabel: string): string {
  switch (state) {
    case 'sending':
      return 'Sending…';
    case 'ok':
      return `${idleLabel} ✓`;
    case 'error':
      return `${idleLabel} — retry`;
    default:
      return idleLabel;
  }
}
