import React, { useEffect, useRef, useState } from 'react';
import { getTodayMenu, getFixedMenu, getDefaultOrderingDate } from '../api/menu';
import { listWards } from '../api/wards';
import { placeOrder } from '../api/orders';
import { getWallet } from '../api/wallet';
import { getConfig } from '../api/config';
import { apiErrorCode, apiErrorMessage } from '../api/client';
import { cancelPayment, mockCompletePayment, verifyPayment } from '../api/payments';
import { openRazorpayCheckout } from '../utils/razorpay';
import { useAuth } from '../context/AuthContext';
import { classLabel, formatDate } from '../utils/format';
import { ShoppingCart, AlertCircle, Search, UtensilsCrossed, ChefHat } from 'lucide-react';
import toast from 'react-hot-toast';
import QuantityInput from '../components/QuantityInput';
import EmptyState from '../components/EmptyState';
import './MenuPage.css';

export default function MenuPage() {
  const { user } = useAuth();
  const [dailyMenu, setDailyMenu] = useState([]);
  const [fixedMenu, setFixedMenu] = useState([]);
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState(null);
  const [mockPaymentsEnabled, setMockPaymentsEnabled] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  // Stable for the lifetime of one checkout attempt (including retries after a slow
  // response or a dismissed Razorpay widget) so a resend hits the backend's existing
  // idempotency check (OrderServiceImpl.placeOrderInTransaction) and returns the same
  // order instead of creating a duplicate. Regenerated only once an order actually
  // succeeds (see placeOrderAction), so the next checkout gets its own fresh key.
  const idempotencyKeyRef = useRef(crypto.randomUUID());

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

  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.menuItem.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.menuItem.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { menuItem: item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId) => {
    setCart((prev) =>
      prev
        .map((i) => (i.menuItem.id === itemId ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const getQuantityInCart = (itemId) => {
    const item = cart.find((i) => i.menuItem.id === itemId);
    return item ? item.quantity : 0;
  };

  /** Sets an exact quantity (e.g. from typing into the quantity field) rather than
   *  stepping by one. Clamped to [0, maxQty] when a stock limit applies; 0 removes the
   *  line. */
  const setQuantityInCart = (item, qty, maxQty) => {
    const clamped = Math.max(0, maxQty != null ? Math.min(qty, maxQty) : qty);
    setCart((prev) => {
      if (clamped === 0) return prev.filter((i) => i.menuItem.id !== item.id);
      const existing = prev.find((i) => i.menuItem.id === item.id);
      if (existing) {
        return prev.map((i) => (i.menuItem.id === item.id ? { ...i, quantity: clamped } : i));
      }
      return [...prev, { menuItem: item, quantity: clamped }];
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

  const placeOrderAction = async () => {
    if (cart.length === 0) return toast.error('Your cart is empty');

    if (!validateOrderForm()) {
      toast.error('Please fix the order details marked in red');
      return;
    }

    const cartTotal = getCartTotal();
    // Wallet balance is only ever a hint for which path to take here — the backend
    // re-checks it for real when it actually debits. Insufficient balance means covering
    // the gap through the gateway instead of blocking checkout outright.
    const needsGateway = walletBalance != null && cartTotal > walletBalance;

    try {
      setPlacingOrder(true);
      const orderPayload = {
        menuDate: selectedDate,
        deliveryLocation: user?.role === 'TEACHER' ? deliveryLocation.trim() : undefined,
        items: cart.map((i) => ({ menuItemId: i.menuItem.id, quantity: i.quantity })),
        idempotencyKey: idempotencyKeyRef.current,
        ...(user?.role === 'PARENT' && { beneficiaryWardId: selectedWard }),
        ...(needsGateway && { paymentMode: 'WALLET_PLUS_GATEWAY' }),
      };

      const order = await placeOrder(orderPayload);

      if (order.payment) {
        // Wallet alone didn't cover it — finish the gateway leg PaymentService created.
        try {
          if (mockPaymentsEnabled) {
            toast.loading('Processing payment...', { id: 'order-payment' });
            await mockCompletePayment(order.payment.paymentId);
          } else {
            toast.loading('Opening payment...', { id: 'order-payment' });
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
          toast.success('Order placed and paid successfully!', { id: 'order-payment' });
        } catch (paymentErr) {
          // The order row already exists (PLACED/PENDING) — dismissing the widget, closing
          // it, or a failed verify all land here. Void it now instead of leaving it to sit
          // for up to 15 minutes looking like a real placed order (see PaymentExpirySweeper).
          await cancelPayment(order.payment.paymentId).catch(() => undefined);
          fetchInitialData();
          getWallet().then((w) => setWalletBalance(Number(w.balance))).catch(() => undefined);
          toast.error(
            paymentErr.message === 'Payment was cancelled'
              ? 'Payment cancelled — your order was not placed'
              : apiErrorMessage(paymentErr, 'Payment failed — your order was not placed'),
            { id: 'order-payment' },
          );
          return; // keep the cart intact so the customer can retry
        }
      } else {
        toast.success('Order placed successfully!');
      }

      setCart([]);
      setIsCartOpen(false);
      setErrors({});
      // This checkout is done — the next one (a new cart) must not reuse its key, or the
      // backend's idempotency check would return this same completed order again.
      idempotencyKeyRef.current = crypto.randomUUID();
      fetchInitialData();
      getWallet().then((w) => setWalletBalance(Number(w.balance))).catch(() => undefined);
    } catch (err) {
      if (apiErrorCode(err) === 'ORDERING_CLOSED') {
        // Stale page: cutoff passed for the selected date while it sat open (see
        // OrderingWindowService). The backend already rejected it — recover by pulling the
        // now-current default date rather than leaving the user stuck on a dead one.
        toast.error(apiErrorMessage(err, 'Ordering has closed for the selected date.'),
          { id: 'order-payment', duration: 6000 });
        applyDefaultOrderingDate();
      } else {
        toast.error(apiErrorMessage(err, 'Failed to place order'), { id: 'order-payment' });
      }
    } finally {
      setPlacingOrder(false);
    }
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
      <div className={`food-card ${isSoldOut ? 'sold-out' : ''}`} key={dayItem.id}>
        {isSoldOut && <div className="sold-out-badge">Sold Out</div>}
        <div className="food-img-placeholder">
          {menuItem.imageUrl ? (
            <img src={menuItem.imageUrl} alt={menuItem.name} />
          ) : (
            <div className="img-fallback">{menuItem.name.charAt(0)}</div>
          )}
        </div>
        <div className="food-info">
          <h3>{menuItem.name}</h3>
          <p className="desc">{menuItem.description}</p>
          <div className="food-meta">
            <span className="price">₹{menuItem.price}</span>
            <span className="stock">{remainingQuantity} left</span>
          </div>

          <div className="food-actions">
            {qtyInCart > 0 ? (
              <QuantityInput
                quantity={qtyInCart}
                onDecrement={() => removeFromCart(menuItem.id)}
                onIncrement={() => addToCart(menuItem)}
                onChange={(next) => setQuantityInCart(menuItem, next, remainingQuantity)}
                incrementDisabled={isSoldOut || qtyInCart >= remainingQuantity}
              />
            ) : (
              <button className="btn-add" disabled={isSoldOut} onClick={() => addToCart(menuItem)}>
                Add to Cart
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderFixedCard = (menuItem) => {
    const isSoldOut = !menuItem.available;
    const qtyInCart = getQuantityInCart(menuItem.id);

    return (
      <div className={`food-card ${isSoldOut ? 'sold-out' : ''}`} key={menuItem.id}>
        {isSoldOut && <div className="sold-out-badge">Out of Stock</div>}
        <div className="food-img-placeholder">
          {menuItem.imageUrl ? (
            <img src={menuItem.imageUrl} alt={menuItem.name} />
          ) : (
            <div className="img-fallback">{menuItem.name.charAt(0)}</div>
          )}
        </div>
        <div className="food-info">
          <h3>{menuItem.name}</h3>
          <p className="desc">{menuItem.description}</p>
          <div className="food-meta">
            <span className="price">₹{menuItem.price}</span>
          </div>

          <div className="food-actions">
            {qtyInCart > 0 ? (
              <QuantityInput
                quantity={qtyInCart}
                onDecrement={() => removeFromCart(menuItem.id)}
                onIncrement={() => addToCart(menuItem)}
                onChange={(next) => setQuantityInCart(menuItem, next)}
                incrementDisabled={isSoldOut}
              />
            ) : (
              <button className="btn-add" disabled={isSoldOut} onClick={() => addToCart(menuItem)}>
                Add to Cart
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="menu-container">
      <div className="menu-header">
        <div>
          <h1>Menu</h1>
          <p>Order fresh meals delivered right to your classroom</p>
          {selectedDate && <p className="ordering-for-label">Ordering for {formatDate(selectedDate)}</p>}
        </div>

        <div className="date-picker">
          <input
            type="date"
            value={selectedDate}
            min={minOrderableDate || undefined}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      <div className="menu-search">
        <Search size={18} className="menu-search-icon" />
        <input
          type="text"
          placeholder="Search menu items..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <section className="menu-section">
        <h2 className="menu-section-title">Meal of the Day</h2>
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

      <section className="menu-section">
        <h2 className="menu-section-title">Daily Delights</h2>
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

      {cart.length > 0 && (
        <div className="floating-cart-bar" onClick={() => setIsCartOpen(true)}>
          <div className="cart-summary">
            <div className="cart-icon-wrapper">
              <ShoppingCart size={24} />
              <span className="cart-badge">{cart.reduce((acc, item) => acc + item.quantity, 0)}</span>
            </div>
            <span>View Cart • ₹{getCartTotal().toFixed(2)}</span>
          </div>
        </div>
      )}

      {isCartOpen && (
        <div className="cart-drawer-overlay" onClick={() => setIsCartOpen(false)}>
          <div className="cart-drawer" onClick={(e) => e.stopPropagation()}>
            <h2>Your Order</h2>

            <div className="cart-items">
              {cart.map((item) => (
                <div key={item.menuItem.id} className="cart-item">
                  <div className="cart-item-info">
                    <h4>{item.menuItem.name}</h4>
                    <span>₹{item.menuItem.price} x {item.quantity}</span>
                  </div>
                  <QuantityInput
                    small
                    quantity={item.quantity}
                    onDecrement={() => removeFromCart(item.menuItem.id)}
                    onIncrement={() => addToCart(item.menuItem)}
                    onChange={(next) => setQuantityInCart(item.menuItem, next)}
                  />
                </div>
              ))}
            </div>

            <div className="cart-total">
              <span>Total Amount</span>
              <span>₹{getCartTotal().toFixed(2)}</span>
            </div>

            {walletBalance != null && getCartTotal() > walletBalance && (
              <p className="field-hint">
                <AlertCircle size={14} /> Wallet balance (₹{walletBalance.toFixed(2)}) won't
                cover this order — you'll pay the remaining ₹
                {(getCartTotal() - walletBalance).toFixed(2)} via the payment gateway.
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

            <button className="btn-primary w-100" onClick={placeOrderAction} disabled={placingOrder}>
              {placingOrder ? 'Processing...' : 'Pay & Place Order'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
