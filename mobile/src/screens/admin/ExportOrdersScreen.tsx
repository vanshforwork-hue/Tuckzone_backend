import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { FileSpreadsheet, FileText } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import { Button } from '../../components/Button';
import { DateField } from '../../components/DateField';
import { adminApi } from '../../api/admin';
import { apiErrorMessage } from '../../api/client';
import { colors, spacing, typography } from '../../theme';
import type { OrderStatus } from '../../api/types';

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const STATUS_FILTERS: (OrderStatus | 'ALL')[] = [
  'ALL',
  'PLACED',
  'DELIVERED',
  'REJECTED',
  'CANCELLED',
];

async function shareBuffer(buffer: ArrayBuffer, filename: string, mimeType: string) {
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true, intermediates: true });
  file.write(new Uint8Array(buffer));

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    Toast.show({ type: 'error', text1: 'Sharing is not available on this device' });
    return;
  }
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: filename });
}

export function ExportOrdersScreen() {
  const [date, setDate] = useState(todayIso());
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const status = statusFilter === 'ALL' ? undefined : statusFilter;

  async function handleExportExcel() {
    setExportingExcel(true);
    try {
      const buffer = await adminApi.exportOrdersExcel(date, status);
      await shareBuffer(buffer, `orders-${date}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } catch (error) {
      Toast.show({ type: 'error', text1: apiErrorMessage(error, 'Export failed') });
    } finally {
      setExportingExcel(false);
    }
  }

  async function handleExportPdf() {
    setExportingPdf(true);
    try {
      const buffer = await adminApi.exportOrdersPdf(date, status);
      await shareBuffer(buffer, `orders-${date}.pdf`, 'application/pdf');
    } catch (error) {
      Toast.show({ type: 'error', text1: apiErrorMessage(error, 'Export failed') });
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <ScreenContainer edges={['top']}>
      <Text style={typography.h1}>Export Orders</Text>
      <Text style={styles.subtitle}>Download orders for a date as Excel or PDF</Text>

      <DateField label="Date" value={date} onChange={setDate} />

      <Text style={[typography.bodyMedium, styles.filterLabel]}>Status</Text>
      <View style={styles.chipRow}>
        {STATUS_FILTERS.map((s) => (
          <Chip key={s} label={s.replace(/_/g, ' ')} active={statusFilter === s} onPress={() => setStatusFilter(s)} />
        ))}
      </View>

      <Card style={styles.actionsCard}>
        <Button
          label="Export as Excel"
          icon={<FileSpreadsheet size={18} color={colors.textOnPrimary} />}
          onPress={handleExportExcel}
          loading={exportingExcel}
        />
        <Button
          label="Export as PDF"
          variant="secondary"
          icon={<FileText size={18} color={colors.textPrimary} />}
          onPress={handleExportPdf}
          loading={exportingPdf}
          style={styles.pdfButton}
        />
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  subtitle: { ...typography.bodySmall, marginTop: 2, marginBottom: spacing.lg },
  filterLabel: { marginTop: spacing.lg, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionsCard: { marginTop: spacing.xl, gap: spacing.sm },
  pdfButton: { marginTop: 0 },
});
