import { chunk } from './escpos.ts';

/**
 * Chrome Web Bluetooth transport. BLE/GATT only: Bluetooth Classic (SPP/RFCOMM) printers cannot be
 * reached from a browser. Structural types keep this file free of DOM typings and node-testable.
 */

interface Characteristic {
  uuid: string;
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValueWithResponse?(v: Uint8Array): Promise<void>;
  writeValueWithoutResponse?(v: Uint8Array): Promise<void>;
  writeValue?(v: Uint8Array): Promise<void>;
}
interface Service { uuid: string; getCharacteristics(): Promise<Characteristic[]> }
interface Server { connected: boolean; getPrimaryServices(): Promise<Service[]>; disconnect(): void }
interface Device {
  name?: string;
  gatt?: { connect(): Promise<Server> };
  addEventListener(t: 'gattserverdisconnected', f: () => void): void;
  removeEventListener(t: 'gattserverdisconnected', f: () => void): void;
}
export interface BluetoothLike {
  requestDevice(o: { acceptAllDevices: true; optionalServices: string[] }): Promise<Device>;
}

/** GATT services commonly exposed by ESC/POS BLE printers. Chrome only lets us touch services listed here. */
export const PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  'e7810a71-73ae-499d-8c15-faa9aef0c21f',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ae30-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb',
];

export type Support = { ok: true } | { ok: false; reason: string };

export function detectSupport(nav: { bluetooth?: unknown } | undefined, secure: boolean | undefined): Support {
  if (!secure) return { ok: false, reason: 'Web Bluetooth needs a secure page (https:// or localhost).' };
  if (!nav?.bluetooth) {
    return { ok: false, reason: 'This browser has no Web Bluetooth. Use Chrome or Edge on desktop or Android (not iOS, not Firefox).' };
  }
  return { ok: true };
}

export type PrinterState = 'disconnected' | 'connecting' | 'connected' | 'error';
export interface PrinterStatus { state: PrinterState; deviceName?: string; message?: string }

export class PrinterError extends Error {}

const CHUNK = 100; // below typical negotiated ATT payloads (~244); safe on conservative stacks
const TIMEOUT_MS = 8000;

let status: PrinterStatus = { state: 'disconnected' };
let device: Device | undefined;
let server: Server | undefined;
let writer: Characteristic | undefined;
const listeners = new Set<(s: PrinterStatus) => void>();

const set = (s: PrinterStatus) => { status = s; listeners.forEach((f) => f(s)); };
export const getStatus = () => status;
export function subscribe(f: (s: PrinterStatus) => void) { listeners.add(f); return () => { listeners.delete(f); }; }
export const isConnected = () => status.state === 'connected' && !!server?.connected;

const onDrop = () => {
  writer = server = undefined;
  set({ state: 'error', deviceName: device?.name, message: 'Printer disconnected. Reconnect it and try again.' });
};

function withTimeout<T>(p: Promise<T>, what: string): Promise<T> {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new PrinterError(`${what} timed out`)), TIMEOUT_MS);
    p.then((v) => { clearTimeout(t); res(v); }, (e) => { clearTimeout(t); rej(e); });
  });
}

/** Call from a user gesture (click). Reports "connected" only after a writable characteristic is confirmed. */
export async function connect(nav: BluetoothLike): Promise<void> {
  if (status.state === 'connecting') return;
  disconnect();
  set({ state: 'connecting' });
  let picked: Device;
  try {
    picked = await nav.requestDevice({ acceptAllDevices: true, optionalServices: PRINTER_SERVICES });
  } catch (e) {
    const name = (e as { name?: string }).name;
    set(name === 'NotFoundError'
      ? { state: 'disconnected', message: 'No printer selected.' }
      : {
          state: 'error',
          message: name === 'SecurityError' || name === 'NotAllowedError'
            ? 'Bluetooth permission was denied.'
            : `Could not open the device chooser: ${(e as Error).message}`,
        });
    return;
  }
  let srv: Server | undefined;
  try {
    if (!picked.gatt) throw new PrinterError('This device has no GATT interface (it is probably Bluetooth Classic).');
    srv = await withTimeout(picked.gatt.connect(), 'Connecting');
    let found: Characteristic | undefined;
    for (const svc of await withTimeout(srv.getPrimaryServices(), 'Service discovery')) {
      found = (await svc.getCharacteristics()).find((c) => c.properties.write || c.properties.writeWithoutResponse);
      if (found) break;
    }
    if (!found) {
      throw new PrinterError('Connected, but no writable printer characteristic was found. This device is not a supported BLE ESC/POS printer.');
    }
    device = picked;
    server = srv;
    writer = found;
    picked.addEventListener('gattserverdisconnected', onDrop);
    set({ state: 'connected', deviceName: picked.name });
  } catch (e) {
    try { srv?.disconnect(); } catch { /* best effort */ }
    set({ state: 'error', deviceName: picked.name, message: (e as Error).message });
  }
}

export function disconnect(): void {
  device?.removeEventListener('gattserverdisconnected', onDrop);
  if (server?.connected) server.disconnect();
  device = server = writer = undefined;
  set({ state: 'disconnected' });
}

/** Sends bytes in chunks. Throws PrinterError on any failure; never reports success it did not get. */
export async function send(data: Uint8Array): Promise<void> {
  if (!isConnected() || !writer) throw new PrinterError('Printer is not connected.');
  const w = writer;
  try {
    for (const part of chunk(data, CHUNK)) {
      if (!server?.connected) throw new PrinterError('Printer disconnected while printing.');
      if (w.properties.writeWithoutResponse && w.writeValueWithoutResponse) await withTimeout(w.writeValueWithoutResponse(part), 'Write');
      else if (w.writeValueWithResponse) await withTimeout(w.writeValueWithResponse(part), 'Write');
      else await withTimeout(w.writeValue!(part), 'Write');
      await new Promise((r) => setTimeout(r, 20)); // cheap printers drop bytes when flooded
    }
  } catch (e) {
    if (e instanceof PrinterError) throw e;
    throw new PrinterError(`Print failed: ${(e as Error).message}`);
  }
}
