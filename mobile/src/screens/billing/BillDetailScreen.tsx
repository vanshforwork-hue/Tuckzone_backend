import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { Printer } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { LoadingView } from '../../components/LoadingView';
import { apiErrorMessage } from '../../api/client';
import { billingApi, type Bill } from '../../api/billing';
import { useAuth } from '../../context/AuthContext';
import { printReceipt } from '../../utils/receipt';
import { colors, spacing, typography } from '../../theme';
import type { BillingStackParamList } from '../../navigation/types';
import { ConfirmSheet } from './ConfirmSheet';

export function BillDetailScreen() {
  const { params } = useRoute<RouteProp<BillingStackParamList, 'BillDetail'>>();
  const { user } = useAuth();
  const isAdmin = user?.role === 'CANTEEN_ADMIN';
  const [bill, setBill] = useState<Bill | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [voiding, setVoiding] = useState(false);

  useFocusEffect(useCallback(() => {
    billingApi.getBill(params.billId).then(setBill)
      .catch((e) => Toast.show({ type: 'error', text1: apiErrorMessage(e, 'Failed to load bill') }));
  }, [params.billId]));

  if (!bill) return <LoadingView />;
  const c = bill.currencySymbol;

  async function doVoid() {
    if (!reason.trim()) {
      Toast.show({ type: 'error', text1: 'Enter a reason' });
      return;
    }
    setVoiding(true);
    try {
      setBill(await billingApi.voidBill(bill!.id, reason.trim()));
      setVoidOpen(false);
      setReason('');
    } catch (e) {
      Toast.show({ type: 'error', text1: apiErrorMessage(e, 'Could not void the bill') });
    } finally {
      setVoiding(false);
    }
  }

  return (
    <ScreenContainer maxWidth={560}>
      <Card>
        <Text style={typography.h2}>{bill.businessName}</Text>
        {!!bill.address && <Text style={typography.caption}>{bill.address}</Text>}
        {!!bill.gstin && <Text style={typography.caption}>GSTIN: {bill.gstin}</Text>}
        <Text style={[typography.bodyMedium, styles.gap]}>{bill.invoiceNumber}</Text>
        <Text style={typography.caption}>{new Date(bill.createdAt).toLocaleString('en-IN')} · {bill.createdByName}</Text>
        {bill.status === 'VOID' && (
          <View style={styles.gap}>
            <Badge label="CANCELLED" displayText="VOID" />
            <Text style={typography.caption}>Reason: {bill.voidReason}</Text>
          </View>
        )}
        <View style={styles.gap}>
          {bill.lines.map((l, i) => (
            <Line key={i} label={`${l.itemName} x${l.quantity}`} value={`${c}${l.lineTotal.toFixed(2)}`} />
          ))}
        </View>
        <Line label="Subtotal" value={`${c}${bill.subtotal.toFixed(2)}`} />
        {bill.gstAmount > 0 && <Line label={`GST ${bill.gstPercent}%`} value={`${c}${bill.gstAmount.toFixed(2)}`} />}
        <Line label="Total" value={`${c}${bill.total.toFixed(2)}`} bold />
        <Text style={[typography.caption, styles.gap]}>
          {bill.paymentMethod ? `Payment: ${bill.paymentMethod} — recorded manually, not verified` : 'Payment method not recorded'}
        </Text>
        {!!bill.footerMessage && <Text style={[typography.caption, styles.gap]}>{bill.footerMessage}</Text>}
      </Card>

      <Button label="Print receipt" icon={<Printer size={18} color={colors.textOnPrimary} />}
        onPress={() => printReceipt(bill).catch((e) => Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Print failed' }))}
        style={styles.gap} />
      {isAdmin && bill.status === 'COMPLETED' && (
        <Button label="Void bill" variant="danger" onPress={() => setVoidOpen(true)} style={{ marginTop: spacing.sm }} />
      )}

      <ConfirmSheet visible={voidOpen} title="Void this bill?" confirmLabel="Void bill" loading={voiding}
        message="The bill stays on record but is removed from sales totals. This cannot be undone."
        onConfirm={doVoid} onClose={() => setVoidOpen(false)}>
        <Input label="Reason" value={reason} onChangeText={setReason} maxLength={255} required />
      </ConfirmSheet>
    </ScreenContainer>
  );
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.line}>
      <Text style={bold ? typography.bodyMedium : typography.body}>{label}</Text>
      <Text style={bold ? typography.bodyMedium : typography.body}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { marginTop: spacing.md },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
});
