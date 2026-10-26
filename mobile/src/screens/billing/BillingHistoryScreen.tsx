import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Printer, Receipt } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Chip } from '../../components/Chip';
import { DateField } from '../../components/DateField';
import { EmptyState } from '../../components/EmptyState';
import { LoadingView } from '../../components/LoadingView';
import { apiErrorMessage } from '../../api/client';
import { billingApi, type BillPage, type BillStatus } from '../../api/billing';
import { printReceipt } from '../../utils/receipt';
import { useAuth } from '../../context/AuthContext';
import { colors, radius, spacing, typography } from '../../theme';
import type { BillingStackParamList } from '../../navigation/types';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function BillingHistoryScreen() {
  const nav = useNavigation<NativeStackNavigationProp<BillingStackParamList>>();
  const { user } = useAuth();
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [status, setStatus] = useState<BillStatus | 'ALL'>('ALL');
  const [q, setQ] = useState('');
  const [data, setData] = useState<BillPage | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await billingApi.listBills({ from, to, status: status === 'ALL' ? undefined : status, q: q.trim() || undefined, size: 100 }));
    } catch (e) {
      Toast.show({ type: 'error', text1: apiErrorMessage(e, 'Failed to load bills') });
    } finally {
      setLoading(false);
    }
  }, [from, to, status, q]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  /** Reprint = read the stored bill and print it; nothing is created. */
  async function reprint(id: string) {
    try {
      await printReceipt(await billingApi.getBill(id));
    } catch (e) {
      Toast.show({ type: 'error', text1: apiErrorMessage(e, 'Could not print') });
    }
  }

  return (
    <ScreenContainer onRefresh={load} refreshing={loading && !!data}>
      <Text style={typography.h1}>Bills</Text>
      <Text style={styles.sub}>{user?.role === 'SUB_ADMIN' ? 'Bills you created' : 'All bills'}</Text>
      <DateField label="From" value={from} onChange={(v) => { setFrom(v); if (v > to) setTo(v); }} />
      <DateField label="To" value={to} onChange={setTo} />
      <TextInput value={q} onChangeText={setQ} onSubmitEditing={load} placeholder="Search bill number"
        placeholderTextColor={colors.textTertiary} style={styles.search} autoCapitalize="characters" />
      <View style={styles.chips}>
        {(['ALL', 'COMPLETED', 'VOID'] as const).map((s) => (
          <Chip key={s} label={s === 'ALL' ? 'All' : s === 'VOID' ? 'Void' : 'Completed'} active={status === s} onPress={() => setStatus(s)} />
        ))}
      </View>

      {loading && !data ? <LoadingView /> : !data || data.content.length === 0 ? (
        <EmptyState icon={<Receipt size={28} color={colors.textTertiary} />} title="No bills found" message="Try a different date range." />
      ) : (
        data.content.map((b) => (
          <Pressable key={b.id} onPress={() => nav.navigate('BillDetail', { billId: b.id })}>
            <Card style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={typography.bodyMedium}>{b.invoiceNumber}</Text>
                <Text style={typography.caption}>
                  {new Date(b.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                  {' · '}{b.itemCount} items{b.paymentMethod ? ` · ${b.paymentMethod}` : ''}{b.createdByName ? ` · ${b.createdByName}` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={typography.bodyMedium}>{b.total.toFixed(2)}</Text>
                {b.status === 'VOID' && <Badge label="CANCELLED" displayText="VOID" />}
              </View>
              <Pressable hitSlop={8} onPress={() => reprint(b.id)} accessibilityLabel={`Print ${b.invoiceNumber}`}>
                <Printer size={20} color={colors.primary} />
              </Pressable>
            </Card>
          </Pressable>
        ))
      )}
      {data && data.totalElements > data.content.length && (
        <Text style={styles.sub}>Showing {data.content.length} of {data.totalElements}. Narrow the date range to see the rest.</Text>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  sub: { ...typography.bodySmall, marginTop: 2, marginBottom: spacing.md },
  search: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.DEFAULT, padding: spacing.md,
    marginVertical: spacing.sm, color: colors.textPrimary, backgroundColor: colors.surface,
  },
  chips: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm },
});
