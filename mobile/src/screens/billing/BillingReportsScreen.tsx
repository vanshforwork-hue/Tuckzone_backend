import React, { useCallback, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { FileSpreadsheet } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { DateField } from '../../components/DateField';
import { SegmentedControl } from '../../components/SegmentedControl';
import { LoadingView } from '../../components/LoadingView';
import { apiErrorMessage } from '../../api/client';
import { billingApi, type Granularity, type SalesSummary } from '../../api/billing';
import { colors, spacing, typography } from '../../theme';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function BillingReportsScreen() {
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [g, setG] = useState<Granularity>('DAY');
  const [data, setData] = useState<SalesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await billingApi.summary(from, to, g));
    } catch (e) {
      setData(null);
      Toast.show({ type: 'error', text1: apiErrorMessage(e, 'Failed to load report') });
    } finally {
      setLoading(false);
    }
  }, [from, to, g]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function exportXlsx() {
    setExporting(true);
    try {
      const buffer = await billingApi.exportXlsx(from, to);
      const name = `billing-${from}_${to}.xlsx`;
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([buffer], { type: XLSX }));
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }
      const file = new File(Paths.cache, name);
      file.create({ overwrite: true, intermediates: true });
      file.write(new Uint8Array(buffer));
      if (!(await Sharing.isAvailableAsync())) {
        Toast.show({ type: 'error', text1: 'Sharing is not available on this device' });
        return;
      }
      await Sharing.shareAsync(file.uri, { mimeType: XLSX, dialogTitle: name });
    } catch (e) {
      Toast.show({ type: 'error', text1: apiErrorMessage(e, 'Export failed') });
    } finally {
      setExporting(false);
    }
  }

  return (
    <ScreenContainer onRefresh={load} refreshing={loading && !!data}>
      <Text style={typography.h1}>Billing reports</Text>
      <Text style={styles.sub}>Completed bills only. Voided bills are excluded from sales.</Text>
      <DateField label="From" value={from} onChange={(v) => { setFrom(v); if (v > to) setTo(v); }} />
      <DateField label="To" value={to} onChange={setTo} />
      <SegmentedControl options={[{ value: 'DAY', label: 'Daily' }, { value: 'WEEK', label: 'Weekly' }, { value: 'MONTH', label: 'Monthly' }]} value={g} onChange={setG} />

      {loading && !data ? <LoadingView /> : data && (
        <>
          <Card style={styles.card}>
            <Row label="Bills" value={String(data.bills)} />
            <Row label="Subtotal" value={data.subtotal.toFixed(2)} />
            <Row label="GST collected" value={data.gst.toFixed(2)} />
            <Row label="Total sales" value={data.total.toFixed(2)} bold />
            <Row label={`Voided (${data.voidedBills})`} value={data.voidedTotal.toFixed(2)} />
          </Card>

          <Text style={[typography.h3, styles.h]}>By period</Text>
          {data.periods.length === 0 && <Text style={typography.caption}>No sales in this range.</Text>}
          {data.periods.map((p) => (
            <Row key={p.periodStart} label={`${p.periodStart} (${p.bills})`} value={p.total.toFixed(2)} />
          ))}

          <Text style={[typography.h3, styles.h]}>By payment method (as recorded)</Text>
          {data.byPayment.map((p) => <Row key={p.method} label={`${p.method} (${p.bills})`} value={p.total.toFixed(2)} />)}

          <Text style={[typography.h3, styles.h]}>By item</Text>
          {data.byItem.map((i) => <Row key={i.itemName} label={`${i.itemName} × ${i.quantity}`} value={i.total.toFixed(2)} />)}

          <Button label="Export to Excel" icon={<FileSpreadsheet size={18} color={colors.textOnPrimary} />}
            onPress={exportXlsx} loading={exporting} style={{ marginTop: spacing.xl }} />
        </>
      )}
    </ScreenContainer>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={bold ? typography.bodyMedium : typography.body}>{label}</Text>
      <Text style={bold ? typography.bodyMedium : typography.body}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sub: { ...typography.bodySmall, marginTop: 2, marginBottom: spacing.md },
  card: { marginTop: spacing.lg },
  h: { marginTop: spacing.xl, marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
});
