import React, { useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { UtensilsCrossed } from 'lucide-react-native';
import { colors, radius } from '../theme';

interface FoodImageProps {
  uri?: string | null;
  /** Shown inside the placeholder in place of the icon, e.g. the item's initial. Falls
   *  back to a plain fork/knife icon when omitted. */
  label?: string;
  style?: ViewStyle;
  radius?: number;
}

/**
 * The single place every food photo renders through. `<Image>`/`<img>` used to be dropped
 * straight into screens with no fallback at all, so a missing photo (never uploaded) and a
 * broken one (dead legacy URL, network hiccup) both just left a blank/half-drawn box — the
 * "some images don't load" complaint. This always shows *something* appetizing-looking —
 * a soft tinted placeholder, not empty space — and fades the real photo in once it decodes
 * instead of popping in abruptly.
 */
export function FoodImage({ uri, label, style, radius: cornerRadius = radius.md }: FoodImageProps) {
  const [failed, setFailed] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  const showPlaceholder = !uri || failed;

  return (
    <View style={[styles.wrap, { borderRadius: cornerRadius }, style]}>
      {showPlaceholder ? (
        <View style={styles.placeholder}>
          {label ? (
            <Text style={styles.placeholderText}>{label.charAt(0).toUpperCase()}</Text>
          ) : (
            <UtensilsCrossed size={26} color={colors.primaryDark} />
          )}
        </View>
      ) : (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
          <Image
            source={{ uri }}
            style={styles.image}
            onLoad={() => {
              Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
            }}
            onError={() => setFailed(true)}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: colors.primarySurface,
  },
  image: { width: '100%', height: '100%' },
  placeholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySurface,
  },
  placeholderText: { fontSize: 28, fontWeight: '800', color: colors.primaryDark },
});
