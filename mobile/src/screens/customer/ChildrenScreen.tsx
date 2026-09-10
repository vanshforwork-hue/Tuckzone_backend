import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Pencil, Trash2, GraduationCap, Users, UserPlus } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { LoadingView } from '../../components/LoadingView';
import { wardsApi } from '../../api/wards';
import { apiErrorMessage } from '../../api/client';
import { validateRequired } from '../../utils/validation';
import { colors, spacing, typography } from '../../theme';
import type { WardResponse } from '../../api/types';

const EMPTY_FORM = { name: '', studentClass: '', section: '' };

export function ChildrenScreen() {
  const [wards, setWards] = useState<WardResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState(EMPTY_FORM);
  const [editingWardId, setEditingWardId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await wardsApi.list();
      setWards(data);
    } catch (error) {
      Toast.show({ type: 'error', text1: apiErrorMessage(error, 'Failed to load your wards') });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function startEdit(ward: WardResponse) {
    setEditingWardId(ward.id);
    setForm({ name: ward.name, studentClass: ward.studentClass, section: ward.section });
    setErrors({});
  }

  function cancelEdit() {
    setEditingWardId(null);
    setForm(EMPTY_FORM);
    setErrors({});
  }

  async function handleSubmit() {
    const nextErrors: Record<string, string> = {};
    const nameError = validateRequired(form.name, 'Ward name');
    const classError = validateRequired(form.studentClass, 'Class');
    const sectionError = validateRequired(form.section, 'Section');
    if (nameError) nextErrors.name = nameError;
    if (classError) nextErrors.studentClass = classError;
    if (sectionError) nextErrors.section = sectionError;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload = {
      name: form.name.trim(),
      studentClass: form.studentClass.trim(),
      section: form.section.trim(),
    };

    setSaving(true);
    try {
      if (editingWardId) {
        await wardsApi.update(editingWardId, payload);
        Toast.show({ type: 'success', text1: 'Ward updated' });
      } else {
        await wardsApi.create(payload);
        Toast.show({ type: 'success', text1: 'Ward added' });
      }
      cancelEdit();
      load();
    } catch (error) {
      Toast.show({ type: 'error', text1: apiErrorMessage(error, 'Could not save ward') });
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(ward: WardResponse) {
    Alert.alert('Remove ward?', `Remove ${ward.name} from your wards?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await wardsApi.remove(ward.id);
            Toast.show({ type: 'success', text1: 'Ward removed' });
            if (editingWardId === ward.id) cancelEdit();
            load();
          } catch (error) {
            Toast.show({ type: 'error', text1: apiErrorMessage(error, 'Could not remove ward') });
          }
        },
      },
    ]);
  }

  if (loading) return <LoadingView />;

  return (
    <ScreenContainer edges={['top']}>
      <Text style={typography.h1}>My Wards</Text>
      <Text style={styles.subtitle}>Add the children you order food for</Text>

      <Card style={styles.linkCard}>
        <View style={styles.linkHeader}>
          <UserPlus size={18} color={colors.primaryDark} />
          <Text style={typography.h3}>{editingWardId ? 'Edit Ward' : 'Add Your Ward'}</Text>
        </View>
        <Input
          label="Ward Name"
          placeholder="e.g. Aarav Sharma"
          value={form.name}
          onChangeText={(text) => setForm({ ...form, name: text })}
          error={errors.name}
        />
        <View style={styles.row}>
          <View style={styles.half}>
            <Input
              label="Class"
              placeholder="e.g. VIII"
              value={form.studentClass}
              onChangeText={(text) => setForm({ ...form, studentClass: text })}
              error={errors.studentClass}
            />
          </View>
          <View style={styles.half}>
            <Input
              label="Section"
              placeholder="e.g. B"
              value={form.section}
              onChangeText={(text) => setForm({ ...form, section: text })}
              error={errors.section}
            />
          </View>
        </View>
        <Button label={editingWardId ? 'Save Changes' : 'Add Ward'} onPress={handleSubmit} loading={saving} />
        {editingWardId && <Button label="Cancel" variant="secondary" onPress={cancelEdit} />}
      </Card>

      <Text style={[typography.h2, styles.sectionTitle]}>Your Wards</Text>
      {wards.length === 0 ? (
        <EmptyState
          icon={<Users color={colors.primaryDark} size={26} />}
          title="No wards added yet"
          message="Add a ward above to order food on their behalf."
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          {wards.map((ward) => (
            <Card key={ward.id} style={styles.childCard}>
              <View style={styles.childAvatar}>
                <GraduationCap size={24} color={colors.pastelPinkFg} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={typography.h3}>{ward.name}</Text>
                <Text style={styles.childMeta}>
                  Class {ward.studentClass}-{ward.section}
                </Text>
              </View>
              <View style={styles.actionButtons}>
                <Button
                  label=""
                  variant="ghost"
                  fullWidth={false}
                  icon={<Pencil size={18} color={colors.textSecondary} />}
                  onPress={() => startEdit(ward)}
                  style={styles.iconButton}
                />
                <Button
                  label=""
                  variant="ghost"
                  fullWidth={false}
                  icon={<Trash2 size={18} color={colors.danger} />}
                  onPress={() => confirmDelete(ward)}
                  style={styles.iconButton}
                />
              </View>
            </Card>
          ))}
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  subtitle: { ...typography.bodySmall, marginTop: 2, marginBottom: spacing.lg },
  linkCard: { gap: spacing.sm },
  linkHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
  sectionTitle: { marginTop: spacing.xxl, marginBottom: spacing.md },
  childCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  childAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.pastelPink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  childMeta: { ...typography.bodySmall, marginTop: 2 },
  actionButtons: { flexDirection: 'row', gap: spacing.xs },
  iconButton: { paddingHorizontal: 0, paddingVertical: 0, width: 36 },
});
