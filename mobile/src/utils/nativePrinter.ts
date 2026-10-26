import { PermissionsAndroid, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { Bill } from '../api/billing';
import { WIDTH_MM_TO_CHARS, receiptEscPos, testEscPos } from './escpos';
import { PrinterWriteError, sendBytes, type Transport } from './printFlow';

/**
 * Direct Bluetooth Classic (SPP/RFCOMM) ESC/POS printing for Android, through
 * react-native-bluetooth-classic. Needs a development/production build: it does not exist in Expo Go.
 * Unverified on the SEZNIK B-41: SEZNIK publishes no protocol document for that model, so this is a
 * generic ESC/POS-over-SPP adapter. Only a printed slip proves a given printer works.
 */

export interface PrinterPrefs { address: string | null; name: string | null; widthMm: 57 | 80; cutter: boolean }
export type PrinterState = 'idle' | 'connecting' | 'connected' | 'error';
export interface PrinterStatus { state: PrinterState; deviceName: string | null; message: string }
export interface PairedDevice { address: string; name: string }

type Socket = Transport & { disconnect(): Promise<boolean> };
interface RawDevice { isConnected(): Promise<boolean>; write(d: string, enc: 'latin1'): Promise<unknown>; disconnect(): Promise<boolean> }

const PREFS_KEY = 'tz.printerPrefs';
let prefs: PrinterPrefs = { address: null, name: null, widthMm: 57, cutter: false };
let prefsLoaded = false;
let status: PrinterStatus = { state: 'idle', deviceName: null, message: 'Not connected' };
let socket: Socket | null = null;
const listeners = new Set<(s: PrinterStatus) => void>();

// Lazy so the web bundle never loads the native module.
function lib() {
  if (Platform.OS !== 'android') throw new Error('Direct printing is only available in the Android app.');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require('react-native-bluetooth-classic');
  if (!m?.default) throw new Error('Bluetooth printing is not part of this build. Install the latest TuckZone app.');
  return m.default as {
    isBluetoothEnabled(): Promise<boolean>;
    requestBluetoothEnabled(): Promise<boolean>;
    getBondedDevices(): Promise<PairedDevice[]>;
    connectToDevice(address: string, o?: object): Promise<RawDevice>;
  };
}

function set(next: Partial<PrinterStatus>) {
  status = { ...status, ...next };
  listeners.forEach((l) => l(status));
}
export const getStatus = () => status;
export function subscribe(l: (s: PrinterStatus) => void) { listeners.add(l); return () => { listeners.delete(l); }; }
export const isConnected = () => status.state === 'connected';

export async function loadPrefs(): Promise<PrinterPrefs> {
  if (!prefsLoaded) {
    prefsLoaded = true;
    try {
      const raw = await SecureStore.getItemAsync(PREFS_KEY);
      if (raw) prefs = { ...prefs, ...JSON.parse(raw) };
    } catch { /* unreadable prefs: defaults */ }
  }
  return prefs;
}
export async function savePrefs(p: Partial<PrinterPrefs>) {
  prefs = { ...(await loadPrefs()), ...p };
  if (prefs.widthMm !== 57 && prefs.widthMm !== 80) prefs.widthMm = 57;
  try { await SecureStore.setItemAsync(PREFS_KEY, JSON.stringify(prefs)); } catch { /* kept in memory */ }
  return prefs;
}

/** Runtime permission + adapter on. Throws a message the cashier can act on. */
export async function ensureReady(): Promise<void> {
  const bt = lib();
  if (Number(Platform.Version) >= 31) {
    const r = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    ]);
    if (r['android.permission.BLUETOOTH_CONNECT'] !== 'granted') {
      throw new Error('Bluetooth permission was denied. Allow "Nearby devices" for TuckZone in Android Settings > Apps.');
    }
  }
  if (!(await bt.isBluetoothEnabled())) {
    const on = await bt.requestBluetoothEnabled().catch(() => false);
    if (!on) throw new Error('Bluetooth is turned off. Turn it on and try again.');
  }
}

/** Printers must be paired in Android Bluetooth settings first; this lists those. */
export async function listPaired(): Promise<PairedDevice[]> {
  await ensureReady();
  return (await lib().getBondedDevices()).map((d) => ({ address: d.address, name: d.name || d.address }));
}

export async function connect(address: string, name: string): Promise<void> {
  set({ state: 'connecting', deviceName: name, message: 'Connecting...' });
  try {
    await ensureReady();
    await disconnect(true);
    // RFCOMM SPP; the library defaults to the standard serial-port UUID.
    const raw = await lib().connectToDevice(address, { delimiter: '', secureSocket: false });
    // latin1: one byte per char, so ESC/POS control bytes above 0x7f survive intact
    socket = { isConnected: () => raw.isConnected(), write: (d) => raw.write(d, 'latin1'), disconnect: () => raw.disconnect() };
    await savePrefs({ address, name });
    set({ state: 'connected', deviceName: name, message: 'Connected' });
  } catch (e) {
    socket = null;
    const msg = e instanceof Error ? e.message : 'Could not connect.';
    set({ state: 'error', deviceName: name, message: `${msg} Check that the printer is on and in range.` });
    throw new Error(status.message);
  }
}

export async function disconnect(quiet = false) {
  const s = socket;
  socket = null;
  try { await s?.disconnect(); } catch { /* already gone */ }
  if (!quiet) set({ state: 'idle', message: 'Not connected' });
}

/** Reconnects to the SAVED printer when the link dropped; never invents a connection. */
async function ensureConnected(): Promise<void> {
  if (socket && (await socket.isConnected().catch(() => false))) return;
  if (socket) { socket = null; set({ state: 'error', message: 'The printer disconnected.' }); }
  const p = await loadPrefs();
  if (!p.address) throw new Error('No printer selected. Open Billing > Printer to connect one.');
  await connect(p.address, p.name ?? p.address);
}

async function send(bytes: Uint8Array) {
  await ensureConnected();
  try {
    await sendBytes(socket!, bytes);
  } catch (e) {
    if (e instanceof PrinterWriteError && e.disconnected) {
      await disconnect(true);
      set({ state: 'error', message: e.message });
    }
    throw e;
  }
}

/** Direct print of a SAVED bill. Never creates or changes a sale. */
export async function printBill(bill: Bill) {
  const p = await loadPrefs();
  await send(receiptEscPos(bill, WIDTH_MM_TO_CHARS[p.widthMm], p.cutter));
}

/** Sample slip marked "TEST PRINT - NOT A SALE". No API call. */
export async function printTest() {
  const p = await loadPrefs();
  await send(testEscPos(WIDTH_MM_TO_CHARS[p.widthMm], p.cutter));
}
