import type { DiscoveredDevice } from '@rfutils/shared';
import { LevelMeter } from './LevelMeter.js';
import { BatteryIndicator } from './BatteryIndicator.js';
import { CueButton } from './CueButton.js';

const VENDOR_LABEL: Record<DiscoveredDevice['vendor'], string> = {
  shure: 'Shure',
  sennheiser: 'Sennheiser',
  lectrosonics: 'Lectrosonics',
  'unknown-dante': 'Dante / AES67',
};

/**
 * Ported from MicWizard's DeviceList, minus the local-cue button (audio
 * cueing to browser headphones is out of scope for the web build — the
 * server publishes levels, not raw multicast audio).
 */
export function DeviceList({ devices }: { devices: DiscoveredDevice[] }): JSX.Element {
  if (devices.length === 0) {
    return (
      <p className="device-list__empty">
        No devices found yet. The server is scanning the local network for Shure (TCP 2202),
        Sennheiser (SSC), and AES67/Dante (mDNS + SAP) receivers.
      </p>
    );
  }

  return (
    <div className="device-list">
      {devices.map((device) => (
        <div className="device-card" key={device.id}>
          <div className="device-card__header">
            <span className={`device-card__badge device-card__badge--${device.vendor}`}>
              {VENDOR_LABEL[device.vendor]}
            </span>
            <h3>{device.name}</h3>
            <span className="device-card__address">
              {device.address}
              {device.port ? `:${device.port}` : ''}
            </span>
            {!device.identified && (
              <span className="device-card__unidentified">seen, not yet identified</span>
            )}
          </div>
          <div className="device-card__channels">
            {device.channels.length === 0 && (
              <p className="device-card__no-channels">No channel data yet</p>
            )}
            {device.channels.map((channel) => (
              <div className="channel-row channel-row--web" key={channel.id}>
                <span className="channel-row__name">{channel.name}</span>
                <LevelMeter label="Audio" db={channel.audioLevelDb} />
                {channel.rfLevel !== null && <LevelMeter label="RF" db={channel.rfLevel - 100} />}
                <BatteryIndicator
                  percent={channel.batteryPercent}
                  minutesRemaining={channel.batteryMinutesRemaining}
                />
                <CueButton channelId={channel.id} transport={device.transport} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
