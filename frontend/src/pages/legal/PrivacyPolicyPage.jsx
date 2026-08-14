import React from 'react';
import { Link } from 'react-router-dom';
import { UtensilsCrossed } from 'lucide-react';
import './LegalPage.css';

export default function PrivacyPolicyPage() {
  return (
    <div className="legal-page">
      <div className="legal-header">
        <Link to="/login" className="legal-brand">
          <UtensilsCrossed size={20} />
          TuckZone
        </Link>
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated: August 14, 2026</p>
      </div>

      <p>
        TuckZone ("we", "us", "our") operates the TuckZone school canteen ordering
        service — the website you're reading this on, and the TuckZone Android app
        (package <code>com.tuckzone.canteen</code>). This policy explains what
        personal data we collect, why, who we share it with, and the choices you
        have, including how to delete your account.
      </p>
      <p>
        If you have any questions, contact us at{' '}
        <a href="mailto:tuckzone@outlook.com">tuckzone@outlook.com</a>.
      </p>

      <div className="legal-callout">
        <p>
          <strong>A note on children's data.</strong> TuckZone is used within
          schools. Students may create their own account, and parents can add
          information about their children ("wards") to place orders on their
          behalf. See <a href="#children">Children's Data</a> below for what that
          means in practice.
        </p>
      </div>

      <h2>1. Information We Collect</h2>

      <h3>Account information (all users)</h3>
      <ul>
        <li>Full name, email address, and mobile number</li>
        <li>
          A password (stored as a one-way cryptographic hash — we never store or
          can see your actual password), or, if you sign in with Firebase
          email/password, a Firebase-managed credential and identifier instead
        </li>
        <li>Your role (Student, Teacher, Parent, or canteen staff) and account status</li>
      </ul>

      <h3>Role-specific information</h3>
      <ul>
        <li><strong>Students:</strong> admission number, class, section, roll number, and optionally a seat number and a parent's mobile number (used to verify a parent-child relationship)</li>
        <li><strong>Teachers:</strong> employee ID and department</li>
        <li><strong>Parents:</strong> for each child you add, that child's name, class, and section</li>
      </ul>

      <h3>Orders and payments</h3>
      <ul>
        <li>Your order history — items, quantities, delivery date/slot, delivery location, and order status</li>
        <li>
          Wallet balance and a full transaction history of top-ups, purchases, and
          refunds
        </li>
        <li>
          Payment metadata for card/UPI/net-banking payments — the amount, currency,
          and a reference ID from our payment processor, Razorpay. We never receive
          or store your card number, UPI ID, or bank details — those go directly to
          Razorpay's own secure checkout.
        </li>
      </ul>

      <h3>Device and notification data</h3>
      <ul>
        <li>
          A push-notification token for your device (used to send you order and
          announcement notifications), linked to your account and removed when you
          sign out
        </li>
      </ul>

      <h3>Information we do <em>not</em> collect</h3>
      <ul>
        <li>We do not collect your device's GPS location</li>
        <li>We do not use analytics or crash-reporting tools that track your behavior across the app</li>
        <li>We do not store payment card or bank account details</li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>To create and secure your account, and let you sign in</li>
        <li>To take, prepare, and deliver your canteen orders</li>
        <li>To operate your wallet — top-ups, spending, and refunds</li>
        <li>To send order updates and canteen announcements via push notification or email</li>
        <li>To let school canteen staff manage the menu, fulfil orders, and produce sales/expense reports</li>
        <li>To detect and prevent fraud or abuse of the ordering and payment system</li>
      </ul>

      <h2>3. Who We Share Data With</h2>
      <table>
        <thead>
          <tr>
            <th>Third party</th>
            <th>What they receive</th>
            <th>Why</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Razorpay</td>
            <td>Payment amount, currency, and a receipt reference — never your card/bank details</td>
            <td>Processing card, UPI, and net-banking payments</td>
          </tr>
          <tr>
            <td>Google Firebase</td>
            <td>Email address and an account identifier, for accounts that use Firebase email sign-in</td>
            <td>Authenticating your sign-in</td>
          </tr>
          <tr>
            <td>Brevo</td>
            <td>Your email address and the content of transactional emails we send you (login codes, verification, notifications)</td>
            <td>Delivering those emails</td>
          </tr>
          <tr>
            <td>Railway</td>
            <td>All account, order, and payment-metadata records described above</td>
            <td>Our hosting provider — this is where our servers and database run, not an independent use of your data</td>
          </tr>
        </tbody>
      </table>
      <p>We do not sell your personal data, and we do not share it with advertisers.</p>

      <h2 id="children">4. Children's Data</h2>
      <p>
        TuckZone is deployed by schools, and a student's own account (name, email,
        mobile number, admission number, class/section, and optionally a parent's
        mobile number) may belong to a minor. Registration for a student account is
        expected to happen with the awareness and involvement of the school and/or
        a parent or guardian.
      </p>
      <p>
        When a parent adds a "ward" to order on a child's behalf, only the child's
        name, class, and section are stored — no separate login, password, or
        contact details are created for that child.
      </p>
      <p>
        If you are a parent or guardian and believe your child's account was
        created without appropriate consent, or you'd like it removed, contact us
        at <a href="mailto:tuckzone@outlook.com">tuckzone@outlook.com</a> or use
        the deletion options described below.
      </p>

      <h2>5. Data Retention and Deletion</h2>
      <p>
        You can delete your account at any time, from within the app (Profile →
        Delete Account) or on the web without needing the app installed — see{' '}
        <Link to="/account-deletion">Account Deletion</Link> for exact steps.
      </p>
      <p>When you delete your account, we immediately:</p>
      <ul>
        <li>Remove your name, email address, mobile number, and password/sign-in credential</li>
        <li>End every active session on every device</li>
        <li>Remove your device's push-notification token</li>
        <li>Delete any children ("ward") records you added as a parent</li>
      </ul>
      <p>
        Your past orders and wallet transaction ledger are retained, but are no
        longer linked to an identifiable account — this is standard practice for
        financial records and is necessary for accounting and legal-compliance
        purposes. They cannot be used to contact you or re-identify you.
      </p>

      <h2>6. Security</h2>
      <p>
        Passwords are stored using industry-standard one-way hashing, never in
        plain text. All traffic between the app and our servers is encrypted
        (HTTPS). Access to administrative functions is restricted by role.
      </p>

      <h2>7. Your Rights</h2>
      <ul>
        <li><strong>Access:</strong> view your stored profile information any time in the app or website under Profile</li>
        <li><strong>Correction:</strong> edit your name and role-specific details directly in Profile</li>
        <li><strong>Deletion:</strong> delete your account and personal data as described in Section 5</li>
        <li>For any other request, contact <a href="mailto:tuckzone@outlook.com">tuckzone@outlook.com</a></li>
      </ul>

      <h2>8. Changes to This Policy</h2>
      <p>
        We may update this policy as the service changes. Material changes will be
        reflected by updating the "Last updated" date above.
      </p>

      <h2>9. Contact Us</h2>
      <p>
        TuckZone — <a href="mailto:tuckzone@outlook.com">tuckzone@outlook.com</a>
      </p>

      <div className="legal-footer-links">
        <Link to="/terms">Terms of Service</Link>
        <Link to="/account-deletion">Account Deletion</Link>
        <Link to="/login">Back to TuckZone</Link>
      </div>
    </div>
  );
}
