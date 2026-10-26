import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { billingApi } from '../../api/billing';
import { apiErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import ConfirmDialog from '../../components/ConfirmDialog';
import EmptyState from '../../components/EmptyState';
import { isBillingAdmin } from '../../utils/billingLogic';
import { BillingHeader, Modal } from './BillingShared';
import './Billing.css';

const EMPTY_ITEM = { id: null, categoryId: '', name: '', price: '', emoji: '', favorite: false, available: true };

export default function BillingCatalogPage() {
  const { role } = useAuth();
  const admin = isBillingAdmin(role);
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [itemForm, setItemForm] = useState(null);
  const [catForm, setCatForm] = useState(null); // {id|null, name}
  const [archive, setArchive] = useState(null); // {kind:'item'|'category', id, name}
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setCatalog(await billingApi.catalog());
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Failed to load catalog'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, ok) => {
    setSaving(true);
    try {
      await fn();
      if (ok) toast.success(ok);
      await load();
      return true;
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not save'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggle = (item) => run(() => billingApi.setAvailability(item.id, !item.available));

  const saveItem = async (e) => {
    e.preventDefault();
    const price = Number(itemForm.price);
    if (!itemForm.name.trim()) return toast.error('Enter a name');
    if (!itemForm.categoryId) return toast.error('Choose a category');
    if (itemForm.price === '' || Number.isNaN(price) || price < 0) return toast.error('Enter a valid price');
    const body = {
      categoryId: itemForm.categoryId, name: itemForm.name.trim(), price,
      emoji: itemForm.emoji.trim(), favorite: itemForm.favorite, available: itemForm.available,
    };
    const done = await run(() => (itemForm.id ? billingApi.updateItem(itemForm.id, body) : billingApi.createItem(body)), 'Item saved');
    if (done) setItemForm(null);
  };

  const saveCategory = async (e) => {
    e.preventDefault();
    if (!catForm.name.trim()) return toast.error('Enter a name');
    const done = await run(
      () => (catForm.id ? billingApi.updateCategory(catForm.id, catForm.name.trim()) : billingApi.createCategory(catForm.name.trim())),
      'Category saved',
    );
    if (done) setCatForm(null);
  };

  const doArchive = async () => {
    const target = archive;
    setArchive(null);
    await run(() => (target.kind === 'item' ? billingApi.archiveItem(target.id) : billingApi.archiveCategory(target.id)), 'Removed');
  };

  if (loading) return <div className="loading-state">Loading catalog...</div>;
  const categories = catalog?.categories ?? [];
  const items = catalog?.items ?? [];

  return (
    <div className="bp-wrap bp-narrow">
      <BillingHeader title={admin ? 'Menu / Catalog' : 'Menu availability'}
        subtitle={admin ? 'Items and categories used at the billing counter.' : 'Mark items sold out or back in stock.'} />
      {admin && (
        <div className="bp-toolbar">
          <button type="button" className="btn-primary" onClick={() => setCatForm({ id: null, name: '' })}><Plus size={16} /> Category</button>
          <button type="button" className="btn-primary" disabled={categories.length === 0}
            onClick={() => setItemForm({ ...EMPTY_ITEM, categoryId: categories[0]?.id ?? '' })}><Plus size={16} /> Item</button>
        </div>
      )}

      {categories.length === 0 ? (
        <EmptyState icon={Package} title="No categories yet" message={admin ? 'Add a category, then add items to it.' : 'Ask an admin to add items.'} />
      ) : categories.map((c) => (
        <section key={c.id} className="card bp-cat">
          <div className="bp-cat-head">
            <h2>{c.name}</h2>
            {admin && (
              <span>
                <button type="button" className="bp-icon-btn" aria-label={`Rename ${c.name}`} onClick={() => setCatForm({ id: c.id, name: c.name })}><Pencil size={16} /></button>
                <button type="button" className="bp-icon-btn" aria-label={`Remove ${c.name}`} onClick={() => setArchive({ kind: 'category', id: c.id, name: c.name })}><Trash2 size={16} /></button>
              </span>
            )}
          </div>
          {items.filter((i) => i.categoryId === c.id).map((i) => (
            <div key={i.id} className="bp-item-row">
              <span className="bp-item-name">{i.emoji} {i.name}</span>
              <span>{Number(i.price).toFixed(2)}</span>
              <label className="bp-check">
                <input type="checkbox" checked={i.available} disabled={saving} onChange={() => toggle(i)} aria-label={`${i.name} available`} />
                {i.available ? 'Available' : 'Sold out'}
              </label>
              {admin && (
                <span>
                  <button type="button" className="bp-icon-btn" aria-label={`Edit ${i.name}`}
                    onClick={() => setItemForm({ id: i.id, categoryId: i.categoryId, name: i.name, price: String(i.price), emoji: i.emoji, favorite: i.favorite, available: i.available })}><Pencil size={16} /></button>
                  <button type="button" className="bp-icon-btn" aria-label={`Remove ${i.name}`} onClick={() => setArchive({ kind: 'item', id: i.id, name: i.name })}><Trash2 size={16} /></button>
                </span>
              )}
            </div>
          ))}
        </section>
      ))}

      {itemForm && (
        <Modal title={itemForm.id ? 'Edit item' : 'New item'} onClose={() => setItemForm(null)}>
          <form onSubmit={saveItem} noValidate className="bp-form">
            <div className="form-group"><label htmlFor="bp-i-cat">Category</label>
              <select id="bp-i-cat" value={itemForm.categoryId} onChange={(e) => setItemForm({ ...itemForm, categoryId: e.target.value })}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
            <div className="form-group"><label htmlFor="bp-i-name">Name</label>
              <input id="bp-i-name" type="text" maxLength={120} autoFocus value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} /></div>
            <div className="form-group"><label htmlFor="bp-i-price">Price</label>
              <input id="bp-i-price" type="number" step="0.01" min="0" value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} /></div>
            <div className="form-group"><label htmlFor="bp-i-emoji">Emoji (optional)</label>
              <input id="bp-i-emoji" type="text" maxLength={16} value={itemForm.emoji} onChange={(e) => setItemForm({ ...itemForm, emoji: e.target.value })} /></div>
            <label className="bp-check"><input type="checkbox" checked={itemForm.favorite} onChange={(e) => setItemForm({ ...itemForm, favorite: e.target.checked })} /> Favourite</label>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setItemForm(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}

      {catForm && (
        <Modal title={catForm.id ? 'Rename category' : 'New category'} onClose={() => setCatForm(null)}>
          <form onSubmit={saveCategory} noValidate className="bp-form">
            <div className="form-group"><label htmlFor="bp-c-name">Name</label>
              <input id="bp-c-name" type="text" maxLength={80} autoFocus value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} /></div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setCatForm(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}

      <ConfirmDialog open={!!archive} title={`Remove ${archive?.kind ?? ''}?`}
        message={`"${archive?.name ?? ''}" will no longer appear at the counter. Past bills are not affected.`}
        confirmLabel="Remove" onConfirm={doArchive} onCancel={() => setArchive(null)} />
    </div>
  );
}
