import React from 'react';
import { Link } from 'react-router-dom';
import { UtensilsCrossed } from 'lucide-react';
import './LegalPage.css';

export default function TermsPage() {
  return (
    <div className="legal-page">
      <div className="legal-header">
        <Link to="/login" className="legal-brand">
          <UtensilsCrossed size={20} />
          TuckZone
        </Link>
        <h1>Terms of Service</h1>
        <p className="legal-updated">Last updated: August 14, 2026</p>
      </div>

      <p>
        These terms govern your use of TuckZone (the website and the Android app,
        package <code>com.tuckzone.canteen</code>). By creating an account or
        placing an order, you agree to them. If you're a student under 18, a
        parent, guardian, or your school should be aware of and support your use
        of TuckZone.
      </p>

      <h2>1. Who Can Use TuckZone</h2>
      <p>
        TuckZone is intended for students, teachers, parents, and canteen staff of
        schools that use the service. Accounts are role-based (Student, Teacher,
        Parent, or canteen admin/staff), and some features are only available to
        specific roles.
      </p>

      <h2>2. Your Account</h2>
      <ul>
        <li>You're responsible for keeping your password confidential and for all activity under your account.</li>
        <li>Tell us immediately at <a href="mailto:tuckzone@outlook.com">tuckzone@outlook.com</a> if you suspect unauthorized access.</li>
        <li>You must provide accurate registration information — student class/section and admission details are used to route your order correctly.</li>
        <li>We may disable an account we reasonably believe is fraudulent, abusive, or in violation of these terms.</li>
      </ul>

      <h2>3. Orders, Wallet, and Payment</h2>
      <ul>
        <li>Menu availability, pricing, and ordering windows (cutoff times) are set by each school's canteen and may change without notice.</li>
        <li>You can pay from your in-app wallet balance, or top up the shortfall via card/UPI/net-banking through Razorpay, our payment processor.</li>
        <li>Orders may be cancelled or rejected by canteen staff (for example, if an item runs out) — in that case any amount charged is refunded to your wallet or original payment method.</li>
        <li>A payment that is started but not completed (for example, the payment screen is closed before finishing) is automatically cancelled and any wallet amount already deducted is restored, generally within 15 minutes.</li>
        <li>Wallet balances are not redeemable for cash and are only usable within TuckZone.</li>
      </ul>

      <h2>4. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use another person's account or impersonate someone else</li>
        <li>Attempt to interfere with, disrupt, or gain unauthorized access to TuckZone's systems</li>
        <li>Use the service for any purpose other than ordering canteen food and managing your own account</li>
        <li>Attempt to circumvent payment, wallet, or ordering-window rules</li>
      </ul>

      <h2>5. Canteen Staff and School Responsibilities</h2>
      <p>
        Canteen admin and sub-admin accounts are provisioned by the school and are
        responsible for menu accuracy, pricing, order fulfilment, and any
        expense/report data they enter. TuckZone provides the ordering platform;
        food quality, allergen information, and fulfilment are the responsibility
        of the school's canteen.
      </p>

      <h2>6. Disclaimers</h2>
      <p>
        TuckZone is provided "as is." We do not guarantee the service will be
        uninterrupted or error-free. We are not responsible for food quality,
        allergens, or delivery delays caused by the school's canteen operations,
        nor for issues arising from Razorpay's payment processing that are outside
        our control.
      </p>

      <h2>7. Limitation of Liability</h2>
      <p>
        To the extent permitted by law, TuckZone's liability for any claim
        relating to the service is limited to the amount you paid through the
        service in the 3 months before the claim arose.
      </p>

      <h2>8. Termination</h2>
      <p>
        You may stop using TuckZone and delete your account at any time — see{' '}
        <Link to="/account-deletion">Account Deletion</Link>. We may suspend or
        terminate accounts that violate these terms.
      </p>

      <h2>9. Governing Law</h2>
      <p>These terms are governed by the laws of India.</p>

      <h2>10. Changes to These Terms</h2>
      <p>
        We may update these terms as the service changes. Continued use after an
        update means you accept the revised terms.
      </p>

      <h2>11. Contact Us</h2>
      <p>
        TuckZone — <a href="mailto:tuckzone@outlook.com">tuckzone@outlook.com</a>
      </p>

      <div className="legal-footer-links">
        <Link to="/privacy-policy">Privacy Policy</Link>
        <Link to="/account-deletion">Account Deletion</Link>
        <Link to="/login">Back to TuckZone</Link>
      </div>
    </div>
  );
}
