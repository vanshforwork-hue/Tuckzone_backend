import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pause, Play, Printer, RotateCcw, ShoppingBag, Trash2, Package, History, Settings, BarChart3, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { billingApi } from '../../api/billing';
import { apiErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import QuantityInput from '../../components/QuantityInput';
import ConfirmDialog from '../../components/ConfirmDialog';
import EmptyState from '../../components/EmptyState';
import { printReceipt } from '../../utils/printReceipt';
import {
  PAYMENT_METHODS, billingMenuEntries, cartFromLines, filterItems, newIdempotencyKey,
  money, previewTotals, setCartQty, todayIso,
} from '../../utils/billingLogic';
import { Modal } from './BillingShared';
import './Billing.css';

const LINK_ICONS = { bills: History, catalog: Package, reports: BarChart3, settings: Settings, printer: Printer };

export default function PosPage() {
  const { role } = useAuth();
  const [catalog, setCatalog] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');

  const [cart, setCart] = useState({});
  const [gstEnabled, setGstEnabled] = useState(true);
  const [method, setMethod] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [held, setHeld] = useState(null); // null = closed, array = open
  const [discardTarget, setDiscardTarget] = useState(null);
  const [clearOpen, setClearOpen] = useState(false);

  // One key per distinct cart. Dropped whenever the cart changes, so a retry of the SAME cart
  // (timeout, double click) is deduplicated by the server while an edited cart never gets an
  // older bill back.
  const keyRef = useRef(null);
  const submittingRef = useRef(false);
  const settingsLoaded = useRef(false);

  const load = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([billingApi.catalog(), billingApi.settings()]);
      setCatalog(c);
      setSettings(s);
      setLoadError('');
      if (!settingsLoaded.current) {
        setGstEnabled(s.gstEnabledDefault);
        settingsLoaded.current = true;
      }
    } catch (e) {
      setLoadError(apiErrorMessage(e, 'Failed to load billing catalog'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const byId = useMemo(() => new Map((catalog?.items ?? []).map((i) => [i.id, i])), [catalog]);
  const visible = useMemo(() => filterItems(catalog?.items ?? [], category, search), [catalog, category, search]);
  const lines = useMemo(
    () => Object.entries(cart).flatMap(([id, quantity]) => (byId.has(id) ? [{ item: byId.get(id), quantity }] : [])),
    [cart, byId],
  );
  const totals = previewTotals(lines.map((l) => ({ price: l.item.price, quantity: l.quantity })), settings?.gstPercent ?? 0, gstEnabled);
  const cur = settings?.currencySymbol ?? 'Rs';
  const count = lines.reduce((s, l) => s + l.quantity, 0);
  const payload = () => lines.map((l) => ({ itemId: l.item.id, quantity: l.quantity }));

  const edit = (next) => { keyRef.current = null; setCart(next); };
  // Functional updates: two clicks in one tick must both count.
  const update = (fn) => { keyRef.current = null; setCart(fn); };
  const setQty = (id, q) => update((c) => setCartQty(c, id, q));
  const add = (item) => item.available && update((c) => setCartQty(c, item.id, (c[item.id] ?? 0) + 1));

  const resetCart = () => {
    keyRef.current = null;
    setCart({});
    setMethod(null);
    setGstEnabled(settings?.gstEnabledDefault ?? true);
  };

  const loadLines = (input) => {
    const { cart: next, skipped } = cartFromLines(input, byId);
    edit(next);
    if (skipped) toast(`${skipped} item(s) are no longer available and were left out`);
  };

  const checkout = async () => {
    if (submittingRef.current) return; // a ref, not state: two clicks in one tick must not both pass
    if (lines.length === 0) return toast.error('Add at least one item');
    submittingRef.current = true;
    setSubmitting(true);
    try {
      keyRef.current ??= newIdempotencyKey();
      const bill = await billingApi.createBill({
        idempotencyKey: keyRef.current,
        lines: payload(),
        gstEnabled,
        paymentMethod: method ?? undefined,
      });
      resetCart();
      setReceipt(bill);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not create the bill'));
      load(); // a rejected item usually means the catalog changed
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const hold = async () => {
    if (lines.length === 0) return;
    try {
      await billingApi.hold(payload());
      resetCart();
      toast.success('Bill put on hold');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not hold the bill'));
    }
  };

  const openHeld = async () => {
    try {
      setHeld(await billingApi.listHeld());
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not load held bills'));
    }
  };

  const resume = async (h) => {
    try {
      const data = await billingApi.resumeHeld(h.id);
      loadLines(data.lines);
      setHeld(null);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not resume'));
    }
  };

  const discard = async () => {
    const target = discardTarget;
    setDiscardTarget(null);
    if (!target) return;
    try {
      await billingApi.discardHeld(target.id);
      setHeld((list) => list && list.filter((x) => x.id !== target.id));
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not discard'));
    }
  };

  const repeatLast = async () => {
    try {
      const d = todayIso();
      const page = await billingApi.listBills({ from: d, to: d, status: 'COMPLETED', size: 1 });
      if (page.content.length === 0) return toast('No bill today to repeat');
      const last = await billingApi.getBill(page.content[0].id);
      loadLines(last.lines.flatMap((l) => (l.itemId ? [{ itemId: l.itemId, quantity: l.quantity }] : [])));
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not load the last bill'));
    }
  };

  const print = (bill) => {
    try {
      printReceipt(bill);
    } catch (e) {
      toast.error(e.message || 'Print failed');
    }
  };

  if (loading) return <div className="loading-state">Loading billing...</div>;
  if (loadError) {
    return (
      <div className="bp-wrap">
        <EmptyState icon={Package} title="Billing could not load" message={loadError}
          action={<button type="button" className="btn-primary" onClick={() => { setLoading(true); load(); }}>Try again</button>} />
      </div>
    );
  }

  const isAdmin = role === 'CANTEEN_ADMIN';

  return (
    <div className="bp-wrap">
      <div className="page-header">
        <h1>Billing / POS</h1>
        <p>Counter sales. Payment is recorded manually and is not verified.</p>
      </div>

      <div className="bp-toolbar">
        {billingMenuEntries(role).map((e) => {
          if (e.key === 'held') {
            return <button key={e.key} type="button" className="btn-secondary bp-tool" onClick={openHeld}><Play size={16} /> {e.label}</button>;
          }
          if (e.key === 'repeat') {
            return <button key={e.key} type="button" className="btn-secondary bp-tool" onClick={repeatLast}><RotateCcw size={16} /> {e.label}</button>;
          }
          const Icon = LINK_ICONS[e.key] ?? Package;
          return <Link key={e.key} to={e.to} className="btn-secondary bp-tool"><Icon size={16} /> {e.label}</Link>;
        })}
      </div>

      <div className="bp-split">
        <section className="bp-catalog" aria-label="Items">
          <div className="bp-search">
            <Search size={16} />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items" aria-label="Search items" />
          </div>
          <div className="bp-chips" role="tablist" aria-label="Categories">
            <button type="button" className={`bp-chip ${category === 'ALL' ? 'on' : ''}`} onClick={() => setCategory('ALL')}>All</button>
            {(catalog?.categories ?? []).map((c) => (
              <button key={c.id} type="button" className={`bp-chip ${category === c.id ? 'on' : ''}`} onClick={() => setCategory(c.id)}>{c.name}</button>
            ))}
          </div>
          {visible.length === 0 ? (
            <EmptyState icon={Package} title="No items"
              message={isAdmin ? 'Add items under Menu / Catalog.' : 'Ask an admin to add items to the billing catalog.'} />
          ) : (
            <div className="bp-grid">
              {visible.map((item) => {
                const q = cart[item.id] ?? 0;
                return (
                  <button key={item.id} type="button" disabled={!item.available} onClick={() => add(item)}
                    aria-label={`Add ${item.name}`} className={`bp-tile ${q > 0 ? 'on' : ''}`}>
                    <span className="bp-emoji">{item.emoji || '🍽️'}</span>
                    <span className="bp-tile-name">{item.name}</span>
                    <span className="bp-tile-price">{item.available ? money(cur, item.price) : 'Sold out'}</span>
                    {q > 0 && <span className="bp-badge">{q}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <aside className="bp-cart card" aria-label="Current bill">
          <h2>Current bill {count > 0 && <span className="text-muted">({count})</span>}</h2>
          {lines.length === 0 ? (
            <EmptyState icon={ShoppingBag} title="Cart is empty" message="Click an item to add it." />
          ) : (
            <ul className="bp-lines">
              {lines.map(({ item, quantity }) => (
                <li key={item.id} className="bp-line">
                  <div className="bp-line-info">
                    <span>{item.emoji} {item.name}</span>
                    <small className="text-muted">{money(cur, item.price)} each</small>
                  </div>
                  <QuantityInput small quantity={quantity} onDecrement={() => setQty(item.id, quantity - 1)}
                    onIncrement={() => setQty(item.id, quantity + 1)} onChange={(q) => setQty(item.id, q)} />
                  <button type="button" className="bp-icon-btn" onClick={() => setQty(item.id, 0)} aria-label={`Remove ${item.name}`}>
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="bp-chips">
            <button type="button" aria-pressed={gstEnabled} className={`bp-chip ${gstEnabled ? 'on' : ''}`}
              onClick={() => { keyRef.current = null; setGstEnabled((g) => !g); }}>
              GST {settings?.gstPercent ?? 0}%
            </button>
          </div>
          <p className="bp-hint">Payment (recorded manually, not verified)</p>
          <div className="bp-chips">
            {PAYMENT_METHODS.map((m) => (
              <button key={m} type="button" aria-pressed={method === m} className={`bp-chip ${method === m ? 'on' : ''}`}
                onClick={() => { keyRef.current = null; setMethod(method === m ? null : m); }}>{m}</button>
            ))}
          </div>

          <dl className="bp-totals">
            <div><dt>Subtotal</dt><dd>{money(cur, totals.subtotal)}</dd></div>
            {gstEnabled && <div><dt>GST {settings?.gstPercent ?? 0}%</dt><dd>{money(cur, totals.gst)}</dd></div>}
            <div className="bp-total"><dt>Total</dt><dd>{money(cur, totals.total)}</dd></div>
          </dl>

          <button type="button" className="btn-primary bp-generate" onClick={checkout} disabled={lines.length === 0 || submitting}>
            {submitting ? 'Generating...' : `Generate bill · ${money(cur, totals.total)}`}
          </button>
          <div className="bp-actions">
            <button type="button" className="btn-secondary" onClick={hold} disabled={lines.length === 0}><Pause size={16} /> Hold</button>
            <button type="button" className="btn-secondary" onClick={() => setClearOpen(true)} disabled={lines.length === 0}>Clear</button>
          </div>
        </aside>
      </div>

      {receipt && (
        <Modal title="Bill generated" onClose={() => setReceipt(null)}
          actions={(
            <>
              <button type="button" className="btn-secondary" onClick={() => setReceipt(null)}>New bill</button>
              <button type="button" className="btn-primary" onClick={() => print(receipt)}><Printer size={16} /> Print receipt</button>
            </>
          )}>
          <h3>{receipt.invoiceNumber}</h3>
          <dl className="bp-totals">
            {receipt.lines.map((l, i) => (
              <div key={i}><dt>{l.itemName} x{l.quantity}</dt><dd>{money(receipt.currencySymbol, l.lineTotal)}</dd></div>
            ))}
            {receipt.gstAmount > 0 && <div><dt>GST {receipt.gstPercent}%</dt><dd>{money(receipt.currencySymbol, receipt.gstAmount)}</dd></div>}
            <div className="bp-total"><dt>Total</dt><dd>{money(receipt.currencySymbol, receipt.total)}</dd></div>
          </dl>
        </Modal>
      )}

      {held && (
        <Modal title="Held bills" onClose={() => setHeld(null)}>
          {held.length === 0 ? <p>No held bills.</p> : held.map((h) => (
            <div key={h.id} className="bp-held">
              <div>
                <strong>{h.lines.reduce((s, l) => s + l.quantity, 0)} items · {new Date(h.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</strong>
                <small className="text-muted">{h.lines.map((l) => `${byId.get(l.itemId)?.name ?? 'Removed item'} x${l.quantity}`).join(', ')}</small>
              </div>
              <div className="bp-actions">
                <button type="button" className="btn-primary" onClick={() => resume(h)}>Resume</button>
                <button type="button" className="btn-danger" onClick={() => setDiscardTarget(h)}>Discard</button>
              </div>
            </div>
          ))}
        </Modal>
      )}

      <ConfirmDialog open={!!discardTarget} title="Discard held bill?" message="This held bill will be deleted."
        confirmLabel="Discard" onConfirm={discard} onCancel={() => setDiscardTarget(null)} />
      <ConfirmDialog open={clearOpen} title="Clear cart?" message="All items in the current bill will be removed."
        confirmLabel="Clear" onConfirm={() => { resetCart(); setClearOpen(false); }} onCancel={() => setClearOpen(false)} />
    </div>
  );
}
