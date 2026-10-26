import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { testEscPos } from '../../utils/escpos';
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
              onPress={() => { setNote(''); void ble.connect(nav as ble.BluetoothLike); }}
            />
          )}
          {note ? <Text style={typography.bodySmall}>{note}</Text> : null}
        </>
      )}
    </Card>
  );
}

/** Explains how receipts are printed on this device and, on web, connects a BLE printer. */
export function BillingPrinterScreen() {
  return (
    <ScreenContainer maxWidth={560}>
      <Text style={typography.h1}>Printing</Text>
      <Text style={styles.sub}>How receipts are printed on this device</Text>

      {isWeb ? <BluetoothCard /> : null}

      <Card style={styles.card}>
        <Text style={typography.h3}>{isWeb ? 'Browser print (fallback)' : 'System share sheet (this device)'}</Text>
        {isWeb ? (
          <Text style={typography.body}>
            Used whenever no Bluetooth printer is connected. Print receipt opens your browser's print dialog with a
            compact 80 mm receipt. Choose any printer installed on this computer there, including a USB or network
            thermal printer whose driver is installed, or "Save as PDF". For a thermal roll, set margins to None and
            paper to the roll size.
          </Text>
        ) : (
          <Text style={typography.body}>
            Print receipt opens Android's share sheet with the receipt as text. From there you can send it to a
            print service you have installed, save it, or message it. This is not direct printer support; the
            app does not connect to printers itself.
          </Text>
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={typography.h3}>Where to print</Text>
        <Text style={typography.body}>
          • After a bill: Billing → Generate bill → Print receipt.{'\n'}
          • Later: Billing → Bills → the printer icon on a bill, or open the bill and press Print / share receipt.
          {'\n'}• Reprinting reads the saved bill. It never creates a new bill or changes totals.
        </Text>
      </Card>

      <Card style={styles.card}>
        <Text style={typography.h3}>Other direct printing</Text>
        <Text style={typography.body}>
          Android app: not available in this version (needs a development build with a native Bluetooth Classic
          printer module and a physical printer). Web: BLE printers only, see above. Neither works in Expo Go.
        </Text>
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  sub: { ...typography.bodySmall, marginTop: 2, marginBottom: spacing.lg, color: colors.textSecondary },
  card: { marginBottom: spacing.md, gap: spacing.sm },
});
