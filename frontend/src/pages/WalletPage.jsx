import React, { useEffect, useState } from 'react';
import { Wallet, ArrowUpRight, ArrowDownLeft, CreditCard, AlertCircle, ShieldCheck } from 'lucide-react';
import { getTransactions, getWallet, initiateTopup, mockCompleteTopup, verifyTopup } from '../api/wallet';
import { getConfig } from '../api/config';
import { cancelPayment } from '../api/payments';
import { openRazorpayCheckout } from '../utils/razorpay';
import { formatCurrency } from '../utils/format';
import toast from 'react-hot-toast';
import './WalletPage.css';

export default function WalletPage() {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [topupAmount, setTopupAmount] = useState('');
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mockPaymentsEnabled, setMockPaymentsEnabled] = useState(true);
  // Set only in mock mode, between "initiated" and the explicit "Simulate Payment" tap —
  // a real provider never pauses here, it opens the widget immediately instead.
  const [pendingTopup, setPendingTopup] = useState(null);

  useEffect(() => {
    fetchWalletData();
    getConfig().then((c) => setMockPaymentsEnabled(c.mockPaymentsEnabled)).catch(() => undefined);
  }, []);

  const fetchWalletData = async () => {
    try {
      const [walletData, transactionData] = await Promise.all([
        getWallet(),
        getTransactions(),
      ]);
      setWallet(walletData);
      setTransactions(transactionData);
    } catch (err) {
      toast.error('Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  const validateAmount = (value) => {
    const num = parseFloat(value);
    if (!value || isNaN(num)) {
      return 'Enter a valid amount';
    }
    if (num < 1) {
      return 'Top-up amount must be at least ₹1.00';
    }
    if (num > 10000) {
      return 'Top-up amount cannot exceed ₹10,000';
    }
    return null;
  };

  const finishTopup = async (gatewayOrderId, gatewayPaymentId, signature) => {
    await verifyTopup({ gatewayOrderId, gatewayPaymentId, signature });
    toast.success('Wallet recharged successfully', { id: 'payment' });
    setTopupAmount('');
    setPendingTopup(null);
    setError(null);
    fetchWalletData();
  };

  const handleTopup = async (amount) => {
    const value = amount || topupAmount;
    const validationErr = validateAmount(value);
    if (validationErr) {
      setError(validationErr);
      toast.error(validationErr);
      return;
    }
    setError(null);

    try {
      setIsProcessing(true);
      // Backend computes this — platformFee is 0 unless an admin has turned one on for
      // WALLET_RECHARGE; the frontend never calculates it.
      const topup = await initiateTopup({ amount: Number(value).toFixed(2) });

      if (mockPaymentsEnabled) {
        // Explicit step, not silent: a real gateway always requires the user to actually
        // act in a widget, so the dev/mock path shows an equivalent deliberate action
        // instead of completing itself.
        setPendingTopup(topup);
        return;
      }

      toast.loading('Opening payment...', { id: 'payment' });
      let result;
      try {
        result = await openRazorpayCheckout({
          providerOrderId: topup.gatewayOrderId,
          providerKeyId: topup.gatewayKeyId,
          description: 'TuckZone wallet top-up',
        });
      } catch (dismissed) {
        // Dismissing the widget leaves a PENDING payment behind — void it now rather than
        // relying solely on PaymentExpirySweeper's 15-minute sweep.
        await cancelPayment(topup.topupId).catch(() => undefined);
        throw dismissed;
      }
      toast.loading('Confirming payment...', { id: 'payment' });
      try {
        await finishTopup(result.providerOrderId, result.providerPaymentId, result.signature);
      } catch (verifyFailed) {
        await cancelPayment(topup.topupId).catch(() => undefined);
        throw verifyFailed;
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Top-up failed', { id: 'payment' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSimulatePayment = async () => {
    if (!pendingTopup) return;
    try {
      setIsProcessing(true);
      toast.loading('Processing payment...', { id: 'payment' });
      await mockCompleteTopup({ gatewayOrderId: pendingTopup.gatewayOrderId });
      setPendingTopup(null);
      toast.success('Wallet recharged successfully', { id: 'payment' });
      setTopupAmount('');
      fetchWalletData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Top-up failed', { id: 'payment' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="wallet-container">
      <div className="page-header">
        <h1>My Wallet</h1>
        <p>Manage your school canteen funds</p>
      </div>

      {loading ? (
        <div className="loading-state">Loading wallet...</div>
      ) : (
        <div className="wallet-content">
          <div className="balance-card">
            <div className="card-bg-decoration"></div>
            <div className="balance-info">
              <span className="label">Available Balance</span>
              <h2>{formatCurrency(wallet?.balance || 0)}</h2>
            </div>
            <Wallet size={48} className="card-icon" />
          </div>

          {pendingTopup ? (
            <div className="topup-section">
              <h3>Confirm Payment (Test Mode)</h3>
              <div className="pricing-breakdown">
                <div className="pricing-row">
                  <span>Recharge amount</span>
                  <span>{formatCurrency(pendingTopup.amount)}</span>
                </div>
                {Number(pendingTopup.platformFee) > 0 && (
                  <div className="pricing-row">
                    <span>Platform fee</span>
                    <span>{formatCurrency(pendingTopup.platformFee)}</span>
                  </div>
                )}
                <div className="pricing-row pricing-total">
                  <span>You pay</span>
                  <span>{formatCurrency(pendingTopup.grandTotal)}</span>
                </div>
              </div>
              <p className="field-hint">
                <ShieldCheck size={14} /> No real gateway is configured — this simulates a
                successful payment for development.
              </p>
              <div className="topup-actions">
                <button className="btn-pill btn-pill-primary" onClick={handleSimulatePayment} disabled={isProcessing}>
                  Simulate Payment
                </button>
                <button
                  className="btn-pill btn-pill-secondary"
                  onClick={() => setPendingTopup(null)}
                  disabled={isProcessing}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="topup-section">
              <h3>Quick Top-up</h3>
              <div className="quick-amounts">
                {[100, 200, 500, 1000].map((amt) => (
                  <button
                    key={amt}
                    className="btn-quick-amt"
                    onClick={() => handleTopup(amt)}
                    disabled={isProcessing}
                  >
                    +{formatCurrency(amt)}
                  </button>
                ))}
              </div>
              <div className="custom-topup">
                <div className="input-group-col" style={{ flex: 1 }}>
                  <div className="input-with-icon">
                    <span className="currency-symbol">₹</span>
                    <input
                      type="number"
                      placeholder="Enter custom amount"
                      value={topupAmount}
                      onChange={(e) => {
                        setTopupAmount(e.target.value);
                        if (error) setError(null);
                      }}
                      className={error ? 'input-error' : ''}
                    />
                  </div>
                  {error && (
                    <span className="field-error-text">
                      <AlertCircle size={14} /> {error}
                    </span>
                  )}
                </div>
                <button
                  className="btn-pill btn-pill-primary"
                  onClick={() => handleTopup()}
                  disabled={isProcessing || !topupAmount}
                >
                  <CreditCard size={18} /> Add Money
                </button>
              </div>
            </div>
          )}

          <div className="transactions-section">
            <h3>Recent Transactions</h3>
            {transactions.length === 0 ? (
              <div className="empty-state small">No transactions yet</div>
            ) : (
              <div className="transaction-list">
                {transactions.map((tx) => (
                  <div className="transaction-item" key={tx.id}>
                    <div className={`tx-icon ${tx.type.toLowerCase()}`}>
                      {tx.type === 'CREDIT' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                    </div>
                    <div className="tx-details">
                      <span className="tx-desc">{tx.description}</span>
                      <span className="tx-date">{new Date(tx.createdAt).toLocaleString()}</span>
                    </div>
                    <div className={`tx-amount ${tx.type.toLowerCase()}`}>
                      {tx.type === 'CREDIT' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
