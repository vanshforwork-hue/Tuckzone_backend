import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Pencil, Plus, Trash2 } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Card } from '../../components/Card';
import { Chip } from '../../components/Chip';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { FormModal } from '../../components/FormModal';
import { LoadingView } from '../../components/LoadingView';
import { apiErrorMessage } from '../../api/client';
import { billingApi, type PosCatalog, type PosCategory, type PosItem } from '../../api/billing';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, typography } from '../../theme';
import { Cell } from './Cell';
import { ConfirmSheet } from './ConfirmSheet';

type Target = { kind: 'item'; item: PosItem } | { kind: 'category'; category: PosCategory };

/**
 * Admin: full catalog CRUD. Sub admin: read-only list plus the sold-out switch (the backend
 * rejects every other write with 403, so those controls are simply not shown).
 */
export function BillingCatalogScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'CANTEEN_ADMIN';
  const [catalog, setCatalog] = useState<PosCatalog | null>(null);
  const [itemForm, setItemForm] = useState<{ id?: string } | null>(null);
  const [catForm, setCatForm] = useState<{ id?: string } | null>(null);
  const [f, setF] = useState({ name: '', price: '', emoji: '', categoryId: '', sortOrder: '0', available: true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);

  const load = useCallback(async () => {
    try {
      setCatalog(await billingApi.catalog());
    } catch (e) {
      Toast.show({ type: 'error', text1: apiErrorMessage(e, 'Failed to load catalog') });
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const fail = (e: unknown, fallback: string) => Toast.show({ type: 'error', text1: apiErrorMessage(e, fallback) });

  function openItem(item?: PosItem) {
    setErrors({});
    setF({
      name: item?.name ?? '', price: item ? String(item.price) : '', emoji: item?.emoji ?? '',
      categoryId: item?.categoryId ?? catalog?.categories[0]?.id ?? '', sortOrder: String(item?.sortOrder ?? 0), available: item?.available ?? true,
    });
    setItemForm({ id: item?.id });
  }

  async function saveItem() {
    const e: Record<string, string> = {};
    const price = Number(f.price.trim());
    if (!f.name.trim()) e.name = 'Name is required';
    if (!/^\d{1,7}(\.\d{1,2})?$/.test(f.price.trim())) e.price = 'Enter a price with at most 2 decimals';
    if (!f.categoryId) e.categoryId = 'Create a category first';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      const body = { categoryId: f.categoryId, name: f.name.trim(), price, emoji: f.emoji.trim(), available: f.available, sortOrder: parseInt(f.sortOrder, 10) || 0 };
      if (itemForm?.id) await billingApi.updateItem(itemForm.id, body); else await billingApi.createItem(body);
      setItemForm(null);
      load();
    } catch (err) {
      fail(err, 'Could not save item');
    } finally {
      setSaving(false);
    }
  }

  async function saveCategory() {
    if (!f.name.trim()) { setErrors({ name: 'Name is required' }); return; }
    setSaving(true);
    try {
      const order = parseInt(f.sortOrder, 10) || 0;
      if (catForm?.id) await billingApi.updateCategory(catForm.id, f.name.trim(), order);
      else await billingApi.createCategory(f.name.trim(), order);
      setCatForm(null);
      load();
    } catch (err) {
      fail(err, 'Could not save category');
    } finally {
      setSaving(false);
    }
  }

  async function toggle(item: PosItem, available: boolean) {
    try {
      await billingApi.setAvailability(item.id, available);
      setCatalog((c) => c && { ...c, items: c.items.map((i) => (i.id === item.id ? { ...i, available } : i)) });
    } catch (err) {
      fail(err, 'Could not update availability');
    }
  }

  async function confirmDelete() {
    if (!target) return;
    try {
      if (target.kind === 'item') await billingApi.archiveItem(target.item.id);
      else await billingApi.archiveCategory(target.category.id);
      setTarget(null);
      load();
    } catch (err) {
      setTarget(null);
      fail(err, 'Could not remove');
    }
  }

  if (!catalog) return <LoadingView />;

  return (
    <ScreenContainer onRefresh={load}>
      <Text style={typography.h1}>Menu / Catalog</Text>
      <Text style={styles.sub}>
        {isAdmin ? 'Items sold at the counter. Past bills keep their original names and prices.' : 'Switch items off when they sell out.'}
      </Text>
      {isAdmin && (
        <View style={styles.actions}>
          <Cell><Button label="Add item" icon={<Plus size={16} color={colors.textOnPrimary} />} onPress={() => openItem()}
            disabled={catalog.categories.length === 0} /></Cell>
          <Cell><Button label="Add category" variant="secondary" onPress={() => { setErrors({}); setF({ ...f, name: '', sortOrder: '0' }); setCatForm({}); }} /></Cell>
        </View>
      )}

      {catalog.categories.map((cat) => (
        <View key={cat.id} style={{ marginBottom: spacing.lg }}>
          <View style={styles.catHead}>
            <Text style={typography.h3}>{cat.name}</Text>
            {isAdmin && (
              <View style={styles.icons}>
                <Pressable hitSlop={8} accessibilityLabel={`Rename ${cat.name}`} onPress={() => { setErrors({}); setF({ ...f, name: cat.name, sortOrder: String(cat.sortOrder) }); setCatForm({ id: cat.id }); }}>
                  <Pencil size={18} color={colors.textSecondary} />
                </Pressable>
                <Pressable hitSlop={8} accessibilityLabel={`Deactivate ${cat.name}`} onPress={() => setTarget({ kind: 'category', category: cat })}>
                  <Trash2 size={18} color={colors.danger} />
                </Pressable>
              </View>
            )}
          </View>
          {catalog.items.filter((i) => i.categoryId === cat.id).map((item) => (
            <Card key={item.id} style={styles.item}>
              <View style={{ flex: 1 }}>
                <Text style={typography.bodyMedium}>{item.emoji} {item.name}</Text>
                <Text style={typography.caption}>{item.price.toFixed(2)}{item.available ? '' : ' · sold out'}</Text>
              </View>
              <Switch value={item.available} onValueChange={(v) => toggle(item, v)} accessibilityLabel={`${item.name} available`} />
              {isAdmin && (
                <View style={styles.icons}>
                  <Pressable hitSlop={8} accessibilityLabel={`Edit ${item.name}`} onPress={() => openItem(item)}><Pencil size={18} color={colors.textSecondary} /></Pressable>
                  <Pressable hitSlop={8} accessibilityLabel={`Deactivate ${item.name}`} onPress={() => setTarget({ kind: 'item', item })}><Trash2 size={18} color={colors.danger} /></Pressable>
                </View>
              )}
            </Card>
          ))}
        </View>
      ))}

      <FormModal visible={!!itemForm} title={itemForm?.id ? 'Edit item' : 'Add item'} onClose={() => setItemForm(null)}>
        <Input label="Name" value={f.name} onChangeText={(v) => setF({ ...f, name: v })} error={errors.name} maxLength={120} required />
        <Input label="Price" value={f.price} onChangeText={(v) => setF({ ...f, price: v })} error={errors.price} keyboardType="decimal-pad" required />
        <Input label="Emoji (optional)" value={f.emoji} onChangeText={(v) => setF({ ...f, emoji: v })} maxLength={8} />
        <Input label="Sort order" value={f.sortOrder} onChangeText={(v) => setF({ ...f, sortOrder: v })} keyboardType="number-pad" />
        <View style={styles.switchRow}>
          <Switch value={f.available} onValueChange={(v) => setF({ ...f, available: v })} />
          <Text style={typography.body}>Available for sale</Text>
        </View>
        <Text style={typography.caption}>Category</Text>
        <View style={styles.chips}>
          {catalog.categories.map((c) => (
            <Chip key={c.id} label={c.name} active={f.categoryId === c.id} onPress={() => setF({ ...f, categoryId: c.id })} />
          ))}
        </View>
        {!!errors.categoryId && <Text style={{ color: colors.danger }}>{errors.categoryId}</Text>}
        <Button label="Save" onPress={saveItem} loading={saving} style={{ marginTop: spacing.md }} />
      </FormModal>

      <FormModal visible={!!catForm} title={catForm?.id ? 'Rename category' : 'Add category'} onClose={() => setCatForm(null)}>
        <Input label="Name" value={f.name} onChangeText={(v) => setF({ ...f, name: v })} error={errors.name} maxLength={80} required />
        <Input label="Sort order" value={f.sortOrder} onChangeText={(v) => setF({ ...f, sortOrder: v })} keyboardType="number-pad" />
        <Button label="Save" onPress={saveCategory} loading={saving} />
      </FormModal>

      <ConfirmSheet visible={!!target} title="Deactivate?" confirmLabel="Deactivate" onConfirm={confirmDelete} onClose={() => setTarget(null)}
        message={target?.kind === 'item'
          ? `"${target.item.name}" will no longer be sold. Existing bills are not affected.`
          : target ? `Deactivate the category "${target.category.name}"? It must have no active items.` : ''} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  sub: { ...typography.bodySmall, marginTop: 2, marginBottom: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  flex: { flex: 1 },
  catHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  icons: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: spacing.sm },
});
