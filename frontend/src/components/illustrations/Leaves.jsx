import React from 'react';

/** A handful of hand-drawn leaf doodles, scattered as decoration behind hero content. */
export default function Leaves({ size = 100, color = '#0B6E4F', className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 70c-6-10-4-24 8-30 4 12-1 24-8 30Z" stroke={color} strokeWidth="2.5" fill={color} fillOpacity="0.15" />
      <path d="M40 82c-5-8-3-19 6-24 3 10-1 19-6 24Z" stroke={color} strokeWidth="2.5" fill={color} fillOpacity="0.15" />
      <path d="M70 30c8-4 18 0 21 9-9 4-18 0-21-9Z" stroke={color} strokeWidth="2.5" fill={color} fillOpacity="0.15" />
    </svg>
  );
}
