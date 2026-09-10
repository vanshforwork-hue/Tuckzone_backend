import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Calendar } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '../theme';

interface DateFieldProps {
  label: string;
  value: string; // yyyy-MM-dd
  onChange: (value: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
}

function toIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Web build of DateField. @react-native-community/datetimepicker has no web
 * implementation — tapping it silently does nothing there (console warns
 * "DateTimePicker is not supported on: web"), which made date-switching invisible in the
 * Expo web preview. Metro resolves this file automatically for web builds instead of
 * DateField.tsx, so native (iOS/Android) behavior is untouched.
 */
export function DateField({ label, value, onChange, minimumDate, maximumDate }: DateFieldProps) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.field}>
        <Calendar size={18} color={colors.primaryDark} />
        <input
          type="date"
          value={value}
          min={minimumDate ? toIso(minimumDate) : undefined}
          max={maximumDate ? toIso(maximumDate) : undefined}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          style={inputStyle}
        />
      </View>
    </View>
  );
}

const inputStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  fontSize: 14,
  fontWeight: 700,
  color: colors.textPrimary,
  fontFamily: 'inherit',
  outline: 'none',
};

const styles = StyleSheet.create({
  label: { ...typography.bodySmall, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.xs },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primarySurface,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-start',
  },
});
