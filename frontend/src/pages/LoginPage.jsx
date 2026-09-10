import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Mail,
  Lock,
  LogIn,
  Loader2,
  AlertCircle,
  ChefHat,
  ShoppingBag,
  Clock,
  ShieldCheck,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import PasswordInput from '../components/PasswordInput';
import toast from 'react-hot-toast';
import {
  signInWithFirebaseEmail,
  createFirebaseEmailAccount,
  sendFirebasePasswordReset,
  firebaseAuthErrorMessage,
} from '../auth/firebase/emailAuth';
import { isFirebaseConfigured } from '../auth/firebase/config';
import Lunchbox from '../components/illustrations/Lunchbox';
import WaterBottle from '../components/illustrations/WaterBottle';
import Leaves from '../components/illustrations/Leaves';
import './LoginPage.css';

/** Used only until the first "send code" response tells us the server's real policy. */
const DEFAULT_RESEND_COOLDOWN_SECONDS = 30;

export default function LoginPage() {
  const [mode, setMode]         = useState('password'); // 'password' | 'otp'
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors]     = useState({});
  const [loading, setLoading]   = useState(false);
  const navigate = useNavigate();
  const { login, requestOtp, loginWithOtp, loginWithFirebase } = useAuth();

  // ── OTP mode state ──
  const [otpEmail, setOtpEmail]       = useState('');
  const [otpCode, setOtpCode]         = useState('');
  const [otpStage, setOtpStage]       = useState('request'); // 'request' | 'verify'
  const [sendingOtp, setSendingOtp]   = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [cooldown, setCooldown]       = useState(0);
  const cooldownRef = useRef(null);

  // ── Firebase email mode state ──
  const [fbEmail, setFbEmail]       = useState('');
  const [fbPassword, setFbPassword] = useState('');
  const [fbBusy, setFbBusy]         = useState(null); // null | 'signin' | 'create' | 'reset'

  useEffect(() => () => clearInterval(cooldownRef.current), []);

  const startCooldown = (seconds) => {
    clearInterval(cooldownRef.current);
    setCooldown(seconds);
    cooldownRef.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) {
          clearInterval(cooldownRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const validate = () => {
    const errs = {};
    if (!email.trim()) {
      errs.email = 'Email address is required';
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      errs.email = 'Enter a valid email address';
    }
    if (!password) {
      errs.password = 'Password is required';
    } else if (password.length < 8) {
      errs.password = 'Password must be at least 8 characters';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const routeForRole = (role) => {
    if (role === 'CANTEEN_ADMIN') return '/admin/dashboard';
    if (role === 'SUB_ADMIN') return '/subadmin/orders';
    if (role === 'SCHOOL_ADMIN') return '/admin/users';
    return '/menu';
  };

  const handleLoginSubmit = async (loginEmail, loginPassword) => {
    try {
      setLoading(true);
      const res = await login(loginEmail, loginPassword);
      toast.success(`Welcome back, ${res.user.fullName?.split(' ')[0]}!`);
      navigate(routeForRole(res.user.role));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    handleLoginSubmit(email, password);
  };

  const validateOtpEmail = () => {
    if (!otpEmail.trim()) {
      setErrors((e) => ({ ...e, otpEmail: 'Email address is required' }));
      return false;
    }
    if (!/^\S+@\S+\.\S+$/.test(otpEmail)) {
      setErrors((e) => ({ ...e, otpEmail: 'Enter a valid email address' }));
      return false;
    }
    setErrors((e) => ({ ...e, otpEmail: null }));
    return true;
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!validateOtpEmail()) return;
    try {
      setSendingOtp(true);
      const res = await requestOtp(otpEmail.trim(), 'LOGIN');
      setOtpStage('verify');
      startCooldown(res.resendAfterSeconds ?? DEFAULT_RESEND_COOLDOWN_SECONDS);
      toast.success('Check your inbox for the 6-digit code.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not send the code. Try again.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      setResendingOtp(true);
      const res = await requestOtp(otpEmail.trim(), 'LOGIN');
      startCooldown(res.resendAfterSeconds ?? DEFAULT_RESEND_COOLDOWN_SECONDS);
      toast.success('A new code is on its way.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not resend the code.');
    } finally {
      setResendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length < 4) {
      setErrors((err) => ({ ...err, otpCode: 'Enter the code from your email' }));
      return;
    }
    try {
      setVerifyingOtp(true);
      const res = await loginWithOtp(otpEmail.trim(), otpCode.trim());
      toast.success(`Welcome back, ${res.user.fullName?.split(' ')[0]}!`);
      navigate(routeForRole(res.user.role));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Incorrect or expired code');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setErrors({});
  };

  /** Shared by sign-in and create-account: exchange the Firebase ID token for our own
   *  session, and if this identity has no linked account yet, hand off to Register with
   *  the token instead of failing outright — covers "create account" for a brand-new
   *  email, and also the edge case where sign-in succeeds against Firebase but the
   *  account here was somehow never linked. */
  const completeFirebaseEmailAuth = async (idToken) => {
    try {
      const res = await loginWithFirebase(idToken);
      toast.success(`Welcome back, ${res.user.fullName?.split(' ')[0]}!`);
      navigate(routeForRole(res.user.role));
    } catch (exchangeError) {
      if (exchangeError.response?.data?.code === 'FIREBASE_USER_NOT_REGISTERED') {
        toast('Almost there — let\'s finish setting up your account.');
        navigate('/register', { state: { firebaseIdToken: idToken, email: fbEmail.trim(), emailLocked: true } });
      } else {
        throw exchangeError;
      }
    }
  };

  const validateFbFields = () => {
    const errs = {};
    if (!fbEmail.trim() || !/^\S+@\S+\.\S+$/.test(fbEmail)) errs.fbEmail = 'Enter a valid email address';
    if (!fbPassword || fbPassword.length < 6) errs.fbPassword = 'Password must be at least 6 characters';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFirebaseSignIn = async () => {
    if (!validateFbFields()) return;
    try {
      setFbBusy('signin');
      const idToken = await signInWithFirebaseEmail(fbEmail.trim(), fbPassword);
      await completeFirebaseEmailAuth(idToken);
    } catch (error) {
      toast.error(firebaseAuthErrorMessage(error));
    } finally {
      setFbBusy(null);
    }
  };

  const handleFirebaseCreateAccount = async () => {
    if (!validateFbFields()) return;
    try {
      setFbBusy('create');
      const idToken = await createFirebaseEmailAccount(fbEmail.trim(), fbPassword);
      toast.success('Verification email sent — check your inbox.');
      await completeFirebaseEmailAuth(idToken);
    } catch (error) {
      toast.error(firebaseAuthErrorMessage(error));
    } finally {
      setFbBusy(null);
    }
  };

  const handleFirebasePasswordReset = async () => {
    if (!fbEmail.trim() || !/^\S+@\S+\.\S+$/.test(fbEmail)) {
      setErrors((e) => ({ ...e, fbEmail: 'Enter your email address first' }));
      return;
    }
    try {
      setFbBusy('reset');
      await sendFirebasePasswordReset(fbEmail.trim());
      toast.success('Password reset email sent — check your inbox.');
    } catch (error) {
      toast.error(firebaseAuthErrorMessage(error));
    } finally {
      setFbBusy(null);
    }
  };

  return (
    <div className="login-container">
      {/* Left Branding Panel */}
      <div className="login-left">
        <Leaves className="login-leaves login-leaves-1" size={90} color="#ffffff" />
        <Leaves className="login-leaves login-leaves-2" size={70} color="#ffffff" />

        <div className="login-left-brand">
          <ChefHat size={28} />
          <span className="login-left-wordmark">
            Tuck<em>zone</em>
          </span>
        </div>
        <p className="login-left-tagline">School Canteen &bull; Made Easy</p>

        <h2>
          Good Food
          <br />
          Fuels Great
          <br />
          Days
        </h2>

        <div className="login-left-illustration">
          <Lunchbox size={130} />
          <WaterBottle size={70} />
        </div>

        <div className="login-left-features">
          {[
            { icon: ShoppingBag, text: 'Order food from the canteen' },
            { icon: Clock,       text: 'Track delivery in real-time' },
            { icon: ChefHat,     text: 'Fresh menu every day' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="login-left-feature">
              <span className="login-left-feature-icon">
                <Icon size={16} />
              </span>
              {text}
            </div>
          ))}
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="login-right">
        <div className="login-card-wrapper">
          <div className="login-header">
            <div className="brand-logo">
              <ChefHat size={28} className="text-amber" />
            </div>
            <h1>Sign In</h1>
            <p>
              {mode === 'password'
                ? 'Enter your credentials to access TuckZone'
                : "We'll email you a one-time code — no password needed"}
            </p>
          </div>

          <div className="login-mode-toggle" role="tablist" aria-label="Sign-in method">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'password'}
              className={mode === 'password' ? 'active' : ''}
              onClick={() => switchMode('password')}
            >
              <Lock size={14} /> Password
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'otp'}
              className={mode === 'otp' ? 'active' : ''}
              onClick={() => switchMode('otp')}
            >
              <KeyRound size={14} /> Email OTP
            </button>
            {isFirebaseConfigured && (
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'fbEmail'}
                className={mode === 'fbEmail' ? 'active' : ''}
                onClick={() => switchMode('fbEmail')}
              >
                <Mail size={14} /> Email
              </button>
            )}
          </div>

          {mode === 'password' ? (
            <form className="login-form" onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label htmlFor="login-email">Email Address</label>
                <div className="input-with-icon">
                  <Mail className="input-icon" size={18} />
                  <input
                    id="login-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors({ ...errors, email: null });
                    }}
                    className={errors.email ? 'input-error' : ''}
                    autoComplete="email"
                  />
                </div>
                {errors.email && (
                  <span className="field-error-text">
                    <AlertCircle size={13} /> {errors.email}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="login-password">Password</label>
                <PasswordInput
                  id="login-password"
                  icon={Lock}
                  iconSize={18}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors({ ...errors, password: null });
                  }}
                  className={errors.password ? 'input-error' : ''}
                  autoComplete="current-password"
                />
                {errors.password && (
                  <span className="field-error-text">
                    <AlertCircle size={13} /> {errors.password}
                  </span>
                )}
                <Link to="/forgot-password" className="link-amber forgot-password-link">
                  Forgot password?
                </Link>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-pill btn-pill-primary" disabled={loading}>
                  {loading ? <Loader2 className="spinner" size={18} /> : <LogIn size={18} />}
                  <span>{loading ? 'Signing in...' : 'Sign In'}</span>
                </button>
              </div>
            </form>
          ) : mode === 'otp' ? (
            otpStage === 'request' ? (
            <form className="login-form" onSubmit={handleSendOtp} noValidate>
              <div className="form-group">
                <label htmlFor="otp-email">Email Address</label>
                <div className="input-with-icon">
                  <Mail className="input-icon" size={18} />
                  <input
                    id="otp-email"
                    type="email"
                    placeholder="you@example.com"
                    value={otpEmail}
                    onChange={(e) => {
                      setOtpEmail(e.target.value);
                      if (errors.otpEmail) setErrors({ ...errors, otpEmail: null });
                    }}
                    className={errors.otpEmail ? 'input-error' : ''}
                    autoComplete="email"
                  />
                </div>
                {errors.otpEmail && (
                  <span className="field-error-text">
                    <AlertCircle size={13} /> {errors.otpEmail}
                  </span>
                )}
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-pill btn-pill-primary" disabled={sendingOtp}>
                  {sendingOtp ? <Loader2 className="spinner" size={18} /> : <ShieldCheck size={18} />}
                  <span>{sendingOtp ? 'Sending code...' : 'Send code'}</span>
                </button>
              </div>
            </form>
          ) : (
            <form className="login-form" onSubmit={handleVerifyOtp} noValidate>
              <p className="otp-sent-to">
                Code sent to <strong>{otpEmail}</strong>
              </p>

              <div className="form-group">
                <label htmlFor="otp-code">Verification Code</label>
                <div className="input-with-icon">
                  <ShieldCheck className="input-icon" size={18} />
                  <input
                    id="otp-code"
                    type="text"
                    inputMode="numeric"
                    placeholder="6-digit code"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => {
                      setOtpCode(e.target.value.replace(/\D/g, ''));
                      if (errors.otpCode) setErrors({ ...errors, otpCode: null });
                    }}
                    className={errors.otpCode ? 'input-error' : ''}
                    autoComplete="one-time-code"
                    autoFocus
                  />
                </div>
                {errors.otpCode && (
                  <span className="field-error-text">
                    <AlertCircle size={13} /> {errors.otpCode}
                  </span>
                )}
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-pill btn-pill-primary" disabled={verifyingOtp}>
                  {verifyingOtp ? <Loader2 className="spinner" size={18} /> : <LogIn size={18} />}
                  <span>{verifyingOtp ? 'Verifying...' : 'Verify & Sign In'}</span>
                </button>
              </div>

              <button
                type="button"
                className={`btn-resend ${cooldown > 0 ? 'btn-resend-counting' : ''}`}
                onClick={handleResendOtp}
                disabled={cooldown > 0 || resendingOtp}
              >
                {cooldown > 0 && <Clock size={14} />}
                {resendingOtp
                  ? 'Resending...'
                  : cooldown > 0
                    ? `Resend code in ${cooldown}s`
                    : 'Resend code'}
              </button>

              <button
                type="button"
                className="btn-otp-back"
                onClick={() => {
                  setOtpStage('request');
                  setOtpCode('');
                  clearInterval(cooldownRef.current);
                  setCooldown(0);
                }}
              >
                Use a different email
              </button>
            </form>
            )
          ) : (
            <div className="login-form">
              <div className="form-group">
                <label htmlFor="fb-email">Email Address</label>
                <div className="input-with-icon">
                  <Mail className="input-icon" size={18} />
                  <input
                    id="fb-email"
                    type="email"
                    placeholder="you@example.com"
                    value={fbEmail}
                    onChange={(e) => {
                      setFbEmail(e.target.value);
                      if (errors.fbEmail) setErrors({ ...errors, fbEmail: null });
                    }}
                    className={errors.fbEmail ? 'input-error' : ''}
                    autoComplete="email"
                  />
                </div>
                {errors.fbEmail && (
                  <span className="field-error-text">
                    <AlertCircle size={13} /> {errors.fbEmail}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="fb-password">Password</label>
                <PasswordInput
                  id="fb-password"
                  icon={Lock}
                  iconSize={18}
                  placeholder="••••••••"
                  value={fbPassword}
                  onChange={(e) => {
                    setFbPassword(e.target.value);
                    if (errors.fbPassword) setErrors({ ...errors, fbPassword: null });
                  }}
                  className={errors.fbPassword ? 'input-error' : ''}
                  autoComplete="current-password"
                />
                {errors.fbPassword && (
                  <span className="field-error-text">
                    <AlertCircle size={13} /> {errors.fbPassword}
                  </span>
                )}
              </div>

              <div className="form-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-pill btn-pill-primary"
                  disabled={fbBusy !== null}
                  onClick={handleFirebaseSignIn}
                >
                  {fbBusy === 'signin' ? <Loader2 className="spinner" size={18} /> : <LogIn size={18} />}
                  <span>Sign In</span>
                </button>
                <button
                  type="button"
                  className="btn-pill btn-pill-secondary"
                  disabled={fbBusy !== null}
                  onClick={handleFirebaseCreateAccount}
                >
                  {fbBusy === 'create' ? <Loader2 className="spinner" size={18} /> : <ShieldCheck size={18} />}
                  <span>Create Account</span>
                </button>
              </div>

              <button
                type="button"
                className="btn-resend"
                onClick={handleFirebasePasswordReset}
                disabled={fbBusy !== null}
              >
                {fbBusy === 'reset' ? 'Sending...' : 'Forgot password?'}
              </button>
            </div>
          )}

          <div className="login-footer">
            <p>
              Don&apos;t have an account?{' '}
              <Link to="/register" className="link-amber">Register here</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
