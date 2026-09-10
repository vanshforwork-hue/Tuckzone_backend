import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Calendar, Check, Clock, Store } from 'lucide-react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import Toast from 'react-native-toast-message';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { LoadingView } from '../../components/LoadingView';
import { WaveFooter } from '../../components/WaveFooter';
import { ordersApi } from '../../api/orders';
import { apiErrorMessage } from '../../api/client';
import { classLabel, formatCurrency } from '../../utils/format';
import { colors, spacing, typography } from '../../theme';
import type { OrderResponse } from '../../api/types';
import type { CustomerStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<CustomerStackParamList, 'OrderConfirmation'>;

export function OrderConfirmationScreen({ navigation, route }: Props) {
  const { orderId } = route.params;
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      ordersApi
        .getById(orderId)
        .then((data) => {
          if (!cancelled) setOrder(data);
        })
        .catch((error) => {
          if (!cancelled) Toast.show({ type: 'error', text1: apiErrorMessage(error, 'Could not load your order') });
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [orderId]),
  );

  function goHome() {
    navigation.reset({ index: 0, routes: [{ name: 'CustomerTabs' }] });
  }

  function goToOrders() {
    navigation.reset({ index: 0, routes: [{ name: 'CustomerTabs', params: { screen: 'Orders' } }] });
  }

  if (loading) {
    return (
      <ScreenContainer edges={['top']} scroll={false} contentStyle={{ padding: 0, backgroundColor: '#0A6344' }}>
        <View style={styles.topHeader}>
          <Text style={styles.headerTitle}>Order Status</Text>
        </View>
        <View style={styles.mainContainer}>
          <LoadingView />
        </View>
      </ScreenContainer>
    );
  }

  if (!order) {
    return (
      <ScreenContainer edges={['top']} scroll={false} contentStyle={{ padding: 0, backgroundColor: '#0A6344' }}>
        <View style={styles.topHeader}>
          <Text style={styles.headerTitle}>Order Status</Text>
        </View>
        <View style={[styles.mainContainer, { padding: spacing.xl }]}>
          <Text style={typography.h2}>Order not found</Text>
          <Button label="Return to Home" onPress={goHome} style={{ marginTop: spacing.xl }} />
        </View>
      </ScreenContainer>
    );
  }

  const isTakeaway = order.orderType === 'TAKEAWAY';

  return (
    <ScreenContainer edges={['top']} scroll={false} contentStyle={{ padding: 0, backgroundColor: '#0A6344' }}>
      <View style={styles.topHeader}>
        <Text style={styles.headerTitle}>Order Placed</Text>
      </View>

      <ScrollView style={styles.mainContainer} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Festive Celebration Card Container */}
        <View style={styles.festiveCard}>
          {/* Background Soft Blobs & Doodles */}
          <View style={styles.doodleOverlay}>
            <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
              {/* Confetti & Doodles */}
              <Path d="M 30 50 C 25 55, 35 62, 40 52" fill="none" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" />
              <Circle cx="40" cy="110" r="7" fill="none" stroke="#1E5E57" strokeWidth="2.5" opacity={0.8} />
              <Path d="M 280 40 C 280 36, 285 33, 288 37 C 291 33, 296 36, 296 40 C 296 46, 288 51, 288 51 Z" fill="none" stroke="#F97316" strokeWidth="2" />
              <Rect x="80" y="20" width="3" height="10" rx="1.5" fill="#E11D48" transform="rotate(30 80 20)" />
              <Rect x="260" y="30" width="3.5" height="11" rx="1.7" fill="#F97316" transform="rotate(-35 260 30)" />
              <Rect x="300" y="90" width="3.5" height="9" rx="1.5" fill="#10B981" transform="rotate(25 300 90)" />
            </Svg>
          </View>

          {/* Hero Centerpiece: Sun Rays + Lunchbox + Green Check Badge */}
          <View style={styles.heroCenterpiece}>
            <View style={styles.sunRaysWrap}>
              <Svg viewBox="0 0 200 180" style={{ width: 180, height: 160 }}>
                <Line x1="30" y1="65" x2="16" y2="62" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" />
                <Line x1="45" y1="40" x2="35" y2="30" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" />
                <Line x1="70" y1="24" x2="66" y2="10" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" />
                <Line x1="100" y1="20" x2="100" y2="6" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" />
                <Line x1="130" y1="24" x2="134" y2="10" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" />
                <Line x1="155" y1="40" x2="165" y2="30" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" />
                <Line x1="170" y1="65" x2="184" y2="62" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" />
              </Svg>
            </View>

            {/* Cute Smiling Lunchbox SVG */}
            <View style={styles.lunchboxWrap}>
              <Svg viewBox="0 0 160 140" style={{ width: 140, height: 120 }}>
                {/* Handle */}
                <Path d="M 50 42 C 50 26, 110 26, 110 42" fill="none" stroke="#0284C7" strokeWidth="6" strokeLinecap="round" />
                {/* Veggies */}
                <Circle cx="58" cy="38" r="13" fill="#F97316" stroke="#134E39" strokeWidth="2.5" />
                <Circle cx="80" cy="36" r="14" fill="#84CC16" stroke="#134E39" strokeWidth="2.5" />
                <Circle cx="98" cy="40" r="12" fill="#4ADE80" stroke="#134E39" strokeWidth="2.5" />
                {/* Lid */}
                <Rect x="26" y="44" width="108" height="16" rx="7" fill="#0EA5E9" stroke="#0F172A" strokeWidth="3" />
                {/* Side Tray */}
                <Path d="M 104 58 L 120 58 C 125 58, 128 61, 128 66 L 122 112 C 122 116, 118 118, 114 118 L 104 118 Z" fill="#FBBF24" stroke="#0F172A" strokeWidth="3" />
                {/* Body */}
                <Rect x="24" y="56" width="80" height="64" rx="12" fill="#0D9488" stroke="#0F172A" strokeWidth="3" />
                {/* Eyes */}
                <Circle cx="44" cy="80" r="3" fill="#0F172A" />
                <Circle cx="64" cy="80" r="3" fill="#0F172A" />
                {/* Cheeks */}
                <Circle cx="38" cy="85" r="3.5" fill="#FCA5A5" opacity={0.8} />
                <Circle cx="70" cy="85" r="3.5" fill="#FCA5A5" opacity={0.8} />
                {/* Smile */}
                <Path d="M 50 86 C 52 91, 56 91, 58 86" fill="none" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" />
              </Svg>

              {/* Green Check Badge */}
              <View style={styles.checkBadge}>
                <Check size={26} color="#FFFFFF" strokeWidth={3.5} />
              </View>
            </View>
          </View>

          {/* Heading */}
          <Text style={styles.headingTitle}>Order Placed!</Text>

          {/* Subheading */}
          <Text style={styles.headingSubtext}>
            Your food is being prepared and will be ready for {order.slotName || 'your recess'}.
          </Text>

          {/* Order Info Card (Order ID & Recess Slot) */}
          <View style={styles.orderInfoPill}>
            <View style={styles.pillColumn}>
              <View style={styles.pillIconWell}>
                <Calendar size={18} color="#0E6347" strokeWidth={2.2} />
              </View>
              <View>
                <Text style={styles.pillLabel}>ORDER ID</Text>
                <Text style={styles.pillValue}>#{order.orderNumber}</Text>
              </View>
            </View>

            <View style={styles.pillDivider} />

            <View style={styles.pillColumn}>
              <View style={styles.pillIconWell}>
                <Clock size={18} color="#0E6347" strokeWidth={2.2} />
              </View>
              <View>
                <Text style={styles.pillLabel}>RECESS / SLOT</Text>
                <Text style={styles.pillValue}>{order.slotName || '—'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Order Details & Items Card */}
        <Card style={styles.detailsCard}>
          <Text style={typography.h3}>Order Details</Text>
          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{isTakeaway ? 'Pick up at:' : 'Deliver to:'}</Text>
            <Text style={styles.detailValue}>{isTakeaway ? 'Main Canteen' : order.deliveryLocation}</Text>
          </View>

          {isTakeaway && order.pickupCode && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Pickup Code:</Text>
              <Text style={[styles.detailValue, { color: '#0E6347', fontWeight: '800' }]}>{order.pickupCode}</Text>
            </View>
          )}

          {!isTakeaway && order.recipientName && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Recipient:</Text>
              <Text style={styles.detailValue}>
                {order.recipientName}
                {order.recipientClass ? ` (Class ${classLabel(order.recipientClass, order.recipientSection)})` : ''}
              </Text>
            </View>
          )}

          <View style={styles.divider} />
          <Text style={[typography.caption, { color: '#64748B', marginBottom: 8 }]}>ITEMS ORDERED</Text>

          {order.items.map((item, index) => (
            <View key={`${item.menuItemId}-${index}`} style={styles.itemRow}>
              <Text style={styles.itemName}>
                {item.itemName} <Text style={styles.itemQty}>x{item.quantity}</Text>
              </Text>
              <Text style={styles.itemPrice}>{formatCurrency(item.lineTotal)}</Text>
            </View>
          ))}

          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Paid</Text>
            <Text style={styles.totalValue}>{formatCurrency(order.totalAmount)}</Text>
          </View>
        </Card>

        {/* Action Buttons matching stitch spec */}
        <View style={styles.actionsGroup}>
          <Pressable style={styles.primaryButton} onPress={goToOrders}>
            <Text style={styles.primaryButtonText}>View My Orders</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={goHome}>
            <Text style={styles.secondaryButtonText}>Back to Home</Text>
          </Pressable>
        </View>

        <WaveFooter />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topHeader: {
    backgroundColor: '#0A6344',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  mainContainer: {
    flex: 1,
    backgroundColor: '#FCFBF7',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  festiveCard: {
    backgroundColor: '#FCFBF7',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    padding: 20,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  doodleOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  heroCenterpiece: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 8,
    position: 'relative',
  },
  sunRaysWrap: {
    position: 'absolute',
    top: -20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lunchboxWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadge: {
    position: 'absolute',
    bottom: 2,
    right: 6,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0E6347',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0E6347',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  headingTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#115E43',
    textAlign: 'center',
    marginTop: 12,
  },
  headingSubtext: {
    fontSize: 14,
    fontWeight: '600',
    color: '#18533D',
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 260,
    lineHeight: 20,
  },
  orderInfoPill: {
    width: '100%',
    backgroundColor: '#EAF7EE',
    borderWidth: 1,
    borderColor: '#D5EEDD',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  pillColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pillIconWell: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#D2EFE2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  pillValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#114B36',
    marginTop: 1,
  },
  pillDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#CDE6D6',
  },
  detailsCard: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  itemQty: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0E6347',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0E6347',
  },
  actionsGroup: {
    marginTop: 20,
    gap: 12,
  },
  primaryButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 25,
    backgroundColor: '#0E6347',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0E6347',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  secondaryButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#0E6347',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0E6347',
  },
});
