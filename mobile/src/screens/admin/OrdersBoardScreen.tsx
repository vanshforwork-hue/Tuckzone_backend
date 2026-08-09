import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { RefreshCw, Clock } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Input } from '../../components/Input';
import { DateField } from '../../components/DateField';
import { EmptyState } from '../../components/EmptyState';
import { LoadingView } from '../../components/LoadingView';
import { adminApi } from '../../api/admin';
import { apiErrorMessage } from '../../api/client';
import { classLabel, orderStatusLabel } from '../../utils/format';
import { colors, radius, statusColor, spacing, typography } from '../../theme';
import type { AdminOrderResponse, OrderStatus } from '../../api/types';

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** The board only ever shows "Placed"/"Delivered", so the filter mirrors that: 'PLACED'
 *  here means "not yet delivered" (every status up to and including REJECTED/CANCELLED),
 *  not literally the PLACED enum value. The real per-order status still drives which
 *  action buttons render — this filter only narrows which cards are visible. */
type StatusFilter = 'ALL' | 'PLACED' | 'DELIVERED';
const STATUS_FILTERS: StatusFilter[] = ['ALL', 'PLACED', 'DELIVERED'];

function matchesFilter(order: AdminOrderResponse, filter: StatusFilter): boolean {
  if (filter === 'ALL') return true;
  return orderStatusLabel(order.status) === (filter === 'PLACED' ? 'Placed' : 'Delivered');
}

export function OrdersBoardScreen() {
  const [date, setDate] = useState(todayIso());
  const [orders, setOrders] = useState<AdminOrderResponse[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [deliveryPersonByOrder, setDeliveryPersonByOrder] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.listOrders(date);
      setOrders(data);
    } catch (error) {
      Toast.show({ type: 'error', text1: apiErrorMessage(error, 'Failed to load orders') });
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function updateStatus(order: AdminOrderResponse, status: OrderStatus) {
    setUpdatingId(order.id);
    try {
      await adminApi.updateOrderStatus(order.id, {
        status,
        deliveryPersonName: deliveryPersonByOrder[order.id]?.trim(),
      });
      Toast.show({ type: 'success', text1: 'Order updated' });
      load();
    } catch (error) {
      Toast.show({ type: 'error', text1: apiErrorMessage(error, 'Status update failed') });
    } finally {
      setUpdatingId(null);
    }
  }

  const filteredOrders = orders.filter((order) => matchesFilter(order, statusFilter));

  // Delivered is the only status Admin/Subadmin can set — no intermediate kitchen-workflow
  // steps left. Delivery person is optional context, not a gate on the action.
  function renderActions(order: AdminOrderResponse) {
    const busy = updatingId === order.id;
    if (order.status !== 'PLACED') {
      return <Text style={styles.noActions}>No actions available</Text>;
    }
    return (
      <View style={{ gap: spacing.sm }}>
        <Input
          label="Delivery person (optional)"
          placeholder="Who delivered this?"
          value={deliveryPersonByOrder[order.id] ?? ''}
          onChangeText={(text) => setDeliveryPersonByOrder((prev) => ({ ...prev, [order.id]: text }))}
        />
        <Button label="Mark Delivered" variant="primary" loading={busy} onPress={() => updateStatus(order, 'DELIVERED')} />
      </View>
    );
  }

  return (
    <ScreenContainer edges={['top']} scroll={false} contentStyle={{ padding: 0 }}>
      <View style={styles.header}>
        <View>
          <Text style={typography.h1}>Kitchen Orders</Text>
          <Text style={styles.subtitle}>Mark orders delivered as they go out</Text>
        </View>
        <Pressable onPress={load} hitSlop={8}>
          <RefreshCw size={20} color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.dateRow}>
        <DateField label="Date" value={date} onChange={setDate} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
        {STATUS_FILTERS.map((filter) => (
          <Chip
            key={filter}
            label={`${filter === 'ALL' ? 'All' : orderStatusLabel(filter === 'PLACED' ? 'PLACED' : 'DELIVERED')} (${orders.filter((o) => matchesFilter(o, filter)).length})`}
            active={statusFilter === filter}
            onPress={() => setStatusFilter(filter)}
          />
        ))}
      </ScrollView>

      {loading ? (
        <LoadingView />
      ) : filteredOrders.length === 0 ? (
        <EmptyState icon={<RefreshCw color={colors.primaryDark} size={26} />} title="No orders found" message="Nothing matches this filter for the selected date." />
      ) : (
        <ScrollView style={styles.fill} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {filteredOrders.map((order) => (
            <Card key={order.id} padded={false} style={styles.orderCard}>
              {/* Header strip — order number, status and who it is for */}
              <View style={styles.orderHeaderStrip}>
                <View style={styles.orderHeaderTop}>
                  <Text style={styles.orderNumber}>ORDER #{order.orderNumber}</Text>
                  <View style={[styles.statusChip, { backgroundColor: statusColor(order.status).bg }]}>
                    <Text style={[styles.statusChipText, { color: statusColor(order.status).fg }]}>
                      {orderStatusLabel(order.status)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.studentName} numberOfLines={2}>
                  {order.recipientName}
                </Text>
                {order.studentClass ? (
                  <Text style={styles.classText}>Class {classLabel(order.studentClass, order.studentSection)}</Text>
                ) : null}
              </View>

              <View style={styles.orderBody}>
                <View style={styles.slotRow}>
                  <Clock size={18} color={colors.primary} />
                  <Text style={styles.slotText}>{order.slotName}</Text>
                </View>
                <Text style={styles.location}>
                  {order.orderType === 'TAKEAWAY' ? `Takeaway · Code ${order.pickupCode}` : order.deliveryLocation}
                </Text>

                {order.items.map((item, index) => (
                  <View
                    key={`${item.menuItemId}-${index}`}
                    style={[styles.itemRow, index > 0 && styles.itemRowDivided]}
                  >
                    <View style={styles.itemIcon}>
                      <Text style={styles.itemIconLetter}>{item.itemName.charAt(0)}</Text>
                    </View>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {item.itemName}
                    </Text>
                    <Text style={styles.itemQtyBadge}>x{item.quantity}</Text>
                  </View>
                ))}

                <View style={styles.actionsWrap}>{renderActions(order)}</View>
              </View>
            </Card>
          ))}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // Lets the list shrink inside the flex:1 screen container instead of overflowing it.
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  subtitle: { ...typography.bodySmall, marginTop: 2 },
  dateRow: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
  filterRow: { marginTop: spacing.md, flexGrow: 0 },
  filterRowContent: { paddingHorizontal: spacing.lg },
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  orderCard: { overflow: 'hidden' },
  orderHeaderStrip: { backgroundColor: colors.surfaceLow, padding: spacing.lg, gap: spacing.xs },
  orderHeaderTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  orderNumber: { ...typography.caption, color: colors.textSecondary, letterSpacing: 0.6 },
  statusChip: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.full },
  statusChipText: { ...typography.caption, letterSpacing: 0.4 },
  studentName: { ...typography.h2 },
  classText: { ...typography.bodySmall, color: colors.textSecondary },

  orderBody: { padding: spacing.lg, gap: spacing.sm },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  slotText: { ...typography.label, color: colors.primary },
  location: { ...typography.bodySmall },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  itemRowDivided: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIconLetter: { ...typography.h3, color: colors.primary },
  itemName: { ...typography.body, flex: 1 },
  itemQtyBadge: { ...typography.label, color: colors.textSecondary },
  actionsWrap: { marginTop: spacing.md },
  noActions: { ...typography.caption, textAlign: 'center', paddingVertical: spacing.sm },
});
