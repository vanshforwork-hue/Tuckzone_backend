import React from 'react';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

interface LunchboxProps {
  size?: number;
  withCheck?: boolean;
}

/** Hand-drawn-style lunchbox mascot, used on auth/welcome and order-success screens. */
export function Lunchbox({ size = 120, withCheck = false }: LunchboxProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <Ellipse cx={60} cy={100} rx={34} ry={6} fill="#0B6E4F" opacity={0.12} />
      <Rect x={18} y={46} width={70} height={46} rx={12} fill="#0E8A63" stroke="#054D36" strokeWidth={3} />
      <Rect x={18} y={46} width={70} height={14} rx={7} fill="#0B6E4F" stroke="#054D36" strokeWidth={3} />
      <Path d="M40 46V34a13 13 0 0 1 13-13h0a13 13 0 0 1 13 13v12" stroke="#054D36" strokeWidth={4} strokeLinecap="round" />
      <Circle cx={38} cy={76} r={6} fill="#FDEDC4" stroke="#054D36" strokeWidth={2.5} />
      <Path d="M35.5 76c1 1.2 3.5 1.2 5 0" stroke="#054D36" strokeWidth={2} strokeLinecap="round" />
      <Path d="M60 71a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z" fill="#F0A83C" stroke="#054D36" strokeWidth={2} />
      <Path d="M78 74h6" stroke="#054D36" strokeWidth={2.5} strokeLinecap="round" />
      {withCheck && (
        <>
          <Circle cx={98} cy={74} r={16} fill="#0B6E4F" stroke="#FBF7EE" strokeWidth={4} />
          <Path d="M91 74l4.5 4.5L105 69" stroke="#FBF7EE" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </>
      )}
    </Svg>
  );
}
