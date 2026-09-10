import React, { useEffect, useRef } from 'react';
import { Animated, Easing, ViewStyle } from 'react-native';

interface FadeInUpProps {
  children: React.ReactNode;
  /** Stagger index — each successive card in a grid animates slightly after the last,
   *  which reads as one wave instead of everything popping in at once. */
  index?: number;
  style?: ViewStyle;
}

const STEP_MS = 45;
const MAX_DELAY_MS = 360; // caps the stagger so a long list doesn't take forever to settle

/** Wraps a card/row with a short fade + rise-in on mount. Used for menu grids, order lists,
 *  and anywhere else content pops in after a fetch — purely presentational, re-runs whenever
 *  the wrapped element is remounted (i.e. give list items a stable `key` as usual). */
export function FadeInUp({ children, index = 0, style }: FadeInUpProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 260,
      delay: Math.min(index * STEP_MS, MAX_DELAY_MS),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // Deliberately no deps beyond mount — this is a one-shot entrance animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
