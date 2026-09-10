import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ArrowLeft, Wallet as WalletIcon, ArrowDownLeft, ArrowUpRight, CreditCard } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { ScreenContainer } from '../../components/ScreenContainer';
import { WaveFooter } from '../../components/WaveFooter';
import { HeroHeader } from '../../components/HeroHeader';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { EmptyState } from '../../components/EmptyState';
import { LoadingView } from '../../components/LoadingView';
import { walletApi } from '../../api/wallet';
import { paymentsApi } from '../../api/payments';
import { configApi } from '../../api/config';
import { apiErrorMessage } from '../../api/client';
import { formatCurrency, formatDateTime } from '../../utils/format';
import { openRazorpayCheckout } from '../../utils/razorpay';
import { colors, radius, spacing, typography } from '../../theme';
import type { WalletResponse, WalletTransactionResponse } from '../../api/types';

export function WalletScreen() {
  const navigation = useNavigation();
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [transactions, setTransactions] = useState<WalletTransactionResponse[]>([]);
  const [quickAmounts, setQuickAmounts] = useState<number[]>([100, 200, 500, 1000]);
  const [maxTopup, setMaxTopup] = useState(10000);
  const [mockPayments, setMockPayments] = useState(true);
  const [customAmount, setCustomAmount] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingAmount, setProcessingAmount] = useState<number | null>(null);

  useEffect(() => {
    configApi
      .get()
      .then((config) => {
        setQuickAmounts(config.quickTopupAmounts);
        setMaxTopup(config.maxTopupAmount);
        setMockPayments(config.mockPaymentsEnabled);
      })
      .catch(() => undefined);
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const [walletData, txData] = await Promise.all([walletApi.getWallet(), walletApi.getTransactions()]);
      setWallet(walletData);
      setTransactions(txData);
    } catch (err) {
      Toast.show({ type: 'error', text1: apiErrorMessage(err, 'Failed to load wallet') });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleTopup(amount: number) {
    if (!amount || amount < 1) {
      setError('Enter a valid amount');
      return;
    }
    if (amount > maxTopup) {
      setError(`Maximum top-up amount is ${formatCurrency(maxTopup)}`);
      return;
    }
    setError(undefined);
    setProcessingAmount(amount);
    try {
      // platformFee is 0 unless an admin has enabled one for WALLET_RECHARGE — surfaced
      // here so a customer sees exactly what they'll pay before confirming, computed
      // entirely server-side (see PricingService), never by this screen.
      const topup = await walletApi.initiateTopup(amount);

      if (mockPayments) {
        await walletApi.mockCompleteTopup(topup.gatewayOrderId);
      } else {
        // Mirrors web's WalletPage.jsx: open the real gateway widget, then verify. A
        // dismissed widget or a failed verify leaves a PENDING payment behind — void it now
        // rather than relying solely on PaymentExpirySweeper's 15-minute sweep.
        try {
          const result = await openRazorpayCheckout({
            providerOrderId: topup.gatewayOrderId,
            providerKeyId: topup.gatewayKeyId,
            description: 'TuckZone wallet top-up',
          });
          await walletApi.verifyTopup(result.providerOrderId, result.providerPaymentId, result.signature);
        } catch (paymentError) {
          await paymentsApi.cancelPayment(topup.topupId).catch(() => undefined);
          throw paymentError;
        }
      }

      Toast.show({
        type: 'success',
        text1: 'Wallet recharged',
        text2: topup.platformFee > 0
          ? `${formatCurrency(amount)} (+ ${formatCurrency(topup.platformFee)} fee)`
          : formatCurrency(amount),
      });
      setCustomAmount('');
      load();
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: err instanceof Error && err.message === 'Payment was cancelled'
          ? 'Payment cancelled'
          : apiErrorMessage(err, 'Top-up failed'),
      });
    } finally {
      setProcessingAmount(null);
    }
  }

  return (
    <ScreenContainer edges={['top']} scroll={false} contentStyle={{ padding: 0, backgroundColor: '#0A6344' }}>
      <View style={styles.topHeader}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color="#FFFFFF" strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.headerTitle}>Wallet</Text>
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
      <View style={styles.balanceCard}>
        <View>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceValue}>{formatCurrency(wallet?.balance ?? 0)}</Text>
        </View>
        <WalletIcon size={40} color={colors.textPrimary} />
      </View>

      <Text style={[typography.h2, styles.sectionTitle]}>Quick Top-up</Text>
      <View style={styles.quickRow}>
        {quickAmounts.map((amount) => (
          <Button
            key={amount}
            label={`+${formatCurrency(amount)}`}
            variant="secondary"
            fullWidth={false}
            size="md"
            loading={processingAmount === amount}
            disabled={processingAmount !== null}
            onPress={() => handleTopup(amount)}
            style={styles.quickButton}
          />
        ))}
      </View>

      <View style={styles.customRow}>
        <View style={{ flex: 1 }}>
          <Input
            label="Custom amount"
            placeholder="Enter amount"
            keyboardType="numeric"
            value={customAmount}
            onChangeText={(text) => {
              setCustomAmount(text);
              if (error) setError(undefined);
            }}
            error={error}
          />
        </View>
      </View>
      <Button
        label="Add Money"
        icon={<CreditCard size={18} color={colors.textOnPrimary} />}
        loading={processingAmount !== null && !quickAmounts.includes(processingAmount)}
        disabled={!customAmount || processingAmount !== null}
        onPress={() => handleTopup(Number(customAmount))}
      />

      <Text style={[typography.h2, styles.sectionTitle]}>Recent Transactions</Text>
      {transactions.length === 0 ? (
        <EmptyState icon={<WalletIcon color={colors.primaryDark} size={26} />} title="No transactions yet" />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {transactions.map((tx) => (
            <Card key={tx.id} style={styles.txRow}>
              <View style={[styles.txIcon, { backgroundColor: tx.type === 'CREDIT' ? colors.successLight : colors.dangerLight }]}>
                {tx.type === 'CREDIT' ? (
                  <ArrowDownLeft size={18} color={colors.success} />
                ) : (
                  <ArrowUpRight size={18} color={colors.danger} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={typography.bodyMedium} numberOfLines={1}>{tx.description}</Text>
                <Text style={typography.caption}>{formatDateTime(tx.createdAt)}</Text>
              </View>
              <Text style={[typography.bodyMedium, { color: tx.type === 'CREDIT' ? colors.success : colors.danger }]}>
                {tx.type === 'CREDIT' ? '+' : '-'}{formatCurrency(tx.amount)}
              </Text>
            </Card>
          ))}
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
  // Gold, not the brand green the header already used — two stacked green blocks would
  // read as repetition rather than hierarchy; this is also the one place in the app a
  // money amount is the single most important thing on screen, which is exactly the kind
  // of moment the accent color is reserved for.
  balanceCard: {
    backgroundColor: colors.accent,
    borderRadius: radius.xl,
    padding: spacing.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: { color: colors.textPrimary, opacity: 0.7, fontSize: 13, fontWeight: '600' },
  balanceValue: { color: colors.textPrimary, fontSize: 30, fontWeight: '800', marginTop: 4 },
  sectionTitle: { marginTop: spacing.xxl, marginBottom: spacing.md },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quickButton: { paddingHorizontal: spacing.lg },
  customRow: { marginTop: spacing.lg },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  txIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
