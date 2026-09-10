import React from 'react';

/** Hand-drawn-style lunchbox mascot, used on auth/welcome and order-success screens. */
export default function Lunchbox({ size = 120, withCheck = false, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Lunchbox illustration"
    >
      <ellipse cx="60" cy="100" rx="34" ry="6" fill="#0B6E4F" opacity="0.12" />
      <rect x="18" y="46" width="70" height="46" rx="12" fill="#0E8A63" stroke="#054D36" strokeWidth="3" />
      <rect x="18" y="46" width="70" height="14" rx="7" fill="#0B6E4F" stroke="#054D36" strokeWidth="3" />
      <path d="M40 46V34a13 13 0 0 1 13-13h0a13 13 0 0 1 13 13v12" stroke="#054D36" strokeWidth="4" strokeLinecap="round" />
      <circle cx="38" cy="76" r="6" fill="#FDEDC4" stroke="#054D36" strokeWidth="2.5" />
      <path d="M35.5 76c1 1.2 3.5 1.2 5 0" stroke="#054D36" strokeWidth="2" strokeLinecap="round" />
      <path d="M60 71a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z" fill="#F0A83C" stroke="#054D36" strokeWidth="2" />
      <path d="M78 74h6" stroke="#054D36" strokeWidth="2.5" strokeLinecap="round" />
      {withCheck && (
        <g transform="translate(84,60)">
          <circle cx="14" cy="14" r="16" fill="#0B6E4F" stroke="#FBF7EE" strokeWidth="4" />
          <path d="M7 14l4.5 4.5L21 9" stroke="#FBF7EE" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
      )}
    </svg>
  );
}
