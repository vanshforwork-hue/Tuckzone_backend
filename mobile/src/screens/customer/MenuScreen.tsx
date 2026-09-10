import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowRight, Bell, CalendarClock, CheckCircle2, ChefHat, Plus, Star, Sun, TriangleAlert, User, UtensilsCrossed } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { ScreenContainer } from '../../components/ScreenContainer';
import { HeroHeader, HeroIconButton } from '../../components/HeroHeader';
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { FoodImage } from '../../components/FoodImage';
import { FadeInUp } from '../../components/FadeInUp';
import { MenuGridSkeleton } from '../../components/Skeleton';
import { QuantityStepper } from '../../components/QuantityStepper';
import { DateField } from '../../components/DateField';
import { CartBar } from '../../components/CartBar';
import { WaveFooter } from '../../components/WaveFooter';
import { Lunchbox } from '../../components/illustrations/Lunchbox';
import { menuApi } from '../../api/menu';
import { apiErrorMessage } from '../../api/client';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate } from '../../utils/format';
import { colors, radius, spacing, typography } from '../../theme';
import type {
  DailyMenuItemResponse,
  MenuItemResponse,
  OrderingWindowResponse,
} from '../../api/types';
import type { CustomerStackParamList } from '../../navigation/types';

function toIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Parses a Y-M-D string as local calendar-date components — never through Date's own
 *  ISO-string constructor, which parses as UTC and can shift the day in a browser/device
 *  west of UTC. */
function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Safe placeholder used only for the instant before the backend's resolved default
 *  arrives — same-day ordering is never valid, so "tomorrow" is always a safe floor even
 *  though the real default (which accounts for cutoffs/closures) may land later than this. */
function tomorrowIso(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return toIso(date);
}

/** Wraps a Daily Delights item into the same shape the cart already understands, so
 *  CartContext/CheckoutScreen need no changes at all. Fixed items have no per-date
 *  stock, so remainingQuantity is set high enough to never gate the "+" button. */
function toFixedCartItem(item: MenuItemResponse, menuDate: string): DailyMenuItemResponse {
  return {
    id: `fixed-${item.id}`,
    menuDate,
    menuItem: item,
    totalQuantity: Number.MAX_SAFE_INTEGER,
    remainingQuantity: Number.MAX_SAFE_INTEGER,
    available: item.available,
  };
}

function firstName(name?: string | null): string {
  if (!name) return '';
  return name.trim().split(/\s+/)[0];
}

interface FoodCardProps {
  index: number;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  allergens?: string | null;
  price: number;
  stockLabel?: string;
  soldOut: boolean;
  soldOutLabel: string;
  qty: number;
  incrementDisabled: boolean;
  closed: boolean;
  onAdd: () => void;
  onRemove: () => void;
  onSetQuantity: (next: number) => void;
}

/** One food row in the list. A square thumbnail on the left, name/description/price in the
 *  middle, and a single circular add control (or +/- stepper once it's in the cart) on the
 *  right — dense enough to scan a whole menu at a glance instead of hunting across a grid. */
