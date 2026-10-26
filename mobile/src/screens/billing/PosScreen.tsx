import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Crypto from 'expo-crypto';
import { History, Pause, Play, Printer, Receipt, RotateCcw, Settings, ShoppingBag, Trash2, Package } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import { Button } from '../../components/Button';
import { FormModal } from '../../components/FormModal';
import { QuantityStepper } from '../../components/QuantityStepper';
import { EmptyState } from '../../components/EmptyState';
import { LoadingView } from '../../components/LoadingView';
import { useAuth } from '../../context/AuthContext';
import { apiErrorMessage } from '../../api/client';
import {
  billingApi, previewTotals,
  type Bill, type HeldCart, type PaymentMethod, type PosCatalog, type PosItem, type PosSettings,
} from '../../api/billing';
import { printReceipt, shareReceipt } from '../../utils/receipt';
import { saveThenPrint, tryPrint, savedButNotPrinted } from '../../utils/printFlow';
import * as nativePrinter from '../../utils/nativePrinter';
import { colors, radius, spacing, typography } from '../../theme';
import type { BillingStackParamList } from '../../navigation/types';
import { Cell } from './Cell';
import { ConfirmSheet } from './ConfirmSheet';
import { billingMenuGroups, type BillingEntryKey, type BillingGroupKey } from './billingMenu';

