import React from 'react';
import { Link } from 'react-router-dom';
import { UtensilsCrossed } from 'lucide-react';
import './LegalPage.css';

export default function AccountDeletionPage() {
  return (
    <div className="legal-page">
      <div className="legal-header">
        <Link to="/login" className="legal-brand">
          <UtensilsCrossed size={20} />
          TuckZone
        </Link>
        <h1>Account Deletion</h1>
        <p className="legal-updated">Last updated: August 14, 2026</p>
      </div>

      <p>
        You can permanently delete your TuckZone account and personal data at any
        time — from the app, or from this website. You do not need the app
        installed to delete your account.
      </p>

      <h2>Option 1: Delete from the website (no app required)</h2>
      <ol>
        <li>
          Go to <Link to="/login">www.tuckzone.in/login</Link> and sign in with
          your TuckZone account.
        </li>
        <li>Open <strong>Profile</strong>.</li>
        <li>
          Scroll down and select <strong>Delete Account</strong>, then confirm.
        </li>
      </ol>

      <h2>Option 2: Delete from the Android app</h2>
      <ol>
        <li>Open the TuckZone app and sign in.</li>
        <li>Go to the <strong>Profile</strong> tab.</li>
        <li>
          Tap <strong>Delete Account</strong>, then confirm.
        </li>
      </ol>

      <h2>What gets deleted</h2>
      <ul>
        <li>Your name, email address, and mobile number</li>
        <li>Your password or sign-in credential</li>
        <li>All active sessions on every device (you're signed out everywhere)</li>
        <li>Your device's push-notification registration</li>
        <li>Any children ("ward") records you added, if you're a parent</li>
      </ul>

      <h2>What's retained, and why</h2>
      <p>
        Your past orders and wallet transaction history are kept, but are
        anonymized and no longer linked to an identifiable account — they cannot
        be used to contact you or identify you afterward. This is standard
        practice for financial and transaction records and is necessary for the
        canteen's accounting and legal-compliance obligations.
      </p>

      <div className="legal-callout">
        <p>
          Deletion takes effect immediately and cannot be undone. If you'd rather
          just stop receiving notifications or step away temporarily, you can sign
          out instead without deleting your account.
        </p>
      </div>

      <h2>Need help?</h2>
      <p>
        If you're unable to sign in to delete your own account, email us at{' '}
        <a href="mailto:tuckzone@outlook.com">tuckzone@outlook.com</a> from the
        email address on your account and we'll process the deletion for you.
      </p>

      <div className="legal-footer-links">
        <Link to="/privacy-policy">Privacy Policy</Link>
        <Link to="/terms">Terms of Service</Link>
        <Link to="/login">Back to TuckZone</Link>
      </div>
    </div>
  );
}
