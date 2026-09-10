import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
} from 'react-native';
import { colors, radius, spacing, typography } from '../theme';

// react-native-web renders TextInput as a real <input>, which gets the browser's default
// black focus ring — this replaces it with the branded border/shadow the wrapper draws
// instead of stacking an ugly rectangle on top of it. `outlineStyle` is a real, supported
// react-native-web style property; RN's own TextStyle type just hasn't caught up to it,
// hence the cast. No-op on native (there's no such CSS concept there).
const noWebOutline = { outlineStyle: 'none' } as unknown as TextStyle;

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  required?: boolean;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

/**
 * A labelled text field with a consistent error state. Required fields get a visible
 * asterisk — every registration/edit form uses this so the "required" convention is
 * identical across the whole app, not just on some screens.
 */
export function Input({
  label,
  error,
  required,
  leftIcon,
  rightElement,
  style,
  onFocus,
  onBlur,
  ...textInputProps
}: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.asterisk}> *</Text>}
      </Text>
      <View
        style={[
          styles.inputRow,
          focused && !error && styles.inputRowFocused,
          error && styles.inputRowError,
        ]}
      >
        {leftIcon}
        <TextInput
          style={[styles.input, noWebOutline, leftIcon ? { marginLeft: spacing.sm } : null, style]}
          placeholderTextColor={colors.textTertiary}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...textInputProps}
        />
        {rightElement}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.lg },
  label: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '600', marginBottom: spacing.xs },
  asterisk: { color: colors.danger },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  inputRowFocused: {
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  inputRowError: { borderColor: colors.danger },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
    fontWeight: '600',
  },
});
