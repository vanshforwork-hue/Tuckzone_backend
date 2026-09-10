import React from 'react';
import { ChevronRight } from 'lucide-react';
import './ProfileMenuItem.css';

const TONES = {
  mint: { bg: 'var(--pastel-mint)', fg: 'var(--pastel-mint-fg)' },
  yellow: { bg: 'var(--pastel-yellow)', fg: 'var(--pastel-yellow-fg)' },
  pink: { bg: 'var(--pastel-pink)', fg: 'var(--pastel-pink-fg)' },
  blue: { bg: 'var(--pastel-blue)', fg: 'var(--pastel-blue-fg)' },
  orange: { bg: 'var(--pastel-orange)', fg: 'var(--pastel-orange-fg)' },
  danger: { bg: 'var(--error-bg)', fg: 'var(--error)' },
};

/** One row in the Profile screen's menu list — pastel icon chip, label, chevron. */
export default function ProfileMenuItem({ icon: Icon, label, tone = 'mint', onClick }) {
  const { bg, fg } = TONES[tone] || TONES.mint;
  return (
    <button type="button" className="tz-profile-menu-item" onClick={onClick}>
      <span className="tz-profile-menu-icon" style={{ background: bg, color: fg }}>
        <Icon size={18} />
      </span>
      <span className="tz-profile-menu-label">{label}</span>
      <ChevronRight size={18} className="tz-profile-menu-chevron" />
    </button>
  );
}