type Nav = NativeStackNavigationProp<BillingStackParamList>;
const METHODS: PaymentMethod[] = ['CASH', 'UPI', 'CARD', 'OTHER'];
const WIDE = 760;
const ic = (I: React.ComponentType<{ size: number; color: string }>) => <I size={16} color={colors.textPrimary} />;
const TOOLBAR_ICONS: Record<BillingEntryKey, React.ReactNode> = {
  held: ic(Play), repeat: ic(RotateCcw), bills: ic(History), catalog: ic(Package),
  reports: ic(Receipt), settings: ic(Settings), printer: ic(Printer),
};

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function PosScreen() {
  const nav = useNavigation<Nav>();
  const { user } = useAuth();
  const isAdmin = user?.role === 'CANTEEN_ADMIN';
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const groups = useMemo(() => billingMenuGroups(user?.role), [user?.role]);

  const [catalog, setCatalog] = useState<PosCatalog | null>(null);
  const [settings, setSettings] = useState<PosSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('ALL');

  const [cart, setCart] = useState<Record<string, number>>({});
  const [gstEnabled, setGstEnabled] = useState(true);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<Bill | null>(null);
  // null = not attempted (Save only); string = last print attempt failed; '' = print succeeded
  const [printError, setPrintError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [group, setGroup] = useState<BillingGroupKey>('sell');
  const [pStatus, setPStatus] = useState(nativePrinter.getStatus());
  useEffect(() => nativePrinter.subscribe(setPStatus), []);
  const [heldOpen, setHeldOpen] = useState(false);
  const [held, setHeld] = useState<HeldCart[]>([]);
  const [discardTarget, setDiscardTarget] = useState<HeldCart | null>(null);
  const [clearOpen, setClearOpen] = useState(false);

  // One key per distinct cart. It is dropped whenever the cart changes, so a retry of the
  // SAME cart (timeout, double tap) is deduplicated by the server while an edited cart never
  // gets answered with an older bill.
  const keyRef = useRef<string | null>(null);
  const settingsLoaded = useRef(false);
  const submitRef = useRef(false);
  const printRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([billingApi.catalog(), billingApi.settings()]);
      setCatalog(c);
      setSettings(s);
      if (!settingsLoaded.current) {
        setGstEnabled(s.gstEnabledDefault);
        settingsLoaded.current = true;
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: apiErrorMessage(e, 'Failed to load billing catalog') });
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const byId = useMemo(() => new Map((catalog?.items ?? []).map((i) => [i.id, i])), [catalog]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (catalog?.items ?? []).filter(
      (i) => (category === 'ALL' || i.categoryId === category) && (!q || i.name.toLowerCase().includes(q)),
    );
  }, [catalog, category, search]);

  const lines = useMemo(
    () => Object.entries(cart).flatMap(([id, quantity]) => {
      const item = byId.get(id);
      return item ? [{ item, quantity }] : [];
    }),
    [cart, byId],
  );
  const totals = previewTotals(lines.map((l) => ({ price: l.item.price, quantity: l.quantity })), settings?.gstPercent ?? 0, gstEnabled);
  const cur = settings?.currencySymbol ?? 'Rs';
  const count = lines.reduce((s, l) => s + l.quantity, 0);

  function edit(fn: (c: Record<string, number>) => Record<string, number>) {
    keyRef.current = null;
    setCart((c) => fn({ ...c }));
  }
  const setQty = (id: string, q: number) =>
    edit((c) => {
      const next = Math.max(0, Math.min(999, Math.floor(q) || 0));
      if (next === 0) delete c[id]; else c[id] = next;
      return c;
    });
  const add = (item: PosItem) => item.available && setQty(item.id, (cart[item.id] ?? 0) + 1);

  function resetCart() {
    keyRef.current = null;
    setCart({});
    setMethod(null);
    setGstEnabled(settings?.gstEnabledDefault ?? true);
  }

  /** Loads item/qty pairs into the cart, re-priced from today's catalog; skips what can't be sold. */
  function loadLines(input: { itemId: string; quantity: number }[]) {
    let skipped = 0;
    const next: Record<string, number> = {};
    for (const l of input) {
      const item = byId.get(l.itemId);
      if (item && item.available) next[item.id] = Math.min(999, (next[item.id] ?? 0) + l.quantity);
      else skipped++;
    }
    keyRef.current = null;
    setCart(next);
    if (skipped) Toast.show({ type: 'info', text1: `${skipped} item(s) are no longer available and were left out` });
  }

  /** Saves the bill once (idempotent key), then optionally prints it. A print failure never repeats the save. */
  async function checkout(thenPrint: boolean) {
    if (submitRef.current) return; // a ref: two taps in one tick must not both pass
    if (lines.length === 0) {
      Toast.show({ type: 'error', text1: 'Add at least one item' });
      return;
    }
    submitRef.current = true;
    setSubmitting(true);
    try {
      keyRef.current ??= Crypto.randomUUID();
      const save = () => billingApi.createBill({
        idempotencyKey: keyRef.current!,
        lines: lines.map((l) => ({ itemId: l.item.id, quantity: l.quantity })),
        gstEnabled,
        paymentMethod: method ?? undefined,
      });
      const { bill, printError: err } = thenPrint
        ? await saveThenPrint(save, printReceipt)
        : { bill: await save(), printError: null as string | null };
      setCartOpen(false);
      resetCart(); // only after the server confirmed the save
      setReceipt(bill);
      setPrintError(thenPrint ? (err ?? '') : null);
      if (err) Toast.show({ type: 'error', text1: savedButNotPrinted(err), visibilityTime: 6000 });
    } catch (e) {
      Toast.show({ type: 'error', text1: apiErrorMessage(e, 'Could not create the bill') });
      load(); // a rejected item usually means the catalog changed
    } finally {
      submitRef.current = false;
      setSubmitting(false);
    }
  }

  async function hold() {
    if (lines.length === 0) return;
    try {
      await billingApi.hold(lines.map((l) => ({ itemId: l.item.id, quantity: l.quantity })));
      resetCart();
      setCartOpen(false);
      Toast.show({ type: 'success', text1: 'Bill put on hold' });
    } catch (e) {
      Toast.show({ type: 'error', text1: apiErrorMessage(e, 'Could not hold the bill') });
    }
  }

  async function openHeld() {
    try {
      setHeld(await billingApi.listHeld());
      setHeldOpen(true);
    } catch (e) {
      Toast.show({ type: 'error', text1: apiErrorMessage(e, 'Could not load held bills') });
    }
  }

  async function resume(h: HeldCart) {
    try {
      const cartData = await billingApi.resumeHeld(h.id);
      loadLines(cartData.lines);
      setHeldOpen(false);
    } catch (e) {
      Toast.show({ type: 'error', text1: apiErrorMessage(e, 'Could not resume') });
    }
  }

  async function discard() {
    if (!discardTarget) return;
    try {
      await billingApi.discardHeld(discardTarget.id);
      setHeld((h) => h.filter((x) => x.id !== discardTarget.id));
    } catch (e) {
      Toast.show({ type: 'error', text1: apiErrorMessage(e, 'Could not discard') });
    } finally {
      setDiscardTarget(null);
    }
  }

  async function repeatLast() {
    try {
      const d = todayIso();
      const page = await billingApi.listBills({ from: d, to: d, status: 'COMPLETED', size: 1 });
      if (page.content.length === 0) {
        Toast.show({ type: 'info', text1: 'No bill today to repeat' });
        return;
      }
      const last = await billingApi.getBill(page.content[0].id);
      loadLines(last.lines.flatMap((l) => (l.itemId ? [{ itemId: l.itemId, quantity: l.quantity }] : [])));
    } catch (e) {
      Toast.show({ type: 'error', text1: apiErrorMessage(e, 'Could not load the last bill') });
    }
  }

  /** Print / Retry Print for an already SAVED bill: never calls createBill. */
  async function print(b: Bill) {
    if (printRef.current) return;
    printRef.current = true;
    setPrinting(true);
    const err = await tryPrint(b, printReceipt);
    setPrintError(err ?? '');
    printRef.current = false;
    setPrinting(false);
    if (err) Toast.show({ type: 'error', text1: savedButNotPrinted(err), visibilityTime: 6000 });
  }

  if (loading) return <LoadingView />;

  const cartPanel = (
    <View style={styles.cartPanel}>
      {lines.length === 0 ? (
        <EmptyState icon={<ShoppingBag size={28} color={colors.textTertiary} />} title="Cart is empty" message="Tap an item to add it." />
      ) : (
        lines.map(({ item, quantity }) => (
          <View key={item.id} style={styles.cartRow}>
            <View style={{ flex: 1 }}>
              <Text style={typography.bodyMedium} numberOfLines={1}>{item.emoji} {item.name}</Text>
              <Text style={typography.caption}>{cur}{item.price.toFixed(2)} each</Text>
            </View>
            <QuantityStepper compact quantity={quantity} onIncrement={() => setQty(item.id, quantity + 1)}
              onDecrement={() => setQty(item.id, quantity - 1)} onChangeQuantity={(q) => setQty(item.id, q)} />
            <Pressable hitSlop={8} onPress={() => setQty(item.id, 0)} accessibilityLabel={`Remove ${item.name}`}>
              <Trash2 size={18} color={colors.danger} />
            </Pressable>
          </View>
        ))
      )}

      <View style={styles.chips}>
        <Chip label={`GST ${settings?.gstPercent ?? 0}%`} active={gstEnabled} onPress={() => { keyRef.current = null; setGstEnabled((g) => !g); }} />
      </View>
      <Text style={[typography.caption, styles.label]}>Payment (recorded manually, not verified)</Text>
      <View style={styles.chips}>
        {METHODS.map((m) => (
          <Chip key={m} label={m} active={method === m} onPress={() => { keyRef.current = null; setMethod(method === m ? null : m); }} />
        ))}
      </View>

      <View style={styles.totals}>
        <Row label="Subtotal" value={`${cur}${totals.subtotal.toFixed(2)}`} />
        {gstEnabled && <Row label={`GST ${settings?.gstPercent ?? 0}%`} value={`${cur}${totals.gst.toFixed(2)}`} />}
        <Row label="Total" value={`${cur}${totals.total.toFixed(2)}`} bold />
      </View>

      <Button label={`Print Bill · ${cur}${totals.total.toFixed(2)}`} size="lg" onPress={() => checkout(true)}
        icon={<Printer size={18} color={colors.textOnPrimary} />} loading={submitting} disabled={lines.length === 0 || submitting} />
      <Text style={typography.caption}>Saves the bill once, then prints it to {pStatus.state === 'connected' ? pStatus.deviceName : 'your Bluetooth printer'}.</Text>
      <Button label="Save bill only" variant="secondary" onPress={() => checkout(false)} disabled={lines.length === 0 || submitting} />
      <View style={styles.actionRow}>
        <Cell><Button label="Hold" variant="secondary" icon={<Pause size={16} color={colors.textPrimary} />}
          onPress={hold} disabled={lines.length === 0} /></Cell>
        <Cell><Button label="Clear" variant="secondary" onPress={() => setClearOpen(true)} disabled={lines.length === 0} /></Cell>
      </View>
    </View>
  );

  const grid = (
    <View>
      <TextInput value={search} onChangeText={setSearch} placeholder="Search items" placeholderTextColor={colors.textTertiary}
        style={styles.search} accessibilityLabel="Search items" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="All" active={category === 'ALL'} onPress={() => setCategory('ALL')} />
        {(catalog?.categories ?? []).map((c) => (
          <Chip key={c.id} label={c.name} active={category === c.id} onPress={() => setCategory(c.id)} />
        ))}
      </ScrollView>
      {visible.length === 0 ? (
        <EmptyState icon={<Package size={28} color={colors.textTertiary} />} title="No items"
          message={isAdmin ? 'Add items under Menu / Catalog.' : 'Ask an admin to add items to the billing catalog.'} />
      ) : (
        <View style={styles.grid}>
          {visible.map((item) => {
            const q = cart[item.id] ?? 0;
            return (
              <Pressable key={item.id} onPress={() => add(item)} disabled={!item.available}
                accessibilityLabel={`Add ${item.name}`} style={[styles.tile, !item.available && styles.tileOff, q > 0 && styles.tileOn]}>
                <Text style={styles.emoji}>{item.emoji || '🍽️'}</Text>
                <Text style={typography.bodyMedium} numberOfLines={2}>{item.name}</Text>
                <Text style={typography.caption}>{item.available ? `${cur}${item.price.toFixed(2)}` : 'Sold out'}</Text>
                {q > 0 && <View style={styles.qtyBadge}><Text style={styles.qtyText}>{q}</Text></View>}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );

  return (
    <ScreenContainer edges={['top']} scroll={false} contentStyle={{ padding: 0 }}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={typography.h1}>Billing</Text>
          <Pressable onPress={() => nav.navigate('BillingPrinter')} accessibilityLabel="Printer status"
            style={[styles.pill, pStatus.state === 'connected' && styles.pillOn]}>
            <Printer size={14} color={colors.textPrimary} />
            <Text style={typography.caption} numberOfLines={1}>
              {pStatus.state === 'connected' ? pStatus.deviceName : pStatus.state === 'connecting' ? 'Connecting...' : 'No printer'}
            </Text>
          </Pressable>
        </View>
        {/* Groups wrap instead of scrolling: nothing hides off-screen. */}
        <View style={styles.toolbar}>
          {groups.map((g) => (
            <Chip key={g.key} label={g.label} active={group === g.key} onPress={() => setGroup(g.key)} />
          ))}
        </View>
        <View style={styles.toolbar}>
          {(groups.find((g) => g.key === group) ?? groups[0]).entries.map((e) => (
            <Button key={e.key} label={e.label} variant="secondary" fullWidth={false}
              icon={TOOLBAR_ICONS[e.key]}
              onPress={() => (e.key === 'held' ? openHeld() : e.key === 'repeat' ? repeatLast() : nav.navigate(e.route!))} />
          ))}
        </View>
      </View>

      {wide ? (
        <View style={styles.split}>
          <ScrollView style={styles.flex} contentContainerStyle={styles.pad}>{grid}</ScrollView>
          <ScrollView style={styles.side} contentContainerStyle={styles.pad}>{cartPanel}</ScrollView>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: 110 }]}>{grid}</ScrollView>
          <View style={styles.bar}>
            <Button label={count ? `View cart (${count}) · ${cur}${totals.total.toFixed(2)}` : 'Cart is empty'}
              onPress={() => setCartOpen(true)} disabled={count === 0} size="lg" />
          </View>
          <FormModal visible={cartOpen} title="Current bill" onClose={() => setCartOpen(false)}>{cartPanel}</FormModal>
        </>
      )}

      <FormModal visible={!!receipt} title="Bill saved" onClose={() => setReceipt(null)}>
        {receipt && (
          <Card elevated={false}>
            <Text style={typography.h2}>{receipt.invoiceNumber}</Text>
            {receipt.lines.map((l, i) => (
              <Row key={i} label={`${l.itemName} x${l.quantity}`} value={`${receipt.currencySymbol}${l.lineTotal.toFixed(2)}`} />
            ))}
            {receipt.gstAmount > 0 && <Row label={`GST ${receipt.gstPercent}%`} value={`${receipt.currencySymbol}${receipt.gstAmount.toFixed(2)}`} />}
            <Row label="Total" value={`${receipt.currencySymbol}${receipt.total.toFixed(2)}`} bold />
            <Text style={typography.bodyMedium}>Bill saved</Text>
            {printError === '' && <Text style={typography.caption}>Sent to the printer. Check the paper: only a printed slip proves it printed.</Text>}
            {!!printError && <Text style={[typography.body, { color: colors.danger }]}>{savedButNotPrinted(printError)}</Text>}
            <Button label={printError === null ? 'Print receipt' : printError === '' ? 'Print again' : 'Retry Print'}
              icon={<Printer size={18} color={colors.textOnPrimary} />} loading={printing} disabled={printing} onPress={() => print(receipt)} />
            {!!printError && (
              <>
                <Button label="Connect printer" variant="secondary" style={{ marginTop: spacing.sm }}
                  onPress={() => { setReceipt(null); nav.navigate('BillingPrinter'); }} />
                <Button label="Share receipt instead" variant="secondary" style={{ marginTop: spacing.sm }}
                  onPress={() => shareReceipt(receipt).catch(() => {})} />
              </>
            )}
            <Button label="New bill" variant="secondary" onPress={() => setReceipt(null)} style={{ marginTop: spacing.sm }} />
          </Card>
        )}
      </FormModal>

      <FormModal visible={heldOpen} title="Held bills" onClose={() => setHeldOpen(false)}>
        {held.length === 0 ? <Text style={typography.body}>No held bills.</Text> : held.map((h) => (
          <Card key={h.id} style={{ marginBottom: spacing.sm }}>
            <Text style={typography.bodyMedium}>
              {h.lines.reduce((s, l) => s + l.quantity, 0)} items · {new Date(h.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
            </Text>
            <Text style={typography.caption} numberOfLines={2}>
              {h.lines.map((l) => `${byId.get(l.itemId)?.name ?? 'Removed item'} x${l.quantity}`).join(', ')}
            </Text>
            <View style={styles.actionRow}>
              <Cell><Button label="Resume" onPress={() => resume(h)} /></Cell>
              <Cell><Button label="Discard" variant="danger" onPress={() => setDiscardTarget(h)} /></Cell>
            </View>
          </Card>
        ))}
      </FormModal>

      <ConfirmSheet visible={!!discardTarget} title="Discard held bill?" message="This held bill will be deleted."
        confirmLabel="Discard" onConfirm={discard} onClose={() => setDiscardTarget(null)} />
      <ConfirmSheet visible={clearOpen} title="Clear cart?" message="All items in the current bill will be removed."
        confirmLabel="Clear" onConfirm={() => { resetCart(); setClearOpen(false); }} onClose={() => setClearOpen(false)} />
    </ScreenContainer>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={bold ? typography.bodyMedium : typography.body}>{label}</Text>
      <Text style={bold ? typography.bodyMedium : typography.body}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 200, paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  pillOn: { borderColor: colors.primary, backgroundColor: colors.primarySurface },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  split: { flex: 1, flexDirection: 'row' },
  side: { width: 380, borderLeftWidth: 1, borderLeftColor: colors.border, backgroundColor: colors.surface },
  pad: { padding: spacing.lg },
  flex: { flex: 1 },
  search: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.DEFAULT, padding: spacing.md,
    marginBottom: spacing.sm, color: colors.textPrimary, backgroundColor: colors.surface,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  tile: {
    width: 150, minHeight: 112, padding: spacing.md, borderRadius: radius.md, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface, gap: 2,
  },
  tileOn: { borderColor: colors.primary, backgroundColor: colors.primarySurface },
  tileOff: { opacity: 0.45 },
  emoji: { fontSize: 26 },
  qtyBadge: {
    position: 'absolute', top: 6, right: 6, minWidth: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  qtyText: { color: colors.textOnPrimary, fontWeight: '700', fontSize: 12 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, backgroundColor: colors.background },
  cartPanel: { gap: spacing.sm },
  cartRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  label: { marginTop: spacing.sm },
  totals: { marginVertical: spacing.sm, gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});