function FoodCard({
  index,
  name,
  description,
  imageUrl,
  allergens,
  price,
  stockLabel,
  soldOut,
  soldOutLabel,
  qty,
  incrementDisabled,
  closed,
  onAdd,
  onRemove,
  onSetQuantity,
}: FoodCardProps) {
  const disabled = soldOut || closed;
  return (
    <FadeInUp index={index}>
      <Card style={[styles.foodRow, soldOut && styles.foodRowSoldOut]} padded={false}>
        <View style={styles.thumbWrap}>
          <FoodImage uri={imageUrl} label={name} radius={radius.lg} style={styles.thumb} />
          {soldOut && (
            <View style={styles.soldOutBadge}>
              <Text style={styles.soldOutText}>{soldOutLabel}</Text>
            </View>
          )}
        </View>

        <View style={styles.foodInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={styles.vegBadge}>
              <View style={styles.vegDot} />
            </View>
            <Text style={styles.foodName} numberOfLines={1}>
              {name}
            </Text>
          </View>
          {description ? (
            <Text style={styles.foodDesc} numberOfLines={1}>
              {description}
            </Text>
          ) : null}
          {allergens ? (
            <View style={styles.allergenRow}>
              <TriangleAlert size={11} color={colors.warning} />
              <Text style={styles.allergenText} numberOfLines={1}>
                {allergens}
              </Text>
            </View>
          ) : null}
          <View style={styles.metaRow}>
            <Text style={styles.price}>{formatCurrency(price)}</Text>
            {stockLabel ? <Text style={styles.stock}>{stockLabel}</Text> : null}
          </View>
        </View>

        <View style={styles.foodAction}>
          {qty > 0 ? (
            <QuantityStepper
              compact
              quantity={qty}
              onIncrement={onAdd}
              onDecrement={onRemove}
              onChangeQuantity={onSetQuantity}
              incrementDisabled={incrementDisabled}
            />
          ) : (
            <Pressable
              onPress={onAdd}
              disabled={disabled}
              style={[styles.roundAddButton, disabled && styles.roundAddButtonDisabled]}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Add ${name}`}
            >
              <Plus size={18} color={colors.textOnPrimary} />
            </Pressable>
          )}
        </View>
      </Card>
    </FadeInUp>
  );
}

export function MenuScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<CustomerStackParamList>>();
  const { user } = useAuth();
  const { addToCart, removeFromCart, setQuantity, quantityOf, itemCount, total } = useCart();

  // Placeholder until resolveDefaultOrderingDate() answers on mount below — never today,
  // since same-day ordering is never valid regardless of what the real default turns out
  // to be (it may land even later than tomorrow if tomorrow's own cutoff already passed).
  const [date, setDate] = useState(tomorrowIso());
  const [minDate, setMinDate] = useState(parseIso(tomorrowIso()));
  // The date picker is scoped to "the coming week" — the server independently re-validates
  // whatever date is actually submitted, so this is a UI convenience, not the source of truth.
  const [maxDate, setMaxDate] = useState(() => {
    const d = parseIso(tomorrowIso());
    d.setDate(d.getDate() + 6);
    return d;
  });
  const [dailyItems, setDailyItems] = useState<DailyMenuItemResponse[]>([]);
  const [fixedItems, setFixedItems] = useState<MenuItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [windows, setWindows] = useState<OrderingWindowResponse[] | null>(null);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [suggestedDate, setSuggestedDate] = useState<string | null>(null);
  const [category, setCategory] = useState<'ALL' | 'DAILY' | 'FIXED'>('ALL');

  // Resolved once on mount (this screen only renders once logged in, so this also covers
  // "on login") — always asks fresh rather than trusting anything cached, so a different
  // user signing in right after sees their own correct default, not a stale one.
  useEffect(() => {
    menuApi.getDefaultOrderingDate()
      .then((resolved) => {
        setDate(resolved.menuDate);
        const min = parseIso(resolved.menuDate);
        setMinDate(min);
        const max = new Date(min);
        max.setDate(max.getDate() + 6);
        setMaxDate(max);
      })
      .catch(() => undefined);
  }, []);

  /**
   * Closed only when the canteen has published slots and none of them is still accepting.
   * An empty list means no slots are configured yet, which is a setup gap rather than a
   * closed canteen — treating it as closed would lock everyone out of a working menu.
   */
  const orderingClosed = windows !== null && windows.length > 0
    && !windows.some((window) => window.acceptingOrders);

  // The selected date's own cutoff has passed (or it was closed manually) while this
  // screen was open — find out what date IS currently open so the banner can offer it.
  // Not a naive "+1 day" guess: if tomorrow is also closed, this correctly skips further.
  useEffect(() => {
    if (!orderingClosed) {
      setSuggestedDate(null);
      return;
    }
    menuApi.getDefaultOrderingDate().then((resolved) => setSuggestedDate(resolved.menuDate)).catch(() => undefined);
  }, [orderingClosed]);

  const loadMenu = useCallback(async () => {
    setLoading(true);
    try {
      // Fetched together so the menu never renders "Add" buttons for a date whose ordering
      // window has already shut — previously that only surfaced as a failure at checkout.
      const [daily, fixed, status] = await Promise.all([
        menuApi.getDailyMenu({ date }),
        menuApi.getFixedMenu(),
        menuApi.getOrderingStatus(date).catch(() => null),
      ]);
      setDailyItems(daily);
      setFixedItems(fixed);
      setWindows(status);
    } catch (error) {
      Toast.show({ type: 'error', text1: apiErrorMessage(error, 'Failed to load menu') });
    } finally {
      setLoading(false);
    }
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      loadMenu();
    }, [loadMenu]),
  );

  const announceAdded = useCallback((name: string) => {
    setLastAdded(name);
  }, []);

  const handleAdd = useCallback(
    (dayItem: DailyMenuItemResponse) => {
      const result = addToCart(dayItem);

      if (result.status === 'added') {
        announceAdded(dayItem.menuItem.name);
        return;
      }

      Toast.show({
        type: 'info',
        text1: `Only ${result.remaining} left`,
        text2: 'Your cart already has every remaining portion.',
      });
    },
    [addToCart, announceAdded],
  );

  return (
    <ScreenContainer edges={['top']} scroll={false} contentStyle={{ padding: 0 }}>
      {/* Top Header Bar matching Student Home specification */}
      <View style={styles.topAppBar}>
        {/* Left: Brand Logo & Tagline */}
        <View style={styles.brandContainer}>
          <View style={styles.brandTitleRow}>
            <ChefHat size={20} color={colors.lemon} strokeWidth={2.5} />
            <Text style={styles.brandTitleText}>Tuckzone</Text>
          </View>
          <Text style={styles.brandSubtagline}>School Canteen • Made Easy</Text>
        </View>

        {/* Right: Notifications Bell & User Profile Pill */}
        <View style={styles.topRightControls}>
          <Pressable
            style={styles.notificationBell}
            onPress={() => navigation.navigate('Notifications')}
            accessibilityLabel="Notifications"
          >
            <Bell size={18} color={colors.textOnPrimary} />
            <View style={styles.notificationDot} />
          </Pressable>

          <Pressable
            style={styles.profileBadge}
            onPress={() => navigation.navigate('CustomerTabs', { screen: 'Profile' })}
          >
            <View style={styles.avatarCircle}>
              <User size={18} color="#D97706" />
            </View>
            <View style={styles.userTextCol}>
              <Text style={styles.userNameText} numberOfLines={1}>
                {user?.fullName ?? 'Student'}
              </Text>
              <Text style={styles.userClassText}>
                {user?.studentClass ? `Class ${user.studentClass}${user.section ? ` - ${user.section}` : ''}` : 'Student'}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting Section */}
        <View style={styles.greetingSection}>
          <View style={styles.greetingTitleRow}>
            <Text style={styles.greetingTitle}>
              Good Day, {user?.fullName ? firstName(user.fullName) : 'Aarav'}!
            </Text>
            <Sun size={24} color="#F59E0B" />
          </View>
          <Text style={styles.greetingSubtitle}>What would you like to have today?</Text>
        </View>

        {/* Fresh Meals Hero Banner */}
        <View style={styles.heroPromoBanner}>
          <View style={styles.heroBannerLeft}>
            <Text style={styles.heroBannerTitle}>
              Fresh Meals{'\n'}For a Brighter You
            </Text>
            <View style={styles.heroPill}>
              <CheckCircle2 size={12} color="#166534" />
              <Text style={styles.heroPillText}>Healthy • Tasty • Always</Text>
            </View>
          </View>

          <View style={styles.heroBannerRight}>
            <View style={styles.illustrationBadge}>
              <Lunchbox size={64} />
            </View>
          </View>
        </View>

        {/* Quick Action Tiles matching stitch design */}
        <View style={styles.quickActionsGrid}>
          <Pressable
            style={[
              styles.quickTile,
              { backgroundColor: '#FEF7D8', borderColor: category === 'DAILY' ? '#D97706' : '#FDE68A' },
              category === 'DAILY' && styles.quickTileActive,
            ]}
            onPress={() => setCategory(category === 'DAILY' ? 'ALL' : 'DAILY')}
          >
            <View style={[styles.quickTileIconWell, { backgroundColor: '#FAE892' }]}>
              <UtensilsCrossed size={22} color="#854D0E" strokeWidth={2.5} />
            </View>
            <Text style={[styles.quickTileText, { color: '#854D0E' }]}>Menu of the Day</Text>
          </Pressable>

          <Pressable
            style={[
              styles.quickTile,
              { backgroundColor: '#FEE8EC', borderColor: category === 'FIXED' ? '#BE123C' : '#FECDD3' },
              category === 'FIXED' && styles.quickTileActive,
            ]}
            onPress={() => setCategory(category === 'FIXED' ? 'ALL' : 'FIXED')}
          >
            <View style={[styles.quickTileIconWell, { backgroundColor: '#FBCFE0' }]}>
              <Star size={22} color="#9F1239" strokeWidth={2.5} fill="#9F1239" />
            </View>
            <Text style={[styles.quickTileText, { color: '#9F1239' }]}>Daily Delights</Text>
          </Pressable>
        </View>

        <View style={styles.controls}>
          <Text style={styles.orderingForLabel}>Ordering for {formatDate(date)}</Text>
          <DateField label="Menu date" value={date} onChange={setDate} minimumDate={minDate} maximumDate={maxDate} />
        </View>

        {!loading && orderingClosed && (
          <Card style={styles.closedCard}>
            <View style={styles.closedIcon}>
              <CalendarClock size={20} color={colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.closedTitle}>Ordering closed for {formatDate(date)}</Text>
              <Text style={styles.closedMessage}>
                {suggestedDate
                  ? `The cutoff for this date has passed. Orders are now being accepted for ${formatDate(suggestedDate)}.`
                  : 'All slots for this date have stopped taking orders.'}
              </Text>
              {suggestedDate && (
                <Button
                  label={`Order for ${formatDate(suggestedDate)}`}
                  size="md"
                  variant="secondary"
                  style={styles.closedButton}
                  onPress={() => setDate(suggestedDate)}
                />
              )}
            </View>
          </Card>
        )}

        {loading ? (
          <View>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionBadge}>
                <Text style={typography.eyebrow}>MEAL OF THE DAY</Text>
              </View>
            </View>
            <MenuGridSkeleton />
          </View>
        ) : (
          <View>
          {category !== 'FIXED' && (
            <>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionBadge}>
                  <Text style={typography.eyebrow}>MEAL OF THE DAY</Text>
                </View>
              </View>
              {dailyItems.length === 0 ? (
                <EmptyState
                  icon={<UtensilsCrossed color={colors.primaryDark} size={30} />}
                  title="No Meal of the Day published"
                  message={`The canteen hasn't published a menu for ${date} yet.`}
                />
              ) : (
                <View style={styles.grid}>
                  {dailyItems.map((dayItem, i) => {
                    const soldOut = !dayItem.available || dayItem.remainingQuantity <= 0;
                    const qty = quantityOf(dayItem);
                    return (
                      <FoodCard
                        key={dayItem.id}
                        index={i}
                        name={dayItem.menuItem.name}
                        description={dayItem.menuItem.description}
                        imageUrl={dayItem.menuItem.imageUrl}
                        allergens={dayItem.menuItem.allergens}
                        price={dayItem.menuItem.price}
                        stockLabel={`${dayItem.remainingQuantity} left`}
                        soldOut={soldOut}
                        soldOutLabel="Sold Out"
                        qty={qty}
                        incrementDisabled={qty >= dayItem.remainingQuantity || orderingClosed}
                        closed={orderingClosed}
                        onAdd={() => handleAdd(dayItem)}
                        onRemove={() => removeFromCart(dayItem)}
                        onSetQuantity={(next) => setQuantity(dayItem, next)}
                      />
                    );
                  })}
                </View>
              )}
            </>
          )}

          {category !== 'DAILY' && (
            <>
              <View style={styles.sectionTitleRow}>
                <View style={[styles.sectionBadge, { backgroundColor: colors.accentLight }]}>
                  <Text style={[typography.eyebrow, { color: colors.accentDark }]}>DAILY DELIGHTS</Text>
                </View>
              </View>
              {fixedItems.length === 0 ? (
                <EmptyState
                  icon={<UtensilsCrossed color={colors.primaryDark} size={30} />}
                  title="No Daily Delights items"
                  message="No Daily Delights items are available right now."
                />
              ) : (
                <View style={styles.grid}>
                  {fixedItems.map((item, i) => {
                    const soldOut = !item.available;
                    const cartItem = toFixedCartItem(item, date);
                    const qty = quantityOf(cartItem);
                    return (
                      <FoodCard
                        key={item.id}
                        index={i}
                        name={item.name}
                        description={item.description}
                        imageUrl={item.imageUrl}
                        allergens={item.allergens}
                        price={item.price}
                        soldOut={soldOut}
                        soldOutLabel="Out of Stock"
                        qty={qty}
                        incrementDisabled={orderingClosed}
                        closed={orderingClosed}
                        onAdd={() => handleAdd(cartItem)}
                        onRemove={() => removeFromCart(cartItem)}
                        onSetQuantity={(next) => setQuantity(cartItem, next)}
                      />
                    );
                  })}
                </View>
              )}
            </>
          )}
        </View>
      )}

        <WaveFooter />
      </ScrollView>

      <CartBar
        itemCount={itemCount}
        total={total}
        lastAdded={lastAdded}
        onPress={() => navigation.navigate('Checkout')}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // Lets the list shrink inside the flex:1 screen container instead of overflowing it.
  fill: { flex: 1 },
  topAppBar: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandContainer: { flex: 1 },
  brandTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  brandTitleText: { fontSize: 22, fontWeight: '800', color: colors.textOnPrimary, fontFamily: typography.display.fontFamily },
  brandSubtagline: { fontSize: 10, fontWeight: '600', color: colors.primaryLight, marginTop: 2 },

  topRightControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  notificationBell: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.lemon,
  },
  profileBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  userTextCol: { justifyContent: 'center' },
  userNameText: { fontSize: 12, fontWeight: '800', color: colors.textOnPrimary, maxWidth: 90 },
  userClassText: { fontSize: 10, fontWeight: '600', color: colors.primaryLight },

  greetingSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  greetingTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  greetingTitle: { fontSize: 20, fontWeight: '900', color: '#1A4A40', fontFamily: typography.display.fontFamily },
  greetingSubtitle: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginTop: 2 },

  heroPromoBanner: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: '#DFF2E1',
    borderRadius: radius.xl,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  heroBannerLeft: { flex: 1 },
  heroBannerTitle: { fontSize: 16, fontWeight: '900', color: '#14532D', lineHeight: 20 },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  heroPillText: { fontSize: 10, fontWeight: '700', color: '#166534' },
  heroBannerRight: { alignItems: 'center', justifyContent: 'center' },
  illustrationBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#D1FAE5',
    elevation: 3,
    shadowColor: '#0D6346',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },

  controls: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  quickTile: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  quickTileActive: {
    borderWidth: 2,
    elevation: 3,
  },
  quickTileIconWell: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickTileText: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  categoryRow: { marginTop: spacing.lg, flexGrow: 0 },
  categoryRowContent: { paddingHorizontal: spacing.lg },
  orderingForLabel: { ...typography.bodySmall, color: colors.primaryDark, fontWeight: '700', marginBottom: spacing.xs },
  closedCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: colors.warningLight,
    borderColor: colors.warning,
  },
  closedIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closedTitle: { ...typography.h3 },
  closedMessage: { ...typography.bodySmall, marginTop: 2 },
  closedButton: { marginTop: spacing.md, alignSelf: 'flex-start' },
  scrollContent: { paddingBottom: 100 },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionBadge: {
    backgroundColor: colors.primarySurface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  grid: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
  },
  foodRowSoldOut: { opacity: 0.6 },
  thumbWrap: { position: 'relative', width: 72, height: 72 },
  thumb: { width: '100%', height: '100%' },
  soldOutBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlay,
  },
  soldOutText: { color: colors.textOnPrimary, fontWeight: '700', fontSize: 10, textAlign: 'center' },
  foodInfo: { flex: 1 },
  foodName: { ...typography.h3 },
  foodDesc: { ...typography.caption, marginTop: 2 },
  allergenRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  allergenText: { ...typography.caption, color: colors.warning, flexShrink: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  price: { fontSize: 15, fontWeight: '800', color: colors.primaryDark },
  stock: { ...typography.caption },
  foodAction: { alignItems: 'center', justifyContent: 'center' },
  vegBadge: {
    width: 14,
    height: 14,
    borderWidth: 1.5,
    borderColor: '#16A34A',
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vegDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  roundAddButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  roundAddButtonDisabled: { backgroundColor: colors.border, shadowOpacity: 0 },
});
