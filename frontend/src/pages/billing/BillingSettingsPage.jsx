import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { billingApi } from '../../api/billing';
import { apiErrorMessage } from '../../api/client';
import { BillingHeader } from './BillingShared';
import './Billing.css';

const TEXT_FIELDS = [
  ['businessName', 'Business name', 120],
  ['address', 'Address', 255],
  ['phone', 'Phone', 30],
  ['gstin', 'GSTIN', 20],
  ['footerMessage', 'Receipt footer', 160],
  ['currencySymbol', 'Currency symbol', 4],
];

export default function BillingSettingsPage() {
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    billingApi.settings().then(setForm).catch((e) => setError(apiErrorMessage(e, 'Failed to load settings')));
  }, []);

  if (error) return <div className="bp-wrap bp-narrow"><BillingHeader title="Billing settings" /><p className="text-error">{error}</p></div>;
  if (!form) return <div className="loading-state">Loading settings...</div>;

  const save = async (e) => {
    e.preventDefault();
    const gst = Number(form.gstPercent);
    if (Number.isNaN(gst) || gst < 0 || gst > 100) return toast.error('GST must be between 0 and 100');
    if (!form.businessName.trim()) return toast.error('Business name is required');
    setSaving(true);
    try {
      setForm(await billingApi.updateSettings({ ...form, gstPercent: gst }));
      toast.success('Settings saved');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not save settings'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bp-wrap bp-narrow">
      <BillingHeader title="Billing settings" subtitle="Printed on every new receipt. Existing bills keep the header they were issued with." />
      <form className="card bp-form" onSubmit={save} noValidate>
        {TEXT_FIELDS.map(([key, label, max]) => (
          <div className="form-group" key={key}>
            <label htmlFor={`bp-${key}`}>{label}</label>
            <input id={`bp-${key}`} type="text" maxLength={max} value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
          </div>
        ))}
        <div className="form-group">
          <label htmlFor="bp-gst">GST %</label>
          <input id="bp-gst" type="number" step="0.01" min="0" max="100" value={form.gstPercent} onChange={(e) => setForm({ ...form, gstPercent: e.target.value })} />
        </div>
        <label className="bp-check">
          <input type="checkbox" checked={!!form.gstEnabledDefault} onChange={(e) => setForm({ ...form, gstEnabledDefault: e.target.checked })} />
          Charge GST by default on new bills
        </label>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save settings'}</button>
      </form>
    </div>
  );
}
