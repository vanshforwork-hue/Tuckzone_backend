import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTodayMenu, getFixedMenu, getDefaultOrderingDate } from '../api/menu';
import { listWards } from '../api/wards';
import { placeOrder } from '../api/orders';
import { getWallet } from '../api/wallet';
import { getConfig } from '../api/config';
import { apiErrorCode, apiErrorMessage } from '../api/client';
import { cancelPayment, mockCompletePayment, verifyPayment } from '../api/payments';
import { openRazorpayCheckout } from '../utils/razorpay';
import { useAuth } from '../context/AuthContext';
import { classLabel, formatDate, formatCurrency, addDaysIso } from '../utils/format';
import { ShoppingCart, AlertCircle, Search, UtensilsCrossed, ChefHat, Trash2, Sun, X } from 'lucide-react';
import toast from 'react-hot-toast';
import QuantityInput from '../components/QuantityInput';
import EmptyState from '../components/EmptyState';
import SectionHeader from '../components/SectionHeader';
import CategoryTabs from '../components/CategoryTabs';
import FoodCard from '../components/FoodCard';
import PrimaryButton from '../components/PrimaryButton';
import Lunchbox from '../components/illustrations/Lunchbox';
import Confetti from '../components/illustrations/Confetti';
import './MenuPage.css';

function firstName(name) {
  if (!name) return '';
  return name.trim().split(/\s+/)[0];
}

const CATEGORY_TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'DAILY', label: 'Meal of the Day' },
  { key: 'FIXED', label: 'Daily Delights' },
];

