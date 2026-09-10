import React from 'react';
import './Avatar.css';

/** Circular avatar used across the customer header/profile — initials on a soft pastel
 *  background when there's no profile photo (the app has no photo upload feature). */
export default function Avatar({ name, size = 44, className = '' }) {
  const initials = (name || '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={`tz-avatar ${className}`.trim()}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  );
}
