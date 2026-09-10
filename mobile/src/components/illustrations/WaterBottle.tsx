import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

interface WaterBottleProps {
  size?: number;
}

/** Playful water-bottle doodle used alongside the Lunchbox mascot on auth screens. */
export function WaterBottle({ size = 80 }: WaterBottleProps) {
  return (
    <Svg width={size} height={size * 1.4} viewBox="0 0 60 84" fill="none">
      <Rect x={22} y={4} width={16} height={10} rx={3} fill="#1D5F96" stroke="#0B3A5C" strokeWidth={2.5} />
      <Path
        d="M18 18c0-2.2 1.8-4 4-4h16c2.2 0 4 1.8 4 4v6c3.3 2.6 5 6 5 11v37c0 4.4-3.6 8-8 8H21c-4.4 0-8-3.6-8-8V35c0-5 1.7-8.4 5-11v-6Z"
        fill="#DBEAFC"
        stroke="#0B3A5C"
        strokeWidth={2.5}
      />
      <Path d="M13 46h34" stroke="#0B3A5C" strokeWidth={2} opacity={0.4} />
    </Svg>
  );
}
