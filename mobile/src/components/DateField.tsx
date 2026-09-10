import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
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
 * Native date picker used to select the day for advance orders. Android shows its own
 * modal dialog and reports a single 'set' event; iOS keeps the picker visible inline until
 * the user taps away, which is why the two platforms are wired slightly differently below.
 */
export function DateField({ label, value, onChange, minimumDate, maximumDate }: DateFieldProps) {
  const [showPicker, setShowPicker] = useState(false);
  const dateValue = value ? new Date(`${value}T00:00:00`) : new Date();

  function handleChange(_event: unknown, selected?: Date) {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (selected) {
      onChange(toIso(selected));
    }
  }

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.field} onPress={() => setShowPicker(true)}>
        <Calendar size={18} color={colors.primaryDark} />
        <Text style={styles.value}>
          {dateValue.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
        </Text>
      </Pressable>
      {showPicker && (
        <DateTimePicker
          value={dateValue}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={handleChange}
        />
      )}
    </View>
  );
}

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
  value: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
});