export default function MenuPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dailyMenu, setDailyMenu] = useState([]);
  const [fixedMenu, setFixedMenu] = useState([]);
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState(null);
  const [mockPaymentsEnabled, setMockPaymentsEnabled] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);

  // Empty until resolveDefaultOrderingDate() answers — never defaults to today locally.
  // Same-day ordering is never valid (the business only takes orders for tomorrow onward),
  // so there is no safe local guess to show before the backend is heard from.
  const [selectedDate, setSelectedDate] = useState('');
  const [minOrderableDate, setMinOrderableDate] = useState('');
  const [search, setSearch] = useState('');

  const applyDefaultOrderingDate = () =>
    getDefaultOrderingDate()
      .then((d) => {
        setSelectedDate(d.menuDate);
        setMinOrderableDate(d.menuDate);
      })
      .catch(() => undefined);

  // Cart & Order Form State
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedWard, setSelectedWard] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [errors, setErrors] = useState({});
  const [category, setCategory] = useState('ALL');
  // Set to the just-placed order's API response on success; the cart drawer swaps to a
  // celebratory confirmation panel showing this real data instead of closing outright.
  const [placedOrder, setPlacedOrder] = useState(null);

  useEffect(() => {
    // Runs once on mount (also effectively "on login", since this page only renders once
    // authenticated) — resolves fresh every time rather than trusting anything cached, so a
    // different user logging in right after sees their own correct default, not a stale one.
    applyDefaultOrderingDate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedDate) return; // still waiting on the default-date resolution above
    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  useEffect(() => {
    getWallet().then((w) => setWalletBalance(Number(w.balance))).catch(() => undefined);
    getConfig().then((c) => setMockPaymentsEnabled(c.mockPaymentsEnabled)).catch(() => undefined);
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [dailyData, fixedData] = await Promise.all([
        getTodayMenu({ date: selectedDate }),
        getFixedMenu(),
      ]);
      setDailyMenu(dailyData);
      setFixedMenu(fixedData);

      if (user?.role === 'PARENT') {
        const wardData = await listWards();
        setWards(wardData);
      }
    } catch (err) {
      toast.error('Failed to load menu');
    } finally {
      setLoading(false);
    }
  };

  // Each line is tagged with the date it was added for, so the cart can hold baskets for
  // several different days at once — "Add to cart" always writes into selectedDate's
  // basket, and every lookup below is scoped to it the same way.
  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.menuItem.id === item.id && i.date === selectedDate);
      if (existing) {
        return prev.map((i) =>
          i.menuItem.id === item.id && i.date === selectedDate ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { date: selectedDate, menuItem: item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId) => {
    setCart((prev) =>
      prev
        .map((i) => (i.menuItem.id === itemId && i.date === selectedDate ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const getQuantityInCart = (itemId) => {
    const item = cart.find((i) => i.menuItem.id === itemId && i.date === selectedDate);
    return item ? item.quantity : 0;
  };

  /** Sets an exact quantity (e.g. from typing into the quantity field) rather than
   *  stepping by one. Clamped to [0, maxQty] when a stock limit applies; 0 removes the
   *  line. */
  const setQuantityInCart = (item, qty, maxQty) => {
    const clamped = Math.max(0, maxQty != null ? Math.min(qty, maxQty) : qty);
    setCart((prev) => {
      if (clamped === 0) return prev.filter((i) => !(i.menuItem.id === item.id && i.date === selectedDate));
      const existing = prev.find((i) => i.menuItem.id === item.id && i.date === selectedDate);
      if (existing) {
        return prev.map((i) => (i.menuItem.id === item.id && i.date === selectedDate ? { ...i, quantity: clamped } : i));
      }
      return [...prev, { date: selectedDate, menuItem: item, quantity: clamped }];
    });
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + item.menuItem.price * item.quantity, 0);
  };

  const validateOrderForm = () => {
    const errs = {};

    if (user?.role === 'PARENT') {
      if (!selectedWard) {
        errs.child = 'Please select a ward for this order';
      }
    } else if (user?.role === 'TEACHER') {
      if (!deliveryLocation.trim()) {
        errs.location = 'Delivery location is required';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /** Places one date's basket as one order, finishing the payment-gateway leg if the
   *  wallet alone doesn't cover it. Throws on any failure (ordering closed, payment
   *  cancelled/failed, other API error) — the caller decides how to react per date. */
  const placeOneDateOrder = async (date, items) => {
    const dateTotal = items.reduce((total, i) => total + i.menuItem.price * i.quantity, 0);
    // Fresh balance per date: an earlier date in the same checkout may have just debited
    // the wallet, so the last-fetched walletBalance state could already be stale.
    const freshBalance = await getWallet().then((w) => Number(w.balance)).catch(() => walletBalance);
    const needsGateway = freshBalance != null && dateTotal > freshBalance;

    const orderPayload = {
      menuDate: date,
      deliveryLocation: user?.role === 'TEACHER' ? deliveryLocation.trim() : undefined,
      items: items.map((i) => ({ menuItemId: i.menuItem.id, quantity: i.quantity })),
      // Fresh per date — reusing one key across dates would make the backend's idempotency
      // check (OrderServiceImpl.placeOrderInTransaction) return the first date's order again.
      idempotencyKey: crypto.randomUUID(),
      ...(user?.role === 'PARENT' && { beneficiaryWardId: selectedWard }),
      ...(needsGateway && { paymentMode: 'WALLET_PLUS_GATEWAY' }),
    };

    const order = await placeOrder(orderPayload);

    if (order.payment) {
      // Wallet alone didn't cover it — finish the gateway leg PaymentService created.
      try {
        if (mockPaymentsEnabled) {
          toast.loading(`Processing payment for ${formatDate(date)}...`, { id: 'order-payment' });
          await mockCompletePayment(order.payment.paymentId);
        } else {
          toast.loading(`Opening payment for ${formatDate(date)}...`, { id: 'order-payment' });
          const result = await openRazorpayCheckout({
            providerOrderId: order.payment.providerOrderId,
            providerKeyId: order.payment.providerKeyId,
            description: `TuckZone order ${order.orderNumber}`,
          });
          toast.loading('Confirming payment...', { id: 'order-payment' });
          await verifyPayment(order.payment.paymentId, {
            providerOrderId: result.providerOrderId,
            providerPaymentId: result.providerPaymentId,
            signature: result.signature,
          });
        }
      } catch (paymentErr) {
        // The order row already exists (PLACED/PENDING) — dismissing the widget, closing
        // it, or a failed verify all land here. Void it now instead of leaving it to sit
        // for up to 15 minutes looking like a real placed order (see PaymentExpirySweeper).
        await cancelPayment(order.payment.paymentId).catch(() => undefined);
        throw paymentErr;
      }
    }

    return order;
  };

  const placeOrderAction = async () => {
    if (cart.length === 0) return toast.error('Your cart is empty');

    if (!validateOrderForm()) {
      toast.error('Please fix the order details marked in red');
      return;
    }

    const dates = [...new Set(cart.map((i) => i.date))].sort();
    setPlacingOrder(true);
    const results = [];

    // Sequential, not parallel: each date's wallet check needs to see the balance left
    // over after the previous date's order, not a stale snapshot from before the loop.
    for (const date of dates) {
      const items = cart.filter((i) => i.date === date);
      try {
        const order = await placeOneDateOrder(date, items);
        results.push({ date, order });
        setCart((prev) => prev.filter((i) => i.date !== date));
      } catch (err) {
        results.push({ date, error: err });
        if (apiErrorCode(err) === 'ORDERING_CLOSED') {
          // Stale page: cutoff passed for this date while it sat open (see
          // OrderingWindowService). Keep going — the other dates aren't affected.
          applyDefaultOrderingDate();
        }
      }
    }

    setPlacingOrder(false);
    setErrors({});
    fetchInitialData();
    getWallet().then((w) => setWalletBalance(Number(w.balance))).catch(() => undefined);

    const succeeded = results.filter((r) => r.order);
    const failed = results.filter((r) => r.error);

    if (succeeded.length === 1 && failed.length === 0) {
      // Common case, unchanged: one date, one order, the existing celebratory panel.
      toast.dismiss('order-payment');
      setPlacedOrder(succeeded[0].order);
      return;
    }

    if (succeeded.length > 0) {
      toast.success(`${succeeded.length} of ${results.length} days' orders placed!`, { id: 'order-payment' });
    }
    if (failed.length > 0) {
      const firstError = failed[0].error;
      const reason = firstError.message === 'Payment was cancelled'
        ? 'payment cancelled'
        : apiErrorMessage(firstError, 'failed');
      toast.error(
        `${failed.length} day${failed.length === 1 ? '' : 's'} could not be ordered (${reason}) — items kept in cart for retry`,
        { duration: 6000 },
      );
    }
    if (succeeded.length === 0) return; // nothing placed — stay on the cart to let them retry
    closeCartDrawer();
    navigate('/orders');
  };

  const closeCartDrawer = () => {
    setIsCartOpen(false);
    setPlacedOrder(null);
  };

  const matchesSearch = (name) =>
    !search.trim() || name.toLowerCase().includes(search.trim().toLowerCase());

  const filteredDaily = dailyMenu.filter((dayItem) => matchesSearch(dayItem.menuItem.name));
  const filteredFixed = fixedMenu.filter((item) => matchesSearch(item.name));

  const renderDailyCard = (dayItem) => {
    const { menuItem, remainingQuantity, available } = dayItem;
    const isSoldOut = !available || remainingQuantity <= 0;
    const qtyInCart = getQuantityInCart(menuItem.id);

    return (
      <FoodCard
        key={dayItem.id}
        name={menuItem.name}
        description={menuItem.description}
        imageUrl={menuItem.imageUrl}
        price={menuItem.price}
        stockLabel={`${remainingQuantity} left`}
        soldOut={isSoldOut}
        soldOutLabel="Sold Out"
        quantity={qtyInCart}
        incrementDisabled={isSoldOut || qtyInCart >= remainingQuantity}
        onAdd={() => addToCart(menuItem)}
        onIncrement={() => addToCart(menuItem)}
        onDecrement={() => removeFromCart(menuItem.id)}
        onChangeQuantity={(next) => setQuantityInCart(menuItem, next, remainingQuantity)}
      />
    );
  };

  const renderFixedCard = (menuItem) => {
    const isSoldOut = !menuItem.available;
    const qtyInCart = getQuantityInCart(menuItem.id);

    return (
      <FoodCard
        key={menuItem.id}
        name={menuItem.name}
        description={menuItem.description}
        imageUrl={menuItem.imageUrl}
        price={menuItem.price}
        soldOut={isSoldOut}
        soldOutLabel="Out of Stock"
        quantity={qtyInCart}
        incrementDisabled={isSoldOut}
        onAdd={() => addToCart(menuItem)}
        onIncrement={() => addToCart(menuItem)}
        onDecrement={() => removeFromCart(menuItem.id)}
        onChangeQuantity={(next) => setQuantityInCart(menuItem, next)}
      />
    );
  };

  const showDaily = category !== 'FIXED';
  const showFixed = category !== 'DAILY';
  const cartItemCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  // Baskets for dates other than the one currently being browsed, so they stay visible
  // (and editable via a quick date switch) instead of disappearing when selectedDate changes.
  const otherDayBaskets = Object.entries(
    cart
      .filter((i) => i.date !== selectedDate)
      .reduce((acc, i) => {
        acc[i.date] = (acc[i.date] || 0) + i.quantity;
        return acc;
      }, {})
  )
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="menu-container">
      <div className="menu-hero">
        <div className="menu-hero-greeting">
          <Sun size={22} className="menu-hero-sun" />
          <div>
            <h1>Good day, {firstName(user?.fullName) || 'there'}!</h1>
            <p>What would you like to have today?</p>
          </div>
        </div>
        {selectedDate && <p className="ordering-for-label">Ordering for {formatDate(selectedDate)}</p>}
      </div>

      <div className="menu-header">
        <div className="menu-search">
          <Search size={18} className="menu-search-icon" />
          <input
            type="text"
            placeholder="Search menu items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="date-picker">
          <input
            type="date"
            value={selectedDate}
            min={minOrderableDate || undefined}
            max={minOrderableDate ? addDaysIso(minOrderableDate, 6) : undefined}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      <CategoryTabs tabs={CATEGORY_TABS} active={category} onChange={setCategory} />

      {showDaily && (
        <section className="menu-section">
          <SectionHeader title="Meal of the Day" />
          {loading ? (
            <div className="loading-state">Loading menu...</div>
          ) : filteredDaily.length === 0 ? (
            <EmptyState
              icon={UtensilsCrossed}
              title="No Meal of the Day Yet"
              message={`Nothing is published for ${selectedDate}. Ask the canteen admin to schedule that day's items.`}
            />
          ) : (
            <div className="menu-grid">
              {filteredDaily.map(renderDailyCard)}
            </div>
          )}
        </section>
      )}

      {showFixed && (
        <section className="menu-section">
          <SectionHeader title="Daily Delights" />
          {loading ? (
            <div className="loading-state">Loading menu...</div>
          ) : filteredFixed.length === 0 ? (
            <EmptyState
              icon={ChefHat}
              title="No Daily Delights Right Now"
              message="Check back soon — the canteen updates this list regularly."
            />
          ) : (
            <div className="menu-grid">
              {filteredFixed.map(renderFixedCard)}
            </div>
          )}
        </section>
      )}

      {cart.length > 0 && (
        <div className="floating-cart-bar" onClick={() => setIsCartOpen(true)}>
          <div className="cart-summary">
            <div className="cart-icon-wrapper">
              <ShoppingCart size={22} />
              <span className="cart-badge">{cartItemCount}</span>
            </div>
            <span>View Cart &bull; {formatCurrency(getCartTotal())}</span>
          </div>
        </div>
      )}

      {isCartOpen && (
        <div className="cart-drawer-overlay" onClick={closeCartDrawer}>
          <div className="cart-drawer" onClick={(e) => e.stopPropagation()}>
            {placedOrder ? (
              <div className="order-success-panel">
                <div className="order-success-art">
                  <Confetti />
                  <Lunchbox size={110} withCheck />
                </div>
                <h2>Order Placed!</h2>
                <p>Your food is being prepared and will be ready for recess.</p>

                <div className="order-success-info">
                  <div>
                    <span className="order-success-label">Order ID</span>
                    <span className="order-success-value">#{placedOrder.orderNumber}</span>
                  </div>
                  <div className="order-success-divider" />
                  <div>
                    <span className="order-success-label">Recess / Slot</span>
                    <span className="order-success-value">{placedOrder.slotName || 'Recess'}</span>
                  </div>
                </div>

                <PrimaryButton onClick={() => { closeCartDrawer(); navigate('/orders'); }}>
                  View My Orders
                </PrimaryButton>
                <button type="button" className="order-success-close" onClick={closeCartDrawer}>
                  Back to Menu
                </button>
              </div>
            ) : (
              <>
                <div className="cart-drawer-header">
                  <h2>My Cart &bull; {formatDate(selectedDate)}</h2>
                  {cart.some((i) => i.date === selectedDate) && (
                    <button
                      type="button"
                      className="cart-clear-btn"
                      onClick={() => setCart((prev) => prev.filter((i) => i.date !== selectedDate))}
                    >
                      <Trash2 size={14} /> Clear Day
                    </button>
                  )}
                  <button type="button" className="cart-close-btn" onClick={closeCartDrawer} aria-label="Close cart">
                    <X size={18} />
                  </button>
                </div>

                {otherDayBaskets.length > 0 && (
                  <div className="cart-other-days">
                    <span className="cart-other-days-label">Other days:</span>
                    {otherDayBaskets.map(({ date, count }) => (
                      <span key={date} className="cart-other-day-chip">
                        <button type="button" onClick={() => setSelectedDate(date)}>
                          {formatDate(date)} &middot; {count} item{count === 1 ? '' : 's'}
                        </button>
                        <button
                          type="button"
                          aria-label={`Clear ${formatDate(date)}`}
                          onClick={() => setCart((prev) => prev.filter((i) => i.date !== date))}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {cart.every((i) => i.date !== selectedDate) && (
                  <p className="cart-empty-day-hint">
                    No items added for {formatDate(selectedDate)} yet — browse the menu above and add some.
                  </p>
                )}

                <div className="cart-items">
                  {cart.filter((i) => i.date === selectedDate).map((item) => (
                    <div key={item.menuItem.id} className="cart-item">
                      <div className="cart-item-thumb">
                        {item.menuItem.imageUrl ? (
                          <img src={item.menuItem.imageUrl} alt={item.menuItem.name} />
                        ) : (
                          <div className="cart-item-thumb-fallback">{item.menuItem.name.charAt(0)}</div>
                        )}
                      </div>
                      <div className="cart-item-info">
                        <h4>{item.menuItem.name}</h4>
                        <span>{formatCurrency(item.menuItem.price)}</span>
                      </div>
                      <QuantityInput
                        small
                        quantity={item.quantity}
                        onDecrement={() => removeFromCart(item.menuItem.id)}
                        onIncrement={() => addToCart(item.menuItem)}
                        onChange={(next) => setQuantityInCart(item.menuItem, next)}
                      />
                      <button
                        type="button"
                        className="cart-item-delete"
                        onClick={() => setQuantityInCart(item.menuItem, 0)}
                        aria-label={`Remove ${item.menuItem.name}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="cart-total">
                  <span>Total Amount</span>
                  <span>{formatCurrency(getCartTotal())}</span>
                </div>

                {walletBalance != null && getCartTotal() > walletBalance && (
                  <p className="field-hint">
                    <AlertCircle size={14} /> Wallet balance ({formatCurrency(walletBalance)}) won't
                    cover this order — you'll pay the remaining{' '}
                    {formatCurrency(getCartTotal() - walletBalance)} via the payment gateway.
                  </p>
                )}

                <div className="order-details-form">
                  <div className="form-group">
                    <label>Recess</label>
                    <p className="recess-note">Your order will be ready for Recess.</p>
                  </div>

                  {user?.role === 'PARENT' ? (
                    <div className="form-group">
                      <label>Order for Ward</label>
                      <select
                        value={selectedWard}
                        onChange={(e) => {
                          setSelectedWard(e.target.value);
                          if (errors.child) setErrors({ ...errors, child: null });
                        }}
                        className={errors.child ? 'input-error' : ''}
                      >
                        <option value="">Select ward...</option>
                        {wards.map((ward) => (
                          <option key={ward.id} value={ward.id}>
                            {ward.name} ({ward.studentClass}-{ward.section})
                          </option>
                        ))}
                      </select>
                      {errors.child && (
                        <span className="field-error-text">
                          <AlertCircle size={14} /> {errors.child}
                        </span>
                      )}
                    </div>
                  ) : user?.role === 'STUDENT' ? (
                    <div className="form-row">
                      <div className="form-group">
                        <label>Student Name</label>
                        <input type="text" value={user.fullName} disabled />
                      </div>
                      <div className="form-group">
                        <label>Class</label>
                        <input type="text" value={classLabel(user.studentClass, user.section)} disabled />
                      </div>
                    </div>
                  ) : (
                    <div className="form-group">
                      <label>Delivery Location</label>
                      <input
                        type="text"
                        value={deliveryLocation}
                        onChange={(e) => {
                          setDeliveryLocation(e.target.value);
                          if (errors.location) setErrors({ ...errors, location: null });
                        }}
                        placeholder="e.g. Staff Room / Science Dept"
                        className={errors.location ? 'input-error' : ''}
                      />
                      {errors.location && (
                        <span className="field-error-text">
                          <AlertCircle size={14} /> {errors.location}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <PrimaryButton onClick={placeOrderAction} disabled={placingOrder}>
                  {placingOrder ? 'Processing...' : 'Pay & Place Order'}
                </PrimaryButton>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
