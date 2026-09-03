import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { connectDeviceStore, useDeviceStore } from '../store.js';
import { DeviceList } from '../components/DeviceList.js';
import { RoutingPanel } from '../components/RoutingPanel.js';
import type { JSX } from 'react';

/** Live receiver monitoring — the MicWizard dashboard, over WebSocket. */
export function MonitorTab(): JSX.Element {
  // See RoutingPanel: zustand v5 compares by reference, so a selector that
  // materialises the Map into a new array on every call loops until React
  // throws. `connected` is a primitive and needs no wrapper.
  const devices = useDeviceStore(useShallow((state) => [...state.devices.values()]));
  const connected = useDeviceStore((state) => state.connected);

  useEffect(() => {
    const disconnect = connectDeviceStore();
    return disconnect;
  }, []);

  return (
    <div className="tab-panel">
      <div className="tab-panel__intro">
        <p>
          Discovering Shure, Sennheiser, and AES67/Dante receivers on the local network and metering
          audio / battery / RF in real time.
        </p>
        <span className={`conn-pill conn-pill--${connected ? 'ok' : 'down'}`}>
          {connected ? 'live' : 'connecting…'}
        </span>
      </div>
      <DeviceList devices={devices} />
      <RoutingPanel />
    </div>
  );
}
