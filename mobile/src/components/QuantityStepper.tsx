import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, TextStyle, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';

// See Input.tsx — suppresses react-native-web's default black focus ring; no-op on native.
const noWebOutline = { outlineStyle: 'none' } as unknown as TextStyle;

interface QuantityStepperProps {
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  /** Manual numeric entry, e.g. typing "20" instead of tapping "+" nineteen times. Commits
   *  on blur/submit; the caller is responsible for clamping (stock limits, min 0). */
  onChangeQuantity: (quantity: number) => void;
  incrementDisabled?: boolean;
  compact?: boolean;
}

/** The +/- control used in the menu grid and the cart, with a numeric field in the middle
 *  for typing a quantity directly instead of tapping repeatedly. Same size and spacing in
 *  both places so the cart doesn't feel like a different app from the menu it came from. */
export function QuantityStepper({
  quantity,
  onIncrement,
  onDecrement,
  onChangeQuantity,
  incrementDisabled,
  compact,
}: QuantityStepperProps) {
  const size = compact ? 28 : 32;

  // Buffered locally so a mid-edit state (e.g. briefly empty while retyping) doesn't get
  // clobbered by the `quantity` prop on every keystroke — only committed values flow back.
  const [text, setText] = useState(String(quantity));
  const bump = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    setText(String(quantity));
    bump.setValue(0.85);
    Animated.spring(bump, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantity]);

  function commit() {
    const parsed = parseInt(text, 10);
    if (text.trim() === '' || Number.isNaN(parsed)) {
      setText(String(quantity));
      return;
    }
    if (parsed !== quantity) onChangeQuantity(parsed);
    else setText(String(quantity));
  }

  return (
    <View style={[styles.container, { height: size }]}>
      <Pressable onPress={onDecrement} style={[styles.button, { width: size }]} hitSlop={8}>
        <Minus size={16} color={colors.primaryDark} />
      </Pressable>
      <Animated.View style={{ transform: [{ scale: bump }] }}>
        <TextInput
          style={[styles.quantity, noWebOutline]}
          value={text}
          // Digits only — blocks decimals, minus signs, and any other non-numeric input at
          // the source rather than validating after the fact.
          onChangeText={(next) => setText(next.replace(/[^0-9]/g, ''))}
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType="number-pad"
          selectTextOnFocus
          maxLength={4}
        />
      </Animated.View>
      <Pressable
        onPress={onIncrement}
        disabled={incrementDisabled}
        style={[styles.button, { width: size }, incrementDisabled && styles.buttonDisabled]}
        hitSlop={8}
      >
        <Plus size={16} color={incrementDisabled ? colors.textTertiary : colors.primaryDark} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySurface,
    borderRadius: radius.full,
    paddingHorizontal: 2,
  },
  button: { alignItems: 'center', justifyContent: 'center', height: '100%' },
  buttonDisabled: { opacity: 0.4 },
  quantity: {
    // A real width, not just minWidth: react-native-web renders this as a bare <input>,
    // which the browser sizes to its own wide default (~20 characters) when nothing
    // constrains it — minWidth alone doesn't stop that, only an explicit width does.
    width: 30,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginHorizontal: spacing.xs,
    padding: 0,
  },
});
