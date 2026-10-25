import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FormModal } from '../../components/FormModal';
import { Button } from '../../components/Button';
import { spacing, typography } from '../../theme';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: React.ReactNode;
}

/** Confirmation step for destructive billing actions (Alert.alert is unreliable on web). */
export function ConfirmSheet({ visible, title, message, confirmLabel, loading, onConfirm, onClose, children }: Props) {
  return (
    <FormModal visible={visible} title={title} onClose={onClose}>
      <Text style={typography.body}>{message}</Text>
      {children}
      <View style={styles.row}>
        <Button label="Cancel" variant="secondary" onPress={onClose} style={styles.btn} />
        <Button label={confirmLabel} variant="danger" onPress={onConfirm} loading={loading} style={styles.btn} />
      </View>
    </FormModal>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  btn: { flex: 1 },
});
