import React, { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { LoadingView } from '../../components/LoadingView';
import { apiErrorMessage } from '../../api/client';
import { billingApi, type PosSettings } from '../../api/billing';
import { spacing, typography } from '../../theme';

/** Receipt header and GST. Only reachable by Canteen Admin (backend PUT is admin-only). */
export function BillingSettingsScreen() {
  const [s, setS] = useState<PosSettings | null>(null);
  const [gst, setGst] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    billingApi.settings().then((v) => { setS(v); setGst(String(v.gstPercent)); })
      .catch((e) => Toast.show({ type: 'error', text1: apiErrorMessage(e, 'Failed to load settings') }));
  }, []);

  if (!s) return <LoadingView />;
  const set = (k: keyof PosSettings) => (v: string) => setS({ ...s, [k]: v });

  async function save() {
    const pct = Number(gst);
    if (!s || gst.trim() === '' || !Number.isFinite(pct) || pct < 0 || pct > 100) {
      setError('GST must be between 0 and 100');
      return;
    }
    if (!s.businessName.trim()) {
      Toast.show({ type: 'error', text1: 'Business name is required' });
      return;
    }
    setError('');
    setSaving(true);
    try {
      setS(await billingApi.updateSettings({ ...s, gstPercent: pct }));
      Toast.show({ type: 'success', text1: 'Settings saved' });
    } catch (e) {
      Toast.show({ type: 'error', text1: apiErrorMessage(e, 'Could not save settings') });
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenContainer maxWidth={560}>
      <Text style={typography.h1}>Billing settings</Text>
      <Text style={{ ...typography.bodySmall, marginBottom: spacing.lg }}>Changes apply to new bills only; issued receipts keep their original header and rate.</Text>
      <Input label="Business name" value={s.businessName} onChangeText={set('businessName')} maxLength={120} required />
      <Input label="Address" value={s.address} onChangeText={set('address')} maxLength={255} />
      <Input label="Phone" value={s.phone} onChangeText={set('phone')} maxLength={30} keyboardType="phone-pad" />
      <Input label="GSTIN" value={s.gstin} onChangeText={set('gstin')} maxLength={20} autoCapitalize="characters" />
      <Input label="Receipt footer" value={s.footerMessage} onChangeText={set('footerMessage')} maxLength={160} />
      <Input label="Currency symbol" value={s.currencySymbol} onChangeText={set('currencySymbol')} maxLength={4} />
      <Input label="GST %" value={gst} onChangeText={setGst} keyboardType="decimal-pad" error={error} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.md }}>
        <Switch value={s.gstEnabledDefault} onValueChange={(v) => setS({ ...s, gstEnabledDefault: v })} />
        <Text style={typography.body}>Charge GST on new bills by default</Text>
      </View>
      <Button label="Save settings" onPress={save} loading={saving} />
    </ScreenContainer>
  );
}
