import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AlertTriangle, ArrowLeft, CheckCircle2, Info, ShoppingCart, Trash2, Truck } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { ScreenContainer } from '../../components/ScreenContainer';
import { WaveFooter } from '../../components/WaveFooter';
import { HeroHeader } from '../../components/HeroHeader';
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { QuantityStepper } from '../../components/QuantityStepper';
import { EmptyState } from '../../components/EmptyState';
import { FoodImage } from '../../components/FoodImage';
import { menuApi } from '../../api/menu';
import { ordersApi } from '../../api/orders';
import { wardsApi } from '../../api/wards';
import { walletApi } from '../../api/wallet';
import { paymentsApi } from '../../api/payments';
import { configApi } from '../../api/config';
import { apiErrorCode, apiErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { classLabel, formatCurrency, formatDate } from '../../utils/format';
import { openRazorpayCheckout } from '../../utils/razorpay';
import { colors, radius, shadowFloating, spacing, typography } from '../../theme';
import type { DeliverySlotResponse, WardResponse, OrderingWindowResponse } from '../../api/types';
import type { CustomerStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<CustomerStackParamList, 'Checkout'>;

export function CheckoutScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { lines, total, cartDate, clearCart, addToCart, removeFromCart, removeLine, setQuantity } = useCart();

  // Generated exactly once per checkout attempt (this screen mount), and reused across
  // retries. A key regenerated on every tap would make double-tap protection worthless —
  // two different keys look like two legitimate orders to the backend.
  const idempotencyKeyRef = useRef(Crypto.randomUUID());

  // Taken from the cart itself, which now guarantees every line shares one date. Reading
  // it off lines[0] used to submit the first-added item's date after the shopper switched
  // days, producing "you can't order for <the old date>" at the final step.
  const menuDate = cartDate ?? '';

  const [slots, setSlots] = useState<DeliverySlotResponse[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [orderingStatus, setOrderingStatus] = useState<OrderingWindowResponse | null>(null);

  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [wards, setWards] = useState<WardResponse[]>([]);
  const [selectedWardId, setSelectedWardId] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [placing, setPlacing] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [mockPaymentsEnabled, setMockPaymentsEnabled] = useState(true);

  const isParent = user?.role === 'PARENT';
  const isTeacher = user?.role === 'TEACHER';
  const isStudent = user?.role === 'STUDENT';

  useEffect(() => {
    menuApi.getDeliverySlots().then((data) => {
      setSlots(data);
      if (data.length > 0) setSelectedSlotId(data[0].id);
    });
    if (isParent) {
      wardsApi.list().then(setWards).catch(() => undefined);
    }
    walletApi.getWallet().then((w) => setWalletBalance(w.balance)).catch(() => undefined);
    configApi.get().then((c) => setMockPaymentsEnabled(c.mockPaymentsEnabled)).catch(() => undefined);
  }, [isParent]);

  const needsGateway = walletBalance != null && total > walletBalance;

  useEffect(() => {
    if (!selectedSlotId || !menuDate) return;
    menuApi
      .getOrderingStatus(menuDate)
      .then((statuses) => {
        setOrderingStatus(statuses.find((s) => s.slotId === selectedSlotId) ?? null);
      })
      .catch(() => setOrderingStatus(null));
  }, [selectedSlotId, menuDate]);

  const selectedSlot = useMemo(() => slots.find((s) => s.id === selectedSlotId), [slots, selectedSlotId]);
  const closedForOrdering = orderingStatus !== null && !orderingStatus.acceptingOrders;

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!selectedSlotId) next.slot = 'Recess is unavailable right now — please try again';
    if (isParent && !selectedWardId) next.child = 'Please select which ward this order is for';
    if (isTeacher && !deliveryLocation.trim()) {
      next.location = 'Delivery location is required';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handlePlaceOrder() {
    if (lines.length === 0) return;
    if (!validate()) return;
    if (closedForOrdering) {
      Toast.show({ type: 'error', text1: 'Ordering is closed for this slot' });
      return;
    }

    setPlacing(true);
    try {
      const order = await ordersApi.place({
        menuDate,
        beneficiaryWardId: isParent ? selectedWardId : undefined,
        deliveryLocation: isTeacher ? deliveryLocation.trim() : undefined,
        items: lines.map((line) => ({ menuItemId: line.dayItem.menuItem.id, quantity: line.quantity })),
        idempotencyKey: idempotencyKeyRef.current,
        // Wallet alone would fall short of the total — cover the rest through the
        // gateway. Undefined when the wallet already covers it, which keeps that case on
        // the exact same synchronous, unchanged fast path as before.
        paymentMode: needsGateway ? 'WALLET_PLUS_GATEWAY' : undefined,
      });

      if (order.payment && order.payment.providerOrderId) {
        if (mockPaymentsEnabled) {
          await paymentsApi.mockComplete(order.payment.paymentId);
        } else {
          // Order and its wallet portion are already committed server-side — the gateway
          // widget only ever collects the remainder. If it's dismissed or fails, void the
          // payment now instead of leaving it to sit for up to 15 minutes looking like a
          // real placed order (see PaymentExpirySweeper), mirroring MenuPage.jsx on web.
          try {
            const result = await openRazorpayCheckout({
              providerOrderId: order.payment.providerOrderId,
              providerKeyId: order.payment.providerKeyId ?? '',
              description: `TuckZone order ${order.orderNumber}`,
            });
            await paymentsApi.verifyPayment(order.payment.paymentId, {
              providerOrderId: result.providerOrderId,
              providerPaymentId: result.providerPaymentId,
              signature: result.signature,
            });
          } catch (paymentError) {
            await paymentsApi.cancelPayment(order.payment.paymentId).catch(() => undefined);
            Toast.show({
              type: 'error',
              text1: paymentError instanceof Error && paymentError.message === 'Payment was cancelled'
                ? 'Payment cancelled — your order was not placed'
                : apiErrorMessage(paymentError, 'Payment failed — your order was not placed'),
            });
            return; // keep the cart intact so the shopper can retry
          }
        }
      }

      clearCart();
      // Straight to the confirmation screen rather than the Orders list: the shopper needs
      // the order number and pickup instructions immediately, not a list to hunt through.
      // Replaces the whole CustomerTabs stack entry (via the parent stack navigator, not
      // this tab navigator) so the hardware back button cannot return to a submitted cart.
      navigation.replace('OrderConfirmation', { orderId: order.id });
    } catch (error) {
      if (apiErrorCode(error) === 'ORDERING_CLOSED') {
        // Stale screen: cutoff passed for this cart's date while it sat open. The backend
        // already rejected it — the cart's items are scoped to a date that's now closed, so
        // recover by clearing it and sending the shopper back to Menu, which resolves a
        // fresh (and now-current) default date on its own.
        Toast.show({ type: 'error', text1: apiErrorMessage(error, 'Ordering has closed for this date.') });
        clearCart();
        navigation.goBack();
      } else {
        Toast.show({ type: 'error', text1: apiErrorMessage(error, 'Failed to place order') });
      }
    } finally {
      setPlacing(false);
    }
  }

  function confirmRemoveLine(dayItemId: string, name: string) {
    Alert.alert('Remove item?', `${name} will be removed from your cart.`, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeLine(dayItemId) },
    ]);
  }

  function confirmClearCart() {
    Alert.alert('Empty your cart?', 'All items will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Empty cart', style: 'destructive', onPress: clearCart },
    ]);
  }

  if (lines.length === 0) {
    return (
      <ScreenContainer edges={['top']} scroll={false} contentStyle={{ padding: 0, backgroundColor: '#0A6344' }}>
        <View style={styles.topHeader}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={24} color="#FFFFFF" strokeWidth={2.4} />
          </Pressable>
          <Text style={styles.headerTitle}>My Cart</Text>
        </View>
        <View style={[styles.mainContainer, styles.emptyBody]}>
          <EmptyState
            icon={<ShoppingCart color={colors.primary} size={30} />}
            title="Your cart is empty"
            message="Add something from the menu and it will show up here."
          />
          <Button label="Browse the menu" onPress={() => navigation.goBack()} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={['top']} scroll={false} contentStyle={{ padding: 0, backgroundColor: '#0A6344' }}>
      <View style={styles.topHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <ArrowLeft size={24} color="#FFFFFF" strokeWidth={2.4} />
          </Pressable>
          <Text style={styles.headerTitle}>My Cart</Text>
        </View>
        <Pressable onPress={confirmClearCart} style={styles.clearCartBtn}>
          <Trash2 size={16} color="#FFFFFF" />
          <Text style={styles.clearCartText}>Clear Cart</Text>
        </Pressable>
      </View>
      <ScrollView style={styles.mainContainer} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Order Summary ─────────────────────────────────────────────── */}
        <Card style={styles.card}>
          <Text style={typography.h2}>Order Summary</Text>

          {lines.map((line) => (
            <View key={line.dayItem.id} style={styles.lineBlock}>
              <View style={styles.itemRow}>
                <FoodImage
                  uri={line.dayItem.menuItem.imageUrl}
                  label={line.dayItem.menuItem.name}
                  style={styles.thumb}
                  radius={radius.lg}
                />
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {line.dayItem.menuItem.name}
                  </Text>
                  <Text style={styles.itemQty}>Qty: {line.quantity}</Text>
                </View>
                <Text style={styles.itemPrice}>
                  {formatCurrency(line.dayItem.menuItem.price * line.quantity)}
                </Text>
              </View>

              <View style={styles.itemControls}>
                <QuantityStepper
                  compact
                  quantity={line.quantity}
                  onIncrement={() => addToCart(line.dayItem)}
                  onDecrement={() => removeFromCart(line.dayItem.id)}
                  onChangeQuantity={(next) => setQuantity(line.dayItem, next)}
                  incrementDisabled={line.quantity >= line.dayItem.remainingQuantity}
                />
                <Pressable
                  onPress={() => confirmRemoveLine(line.dayItem.id, line.dayItem.menuItem.name)}
                  hitSlop={8}
                  style={styles.removeButton}
                  accessibilityLabel={`Remove ${line.dayItem.menuItem.name}`}
                >
                  <Trash2 size={17} color={colors.danger} />
                </Pressable>
              </View>
            </View>
          ))}

          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.subtotalLabel}>Subtotal</Text>
            <Text style={styles.subtotalValue}>{formatCurrency(total)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
          </View>

          {needsGateway && (
            <View style={styles.warningBox}>
              <AlertTriangle size={18} color={colors.warning} />
              <Text style={styles.warningText}>
                Wallet balance ({formatCurrency(walletBalance ?? 0)}) won&apos;t cover this
                order — the remaining {formatCurrency(total - (walletBalance ?? 0))} will be
                charged through the payment gateway.
              </Text>
            </View>
          )}
        </Card>

        {/* ── Delivery Information ──────────────────────────────────────── */}
        <Card style={[styles.card, styles.sectionGap]}>
          <View style={styles.cardHeading}>
            <Truck size={22} color={colors.primary} />
            <Text style={typography.h2}>Delivery Information</Text>
          </View>

          <View style={styles.infoBox}>
            <Info size={20} color={colors.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Delivery: Recess</Text>
              <Text style={styles.infoBody}>
                Your order will be prepared and ready for delivery during the standard
                recess period.
              </Text>
            </View>
          </View>

          {errors.slot ? <Text style={styles.errorText}>{errors.slot}</Text> : null}

          {closedForOrdering && (
            <View style={styles.warningBox}>
              <AlertTriangle size={18} color={colors.warning} />
              <Text style={styles.warningText}>
                Ordering for {selectedSlot?.name ?? 'Recess'} on {formatDate(menuDate)} is
                currently closed{orderingStatus?.reason ? ` (${orderingStatus.reason})` : ''}.
              </Text>
            </View>
          )}

          {isParent ? (
            <View>
              <Text style={styles.fieldLabel}>Order For</Text>
              <View style={styles.childRow}>
                {wards.map((ward) => (
                  <Chip
                    key={ward.id}
                    label={`${ward.name} (${ward.studentClass}-${ward.section})`}
                    active={selectedWardId === ward.id}
                    onPress={() => setSelectedWardId(ward.id)}
                  />
                ))}
              </View>
              {errors.child ? <Text style={styles.errorText}>{errors.child}</Text> : null}
            </View>
          ) : isStudent ? (
            <View style={styles.row}>
              <View style={styles.half}>
                <Input label="Student Name" value={user?.fullName ?? ''} editable={false} />
              </View>
              <View style={styles.half}>
                <Input label="Class" value={classLabel(user?.studentClass, user?.section)} editable={false} />
              </View>
            </View>
          ) : (
            <Input
              label="Delivery Location"
              required
              placeholder="e.g. Staff Room / Science Dept"
              value={deliveryLocation}
              onChangeText={setDeliveryLocation}
              error={errors.location}
            />
          )}
        </Card>
        <WaveFooter />
      </ScrollView>

      {/* ── Fixed pay bar ─────────────────────────────────────────────── */}
      <View style={styles.footer}>
        <View>
          <Text style={styles.footerLabel}>Total to pay</Text>
          <Text style={styles.footerTotal}>{formatCurrency(total)}</Text>
        </View>
        <Button
          label="Confirm Order"
          size="lg"
          fullWidth={false}
          onPress={handlePlaceOrder}
          loading={placing}
          disabled={closedForOrdering}
          icon={<CheckCircle2 size={18} color={colors.textOnPrimary} />}
          style={styles.confirmButton}
        />
      </View>
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
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  clearCartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  clearCartText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  mainContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  fill: { flex: 1 },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  emptyBody: { padding: spacing.xl },

  clearCart: { ...typography.label, color: colors.textOnPrimary, textDecorationLine: 'underline', marginTop: spacing.sm },

  card: { gap: spacing.lg },
  sectionGap: { marginTop: spacing.xxxl }, // section-margin
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },

  lineBlock: { gap: spacing.sm },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  thumb: { width: 64, height: 64, borderRadius: radius.lg },
  itemInfo: { flex: 1 },
  itemName: { ...typography.bodyMedium },
  itemQty: { ...typography.bodySmall, marginTop: 2 },
  itemPrice: { ...typography.h3, color: colors.primary },

  itemControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerLight,
  },

  divider: { height: 1, backgroundColor: colors.borderLight },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subtotalLabel: { ...typography.body, color: colors.textSecondary },
  subtotalValue: { ...typography.body },
  totalLabel: { ...typography.h2 },
  totalValue: { ...typography.h2, color: colors.primary },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.surfaceLow,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  infoTitle: { ...typography.label },
  infoBody: { ...typography.bodySmall, marginTop: 2 },

  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.warningLight,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: spacing.lg,
  },
  warningText: { ...typography.bodySmall, color: colors.textPrimary, flex: 1 },

  fieldLabel: { ...typography.label, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
  childRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  errorText: { ...typography.caption, color: colors.danger },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    ...shadowFloating,
  },
  footerLabel: { ...typography.bodySmall },
  footerTotal: { ...typography.h2, color: colors.primary },
  confirmButton: { flexGrow: 1, maxWidth: 220 },
});
