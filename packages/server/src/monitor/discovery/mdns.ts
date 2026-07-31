import { Bonjour, Service } from 'bonjour-service';
import type { DeviceRegistry } from '../deviceRegistry.js';

type ServiceInfo = InstanceType<typeof Service>;

/** Dante + Sennheiser SSC mDNS discovery. Ported verbatim from MicWizard.
 * Dante carries no control-plane info over mDNS — this only confirms a Dante
 * device exists at an address; vendor identity comes from vendor adapters. */
const DANTE_SERVICE_TYPES = ['netaudio-arc', 'netaudio-chan'] as const;
const SENNHEISER_SSC_SERVICE_TYPE = 'ssc';

export interface MdnsDiscoveryHandle {
  stop: () => void;
}

export function startMdnsDiscovery(registry: DeviceRegistry): MdnsDiscoveryHandle {
  const bonjour = new Bonjour();
  // The service type is kept beside each browser, not just closed over by the 'up'
  // handler, because the refresh below has to re-upsert from the browser's own
  // service list and still know whether it is looking at Sennheiser or Dante.
  const watch = (type: string, protocol: 'tcp' | 'udp') => {
    const browser = bonjour.find({ type, protocol });
    browser.on('up', (service: ServiceInfo) => handleService(registry, type, service));
    browser.on('down', (service: ServiceInfo) => registry.remove(serviceId(service)));
    return { type, browser };
  };

  const allBrowsers = [
    ...[...DANTE_SERVICE_TYPES, SENNHEISER_SSC_SERVICE_TYPE].map((type) => watch(type, 'tcp')),
    // Dante's own services are UDP, not TCP.
    ...DANTE_SERVICE_TYPES.map((type) => watch(type, 'udp')),
  ];

  /**
   * Re-assert every service still being advertised, and re-query for them.
   *
   * `up` fires once per service, but the registry's pruneStale() drops anything
   * not re-upserted within its window — so a Dante box that was still sitting
   * there happily advertising itself silently disappeared from the list a couple
   * of minutes after it was found. Vendor adapters never hit this because their
   * metering re-upserts constantly; an mDNS-only device has nothing else touching
   * it.
   *
   * Reading each browser's own list rather than a cache of our own is what keeps
   * this honest: bonjour expires a service on TTL or a goodbye packet and stops
   * returning it, so a device that really has gone stops being refreshed and is
   * pruned as intended.
   */
  const refreshTimer = setInterval(() => {
    for (const { type, browser } of allBrowsers) {
      browser.update();
      for (const service of browser.services) handleService(registry, type, service);
    }
  }, REFRESH_INTERVAL_MS);

  return {
    stop: () => {
      clearInterval(refreshTimer);
      for (const { browser } of allBrowsers) browser.stop();
      bonjour.destroy();
    },
  };
}

/** Comfortably inside the registry's 120s staleness window, so a live device never
 *  gets close to being pruned, without re-querying the network constantly. */
const REFRESH_INTERVAL_MS = 30_000;

function serviceId(service: ServiceInfo): string {
  return `mdns:${service.fqdn}`;
}

function handleService(
  registry: DeviceRegistry,
  serviceType: string,
  service: ServiceInfo
): void {
  const address = service.referer?.address ?? service.addresses?.[0];
  if (!address) return;

  const isSennheiser = serviceType === SENNHEISER_SSC_SERVICE_TYPE;
  registry.upsert({
    id: serviceId(service),
    vendor: isSennheiser ? 'sennheiser' : 'unknown-dante',
    name: service.name,
    address,
    port: service.port,
    transport: isSennheiser ? 'none' : 'aes67',
  });
}
