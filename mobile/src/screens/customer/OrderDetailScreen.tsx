import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Truck, KeyRound } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { LoadingView } from '../../components/LoadingView';
import { ordersApi } from '../../api/orders';
import { apiErrorMessage } from '../../api/client';
import { classLabel, formatCurrency, formatDateTime, orderStatusLabel } from '../../utils/format';
import { colors, spacing, typography } from '../../theme';
import type { OrderResponse } from '../../api/types';
import type { CustomerStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<CustomerStackParamList, 'OrderDetail'>;

export function OrderDetailScreen({ route }: Props) {
  const { orderId } = route.params;
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await ordersApi.getById(orderId);
      setOrder(data);
    } catch (error) {
      Toast.show({ type: 'error', text1: apiErrorMessage(error, 'Failed to load order') });
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading || !order) return <LoadingView />;

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <Text style={typography.h1}>{order.orderNumber}</Text>
        <Badge label={order.status} displayText={orderStatusLabel(order.status)} />
      </View>
      <Text style={styles.date}>{formatDateTime(order.createdAt)}</Text>

      {order.orderType === 'TAKEAWAY' && order.pickupCode && (
        <Card style={styles.pickupCard}>
          <KeyRound size={20} color={colors.primaryDark} />
          <View style={{ flex: 1 }}>
            <Text style={styles.pickupLabel}>Show this code at the counter</Text>
            <Text style={styles.pickupCode}>{order.pickupCode}</Text>
          </View>
        </Card>
      )}

      {order.status === 'DELIVERED' && order.deliveryPersonName && (
        <Card style={styles.deliveryCard}>
          <Truck size={20} color={colors.success} />
          <Text style={styles.deliveryText}>Delivered by {order.deliveryPersonName}</Text>
        </Card>
      )}

      <Card style={styles.detailsCard}>
        <DetailRow label="Recipient" value={order.recipientName} />
        {order.recipientClass ? (
          <DetailRow label="Class" value={classLabel(order.recipientClass, order.recipientSection)} />
        ) : null}
        <DetailRow label="Recess" value={order.slotName} />
        <DetailRow
          label={order.orderType === 'TAKEAWAY' ? 'Collection' : 'Location'}
          value={order.orderType === 'TAKEAWAY' ? 'Counter pickup' : order.deliveryLocation}
        />
        <DetailRow label="Payment" value={order.paymentStatus} />
      </Card>

      <Text style={[typography.h2, styles.sectionTitle]}>Items</Text>
      <Card>
        {order.items.map((item, index) => (
          <View
            key={`${item.menuItemId}-${index}`}
            style={[styles.itemRow, index < order.items.length - 1 && styles.itemRowBorder]}
          >
            <Text style={styles.itemName}>
              {item.itemName} <Text style={styles.itemQty}>x{item.quantity}</Text>
            </Text>
            <Text style={styles.itemPrice}>{formatCurrency(item.lineTotal)}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={typography.h3}>Total</Text>
          <Text style={[typography.h3, { color: colors.primaryDark }]}>{formatCurrency(order.totalAmount)}</Text>
        </View>
      </Card>
    </ScreenContainer>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { ...typography.bodySmall, marginTop: 2, marginBottom: spacing.lg },
  pickupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primarySurface,
    borderColor: colors.primary,
    marginBottom: spacing.lg,
  },
  pickupLabel: { ...typography.bodySmall },
  pickupCode: { fontSize: 22, fontWeight: '800', letterSpacing: 2, color: colors.primaryDark, marginTop: 2 },
  deliveryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.successLight,
    marginBottom: spacing.lg,
  },
  deliveryText: { ...typography.bodyMedium },
  detailsCard: { gap: spacing.sm },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  detailLabel: { ...typography.bodySmall },
  detailValue: { ...typography.bodyMedium },
  sectionTitle: { marginTop: spacing.xl, marginBottom: spacing.sm },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  itemRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight },
  itemName: { ...typography.body, flex: 1 },
  itemQty: { color: colors.textSecondary, fontWeight: '600' },
  itemPrice: { ...typography.bodyMedium },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
