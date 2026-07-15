/**
 * BLOCKED: full Dante API integration requires Audinate's Dante API SDK,
 * distributed only through Audinate's Dante Developer Program (application +
 * NDA + license). It can't be fetched or bundled on your behalf. Until the
 * SDK is in hand, this defines the interface AES67 already satisfies so a
 * real client can drop in later. Ported verbatim from MicWizard.
 */
export interface DanteApiTransport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  listDevices(): Promise<{ id: string; name: string; address: string }[]>;
}

export function createDanteApiTransport(): DanteApiTransport {
  throw new Error(
    'Dante API transport is not implemented. Apply to https://developer.audinate.com for SDK access, ' +
      'then implement this against the SDK headers. Use AES67 monitoring until then.'
  );
}
