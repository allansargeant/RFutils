import { create } from 'zustand';
import type { DiscoveredDevice, ServerToClientEvent } from '@rfutils/shared';
import { connectDeviceSocket } from './api.js';

interface DeviceStoreState {
  devices: Map<string, DiscoveredDevice>;
  connected: boolean;
  upsert: (device: DiscoveredDevice) => void;
  remove: (deviceId: string) => void;
  snapshot: (devices: DiscoveredDevice[]) => void;
  setConnected: (connected: boolean) => void;
}

export const useDeviceStore = create<DeviceStoreState>((set) => ({
  devices: new Map(),
  connected: false,
  upsert: (device) =>
    set((state) => {
      const devices = new Map(state.devices);
      devices.set(device.id, device);
      return { devices };
    }),
  remove: (deviceId) =>
    set((state) => {
      const devices = new Map(state.devices);
      devices.delete(deviceId);
      return { devices };
    }),
  snapshot: (list) => set({ devices: new Map(list.map((d) => [d.id, d])) }),
  setConnected: (connected) => set({ connected }),
}));

/** Wire the device store to the server WebSocket. Returns a disconnect fn. */
export function connectDeviceStore(): () => void {
  const store = useDeviceStore.getState();
  return connectDeviceSocket(
    (event: ServerToClientEvent) => {
      switch (event.type) {
        case 'devices-snapshot':
          store.snapshot(event.devices);
          break;
        case 'device-updated':
          store.upsert(event.device);
          break;
        case 'device-removed':
          store.remove(event.deviceId);
          break;
        case 'discovery-status':
          break;
      }
    },
    (open) => store.setConnected(open)
  );
}
