import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

type Shape = 'dash' | 'dot' | 'circle' | 'heart';

interface Piece {
  x: `${number}%`;
  y: `${number}%`;
  rotate: string;
  color: string;
  shape: Shape;
}

const PIECES: Piece[] = [
  { x: '8%', y: '10%', rotate: '20deg', color: '#F0A83C', shape: 'dash' },
  { x: '88%', y: '14%', rotate: '-25deg', color: '#1D5F96', shape: 'dot' },
  { x: '12%', y: '78%', rotate: '0deg', color: '#A13A58', shape: 'heart' },
  { x: '84%', y: '82%', rotate: '15deg', color: '#0B6E4F', shape: 'dash' },
  { x: '46%', y: '4%', rotate: '0deg', color: '#F0A83C', shape: 'dot' },
  { x: '4%', y: '45%', rotate: '-10deg', color: '#0B6E4F', shape: 'circle' },
  { x: '90%', y: '48%', rotate: '20deg', color: '#A85116', shape: 'dash' },
  { x: '26%', y: '90%', rotate: '0deg', color: '#1D5F96', shape: 'dot' },
  { x: '68%', y: '6%', rotate: '-15deg', color: '#A13A58', shape: 'dash' },
];

function PieceView({ x, y, rotate, color, shape }: Piece) {
  const base = { position: 'absolute' as const, left: x, top: y, transform: [{ rotate }] };
  if (shape === 'dash') {
    return <View style={[base, { width: 14, height: 4, borderRadius: 2, backgroundColor: color }]} />;
  }
  if (shape === 'dot') {
    return <View style={[base, { width: 8, height: 8, borderRadius: 4, backgroundColor: color }]} />;
  }
  if (shape === 'circle') {
    return (
      <View style={[base, { width: 12, height: 12, borderRadius: 6, borderWidth: 2.5, borderColor: color }]} />
    );
  }
  return (
    <View style={base}>
      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 20s-7.5-4.7-10-9.3C.4 7.4 2.3 4 6 4c2.1 0 3.7 1.1 4.5 2.6 1.7-2.6 4.6-3.4 6.9-1.9 2.4 1.5 3 4.7 1.4 7.6C16.3 15.6 12 20 12 20Z"
          fill={color}
        />
      </Svg>
    </View>
  );
}

/** Scattered confetti/doodle overlay for celebratory moments. Renders absolutely inside
 *  whatever parent View hosts it (parent must not clip overflow). */
export function Confetti() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {PIECES.map((p, i) => (
        <PieceView key={i} {...p} />
      ))}
    </View>
  );
}
