import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, Package, ChevronRight, Clock } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { ScreenContainer } from '../../components/ScreenContainer';
import { WaveFooter } from '../../components/WaveFooter';
import { HeroHeader } from '../../components/HeroHeader';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { LoadingView } from '../../components/LoadingView';
import { ordersApi } from '../../api/orders';
import { apiErrorMessage } from '../../api/client';
import { formatCurrency, formatDate, orderStatusLabel } from '../../utils/format';
import { colors, radius, spacing, statusColor, typography } from '../../theme';
import type { OrderResponse } from '../../api/types';
import type { CustomerStackParamList } from '../../navigation/types';

/** Orders that never completed are shown with their total struck through. */
function isVoided(status: string): boolean {
  return status === 'CANCELLED' || status === 'REJECTED';
}

export function OrdersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<CustomerStackParamList>>();
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const data = await ordersApi.myOrders();
      setOrders(data);
    } catch (error) {
      Toast.show({ type: 'error', text1: apiErrorMessage(error, 'Failed to load orders') });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Real-time-enough tracking: re-fetch every time this tab is focused, so a push
  // notification about a status change is reflected the moment the user checks the tab.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <ScreenContainer edges={['top']} scroll={false} contentStyle={{ padding: 0, backgroundColor: '#0A6344' }}>
      <View style={styles.topHeader}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color="#FFFFFF" strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.headerTitle}>My Orders</Text>
      </View>

      {loading ? (
        <View style={styles.mainContainer}>
          <LoadingView />
        </View>
      ) : (
      <ScrollView
        style={styles.mainContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
      {orders.length === 0 ? (
        <EmptyState
          icon={<Package color={colors.primary} size={30} />}
          title="No orders yet"
          message="Head to the Menu tab to place your first order."
        />
      ) : (
        <View style={styles.list}>
          {orders.map((order) => {
            const voided = isVoided(order.status);
            // A gateway/split checkout that hasn't settled yet is still visible here (it's
            // the customer's own order) but must never read as an ordinary placed order —
            // see web's OrdersPage.jsx for the same distinction and why it matters.
            const paymentPending = order.status === 'PLACED' && order.paymentStatus === 'PENDING';
            const tone = paymentPending ? statusColor('PENDING') : statusColor(order.status);
            const delivered = order.status === 'DELIVERED';

            return (
              <Card key={order.id} padded={false} style={styles.card}>
                {/* Header strip */}
                <View style={styles.header}>
                  <View style={styles.headerTop}>
                    <Text style={styles.orderNumber}>ORDER #{order.orderNumber}</Text>
                    <View style={[styles.statusChip, { backgroundColor: tone.bg }]}>
                      <Text style={[styles.statusText, { color: tone.fg }]}>
                        {paymentPending ? 'Payment pending' : orderStatusLabel(order.status)}
                      </Text>
                    </View>
                    <Text style={[styles.total, voided && styles.totalVoided]}>
                      {formatCurrency(order.totalAmount)}
                    </Text>
                  </View>
                  <Text style={styles.meta}>
                    {formatDate(order.createdAt)} · {order.items.length}{' '}
                    {order.items.length === 1 ? 'item' : 'items'}
                  </Text>
                </View>

                {/* Items */}
                <View style={styles.items}>
                  {order.items.map((item, index) => (
                    <View
                      key={`${item.menuItemId}-${index}`}
                      style={[styles.itemRow, index > 0 && styles.itemRowDivided]}
                    >
                      <View style={styles.thumb}>
                        <Text style={styles.thumbLetter}>{item.itemName.charAt(0)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.itemName, voided && styles.mutedText]} numberOfLines={1}>
                          {item.itemName}
                        </Text>
                        <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
                      </View>
                      <Text style={[styles.itemPrice, voided && styles.mutedText]}>
                        {formatCurrency(item.lineTotal)}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Footer strip — only once the order actually reached the customer */}
                {delivered && (
                  <Pressable
                    style={styles.footer}
                    onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
                  >
                    <Clock size={18} color={colors.textSecondary} />
                    <Text style={styles.footerText}>
                      {order.orderType === 'TAKEAWAY' ? 'Collected' : 'Delivered'} during {order.slotName}
                    </Text>
                    <Text style={styles.receiptLink}>View Receipt</Text>
                    <ChevronRight size={18} color={colors.primary} />
                  </Pressable>
                )}
              </Card>
            );
          })}
        </View>
      )}
        <WaveFooter />
      </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topHeader: {
    backgroundColor: '#0A6344',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  mainContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  list: { gap: spacing.xl },
  card: { overflow: 'hidden' },

  header: { backgroundColor: colors.surfaceLow, padding: spacing.lg, gap: spacing.xs },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  orderNumber: { ...typography.caption, color: colors.textSecondary, letterSpacing: 0.6 },
  statusChip: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.full },
  statusText: { ...typography.caption, letterSpacing: 0.4 },
  total: { ...typography.h2, color: colors.primary, marginLeft: 'auto' },
  totalVoided: { color: colors.textTertiary, textDecorationLine: 'line-through' },
  meta: { ...typography.bodySmall },

  items: { paddingHorizontal: spacing.lg },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.md },
  itemRowDivided: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbLetter: { ...typography.h3, color: colors.primary },
  itemName: { ...typography.bodyMedium },
  itemQty: { ...typography.bodySmall, marginTop: 2 },
  itemPrice: { ...typography.body },
  mutedText: { color: colors.textTertiary },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceLow,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  footerText: { ...typography.bodySmall, color: colors.textPrimary, flex: 1 },
  receiptLink: { ...typography.label, color: colors.primary },
});
