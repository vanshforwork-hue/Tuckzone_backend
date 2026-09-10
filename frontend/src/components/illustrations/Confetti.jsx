import React from 'react';

const PIECES = [
  { x: 8, y: 10, r: 20, color: '#F0A83C', shape: 'dash' },
  { x: 92, y: 14, r: -25, color: '#1D5F96', shape: 'dot' },
  { x: 14, y: 78, r: 0, color: '#A13A58', shape: 'heart' },
  { x: 88, y: 82, r: 15, color: '#0B6E4F', shape: 'dash' },
  { x: 50, y: 4, r: 0, color: '#F0A83C', shape: 'dot' },
  { x: 6, y: 45, r: -10, color: '#0B6E4F', shape: 'circle' },
  { x: 94, y: 48, r: 20, color: '#A85116', shape: 'dash' },
  { x: 28, y: 92, r: 0, color: '#1D5F96', shape: 'dot' },
  { x: 72, y: 6, r: -15, color: '#A13A58', shape: 'dash' },
];

function Piece({ x, y, r, color, shape }) {
  const style = {
    position: 'absolute',
    left: `${x}%`,
    top: `${y}%`,
    transform: `rotate(${r}deg)`,
  };
  if (shape === 'dash') {
    return <span style={{ ...style, width: 14, height: 4, borderRadius: 2, background: color }} />;
  }
  if (shape === 'dot') {
    return <span style={{ ...style, width: 8, height: 8, borderRadius: '50%', background: color }} />;
  }
  if (shape === 'circle') {
    return (
      <span
        style={{ ...style, width: 12, height: 12, borderRadius: '50%', border: `2.5px solid ${color}` }}
      />
    );
  }
  // heart
  return (
    <svg style={style} width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 20s-7.5-4.7-10-9.3C.4 7.4 2.3 4 6 4c2.1 0 3.7 1.1 4.5 2.6 1.7-2.6 4.6-3.4 6.9-1.9 2.4 1.5 3 4.7 1.4 7.6C16.3 15.6 12 20 12 20Z"
        fill={color}
      />
    </svg>
  );
}

/** Scattered confetti/doodle overlay for celebratory moments (order success, hero banners).
 *  Absolutely positioned — wrap in a `position: relative` container. */
export default function Confetti({ className }) {
  return (
    <div className={className} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden="true">
      {PIECES.map((p, i) => (
        <Piece key={i} {...p} />
      ))}
    </div>
  );
}
