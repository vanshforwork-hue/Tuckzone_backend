import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface LeavesProps {
  size?: number;
  color?: string;
}

/** A handful of hand-drawn leaf doodles, scattered as decoration behind hero content. */
export function Leaves({ size = 100, color = '#0B6E4F' }: LeavesProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Path d="M20 70c-6-10-4-24 8-30 4 12-1 24-8 30Z" stroke={color} strokeWidth={2.5} fill={color} fillOpacity={0.15} />
      <Path d="M40 82c-5-8-3-19 6-24 3 10-1 19-6 24Z" stroke={color} strokeWidth={2.5} fill={color} fillOpacity={0.15} />
      <Path d="M70 30c8-4 18 0 21 9-9 4-18 0-21-9Z" stroke={color} strokeWidth={2.5} fill={color} fillOpacity={0.15} />
    </Svg>
  );
}
