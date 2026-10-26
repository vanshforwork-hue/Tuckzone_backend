import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { testEscPos } from '../../utils/escpos';
import * as nativePrinter from '../../utils/nativePrinter';
import { Chip } from '../../components/Chip';
import * as ble from '../../utils/webBluetoothPrinter';
import { colors, spacing, typography } from '../../theme';

const isWeb = Platform.OS === 'web';

/** Web only: Chrome/Edge Web Bluetooth to a BLE ESC/POS printer. */
function BluetoothCard() {
  const [st, setSt] = useState(ble.getStatus());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  useEffect(() => ble.subscribe(setSt), []);
  const nav = (globalThis as { navigator?: { bluetooth?: ble.BluetoothLike } }).navigator;
  const support = ble.detectSupport(nav, (globalThis as { isSecureContext?: boolean }).isSecureContext);

  const test = async () => {
    setBusy(true);
    setNote('');
    try {
      await ble.send(testEscPos());
      setNote('Test data sent. Check the paper: only a printed slip proves it worked.');
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Test print failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={styles.card}>
      <Text style={typography.h3}>Bluetooth printer (Chrome / Edge)</Text>
      {!support.ok ? (
        <Text style={typography.body}>{support.reason} Browser print below still works.</Text>
      ) : (
        <>
          <Text style={typography.body}>
            Status: {st.state}
            {st.deviceName ? ` (${st.deviceName})` : ''}
            {st.message ? `\n${st.message}` : ''}
          </Text>
          <Text style={typography.bodySmall}>
            Works only with Bluetooth Low Energy (BLE) ESC/POS printers. Classic Bluetooth printers (most printers
            you pair in system settings) do not appear here: use browser print or the Android app. Pick the printer
            in Chrome's chooser; system pairing is not needed.
          </Text>
          {st.state === 'connected' ? (
            <>
              <Button label="Test print" onPress={test} loading={busy} />
              <Button label="Disconnect" variant="secondary" onPress={() => { ble.disconnect(); setNote(''); }} />
              <Text style={typography.bodySmall}>While connected, Print receipt sends straight to this printer.</Text>
            </>
          ) : (
            <Button
              label="Connect Bluetooth printer"
              loading={st.state === 'connecting'}
              onPress={() => { setNote(''); void ble.connect(nav!.bluetooth!); }}
            />
          )}
          {note ? <Text style={typography.bodySmall}>{note}</Text> : null}
        </>
      )}
    </Card>
  );
}

/** Android: direct Bluetooth Classic (SPP) ESC/POS printing to a printer paired in Android settings. */
function NativePrinterCard() {
  const [st, setSt] = useState(nativePrinter.getStatus());
  const [prefs, setPrefs] = useState<nativePrinter.PrinterPrefs | null>(null);
  const [devices, setDevices] = useState<nativePrinter.PairedDevice[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  useEffect(() => nativePrinter.subscribe(setSt), []);
  useEffect(() => { nativePrinter.loadPrefs().then(setPrefs); }, []);

  const run = async (fn: () => Promise<void>, ok = '') => {
    setBusy(true);
    setNote('');
    try { await fn(); setNote(ok); } catch (e) { setNote(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
  };
  const update = async (p: Partial<nativePrinter.PrinterPrefs>) => setPrefs(await nativePrinter.savePrefs(p));

  return (
    <Card style={styles.card}>
      <Text style={typography.h3}>Bluetooth thermal printer</Text>
      <Text style={typography.body}>
        Status: {st.state === 'connected' ? `Connected to ${st.deviceName}` : st.state === 'connecting' ? 'Connecting...' : st.message}
      </Text>
      <Text style={typography.bodySmall}>
        First pair the printer in Android Settings &gt; Bluetooth (PIN is often 0000 or 1234), then pick it here.
        Works with printers that accept ESC/POS over Bluetooth Classic (SPP). "Connected" means a link was
        opened, not that paper will print: use Test print to confirm.
      </Text>
      <Button label={devices ? 'Refresh paired printers' : 'Choose paired printer'} variant="secondary" loading={busy}
        onPress={() => run(async () => setDevices(await nativePrinter.listPaired()))} />
      {devices && devices.length === 0 && <Text style={typography.bodySmall}>No paired Bluetooth devices. Pair the printer in Android settings first.</Text>}
      {devices?.map((d) => (
        <Button key={d.address} label={`${d.name}${prefs?.address === d.address ? ' (saved)' : ''}`} variant="secondary" disabled={busy}
          onPress={() => run(() => nativePrinter.connect(d.address, d.name), 'Connected. Press Test print to confirm.')} />
      ))}
      <Text style={typography.bodyMedium}>Paper width</Text>
      <View style={styles.chips}>
        {([57, 80] as const).map((w) => (
          <Chip key={w} label={`${w} mm`} active={prefs?.widthMm === w} onPress={() => update({ widthMm: w })} />
        ))}
      </View>
      <View style={styles.chips}>
        <Chip label={prefs?.cutter ? 'Cutter: on' : 'Cutter: off'} active={!!prefs?.cutter} onPress={() => update({ cutter: !prefs?.cutter })} />
      </View>
      <Text style={typography.bodySmall}>Turn the cutter on only if the printer has an auto-cutter; otherwise the cut command is never sent.</Text>
      <Button label="Test print" loading={busy} disabled={busy}
        onPress={() => run(() => nativePrinter.printTest(), 'Test data sent. Only a printed slip proves it worked. Not a sale.')} />
      {st.state === 'connected' && <Button label="Disconnect" variant="secondary" onPress={() => { nativePrinter.disconnect(); setNote(''); }} />}
      {note ? <Text style={typography.bodySmall}>{note}</Text> : null}
    </Card>
  );
}

/** Explains how receipts are printed on this device and, on web, connects a BLE printer. */
export function BillingPrinterScreen() {
  return (
    <ScreenContainer maxWidth={560}>
      <Text style={typography.h1}>Printing</Text>
      <Text style={styles.sub}>How receipts are printed on this device</Text>

      {isWeb ? <BluetoothCard /> : <NativePrinterCard />}

      {isWeb && (
        <Card style={styles.card}>
          <Text style={typography.h3}>Browser print (fallback)</Text>
          <Text style={typography.body}>
            Used whenever no Bluetooth printer is connected. Print receipt opens your browser's print dialog with a
            compact 80 mm receipt. Choose any printer installed on this computer there, or "Save as PDF". For a
            thermal roll, set margins to None and paper to the roll size.
          </Text>
        </Card>
      )}

      <Card style={styles.card}>
        <Text style={typography.h3}>Where to print</Text>
        <Text style={typography.body}>
          • After a bill: Billing → View cart → Print Bill (saves once, then prints; Retry Print if it fails).{'\n'}
          • Later: Billing → Bills → the printer icon on a bill, or open the bill and press Print / share receipt.
          {'\n'}• Reprinting reads the saved bill. It never creates a new bill or changes totals.
        </Text>
      </Card>

    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  sub: { ...typography.bodySmall, marginTop: 2, marginBottom: spacing.lg, color: colors.textSecondary },
  card: { marginBottom: spacing.md, gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
