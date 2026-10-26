import { chunk } from './escpos.ts';

/** Pure print plumbing (no React Native imports, node-testable). */

/** Save the bill ONCE, then try to print it. A print failure never undoes or repeats the save. */
export async function saveThenPrint<B>(
  save: () => Promise<B>,
  print: (bill: B) => Promise<void>,
): Promise<{ bill: B; printError: string | null }> {
  const bill = await save(); // a save failure propagates: nothing is printed, the cart is untouched
  return { bill, printError: await tryPrint(bill, print) };
}

/** Retry Print: reuses the saved bill, never calls save. */
export async function tryPrint<B>(bill: B, print: (bill: B) => Promise<void>): Promise<string | null> {
  try {
    await print(bill);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Printing failed.';
  }
}

export const savedButNotPrinted = (reason: string) =>
  `Bill saved, but printing failed: ${reason} Retry printing this bill.`;

/** Minimal transport: a connected RFCOMM/SPP socket. `data` is a latin1 binary string. */
export interface Transport {
  isConnected(): Promise<boolean>;
  write(data: string): Promise<unknown>;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('The printer did not respond in time.')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/** Binary-safe: one char per byte, written with the 'latin1' encoding. */
export const toBinaryString = (b: Uint8Array) => Array.from(b, (x) => String.fromCharCode(x)).join('');

export class PrinterWriteError extends Error {
  readonly disconnected: boolean;
  constructor(message: string, disconnected: boolean) {
    super(message);
    this.disconnected = disconnected;
  }
}

/** Chunked so a long receipt is not one huge write; every failure mode becomes a readable message. */
export async function sendBytes(t: Transport, bytes: Uint8Array, opts: { chunkSize?: number; timeoutMs?: number } = {}): Promise<void> {
  const { chunkSize = 512, timeoutMs = 10_000 } = opts;
  if (!(await withTimeout(t.isConnected(), timeoutMs).catch(() => false))) {
    throw new PrinterWriteError('The printer is not connected.', true);
  }
  for (const part of chunk(bytes, chunkSize)) {
    try {
      await withTimeout(t.write(toBinaryString(part)), timeoutMs);
    } catch (e) {
      throw new PrinterWriteError(`Could not send data to the printer (${e instanceof Error ? e.message : 'write failed'}).`, true);
    }
  }
}
