import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { LogOut, Pencil, Trash2, X } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useAuth } from '../../context/AuthContext';
import { profileApi } from '../../api/profile';
import { apiErrorMessage } from '../../api/client';
import { validateRequired } from '../../utils/validation';
import { classLabel, initials } from '../../utils/format';
import { colors, radius, spacing, typography } from '../../theme';

export function ProfileScreen() {
  const { user, logout, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [studentClass, setStudentClass] = useState(user?.studentClass ?? '');
  const [section, setSection] = useState(user?.section ?? '');
  const [rollNumber, setRollNumber] = useState(user?.rollNumber ?? '');
  const [seatNumber, setSeatNumber] = useState(user?.seatNumber ?? '');
  const [department, setDepartment] = useState(user?.department ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!user) return null;

  function startEditing() {
    setFullName(user!.fullName);
    setStudentClass(user!.studentClass ?? '');
    setSection(user!.section ?? '');
    setRollNumber(user!.rollNumber ?? '');
    setSeatNumber(user!.seatNumber ?? '');
    setDepartment(user!.department ?? '');
    setErrors({});
    setEditing(true);
  }

  async function handleSave() {
    const nextErrors: Record<string, string> = {};
    const nameError = validateRequired(fullName, 'Full name');
    if (nameError) nextErrors.fullName = nameError;
    if (user!.role === 'STUDENT') {
      if (!studentClass.trim()) nextErrors.studentClass = 'Class is required';
      if (!section.trim()) nextErrors.section = 'Section is required';
      if (!rollNumber.trim()) nextErrors.rollNumber = 'Roll number is required';
    }
    if (user!.role === 'TEACHER' && !department.trim()) nextErrors.department = 'Department is required';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      await profileApi.updateMe({
        fullName,
        studentClass: user!.role === 'STUDENT' ? studentClass : undefined,
        section: user!.role === 'STUDENT' ? section : undefined,
        rollNumber: user!.role === 'STUDENT' ? rollNumber : undefined,
        seatNumber: user!.role === 'STUDENT' ? seatNumber || undefined : undefined,
        department: user!.role === 'TEACHER' ? department : undefined,
      });
      await refreshProfile();
      setEditing(false);
      Toast.show({ type: 'success', text1: 'Profile updated' });
    } catch (error) {
      Toast.show({ type: 'error', text1: apiErrorMessage(error, 'Could not update profile') });
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete your account?',
      "This can't be undone. Your name, email, and mobile number will be permanently removed. Past orders and wallet history are kept, but no longer linked to you.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Account', style: 'destructive', onPress: handleDeleteAccount },
      ],
    );
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await profileApi.deleteMe();
      await logout();
    } catch (error) {
      Toast.show({ type: 'error', text1: apiErrorMessage(error, 'Could not delete account') });
      setDeleting(false);
    }
  }

  return (
    <ScreenContainer edges={['top']}>
      <View style={styles.headerRow}>
        <Text style={typography.h1}>My Profile</Text>
        <Button
          label={editing ? 'Cancel' : 'Edit'}
          variant="ghost"
          fullWidth={false}
          icon={editing ? <X size={16} color={colors.primaryDark} /> : <Pencil size={16} color={colors.primaryDark} />}
          onPress={() => setEditing((prev) => !prev)}
        />
      </View>

      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(user.fullName)}</Text>
        </View>
        <Text style={typography.h2}>{user.fullName}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>{user.role.replace('_', ' ')}</Text>
        </View>
      </View>

      {editing ? (
        <Card>
          <Input label="Full Name" required value={fullName} onChangeText={setFullName} error={errors.fullName} />
          {user.role === 'STUDENT' && (
            <>
              <View style={styles.row}>
                <View style={styles.third}>
                  <Input label="Class" required value={studentClass} onChangeText={setStudentClass} error={errors.studentClass} />
                </View>
                <View style={styles.third}>
                  <Input label="Section" required value={section} onChangeText={setSection} error={errors.section} />
                </View>
                <View style={styles.third}>
                  <Input label="Roll No." required value={rollNumber} onChangeText={setRollNumber} error={errors.rollNumber} />
                </View>
              </View>
              <Input label="Seat No." value={seatNumber} onChangeText={setSeatNumber} />
            </>
          )}
          {user.role === 'TEACHER' && (
            <Input label="Department" required value={department} onChangeText={setDepartment} error={errors.department} />
          )}
          <Button label="Save Changes" onPress={handleSave} loading={saving} style={styles.saveButton} />
        </Card>
      ) : (
        <Card style={{ gap: spacing.sm }}>
          <InfoRow label="Email" value={user.email} />
          <InfoRow label="Mobile" value={user.mobile} />
          {user.role === 'STUDENT' && (
            <>
              <InfoRow label="Admission No." value={user.admissionNumber ?? '—'} />
              <InfoRow label="Class" value={classLabel(user.studentClass, user.section) || '—'} />
              <InfoRow label="Roll No." value={user.rollNumber ?? '—'} />
              <InfoRow label="Seat No." value={user.seatNumber ?? '—'} />
            </>
          )}
          {user.role === 'TEACHER' && (
            <>
              <InfoRow label="Employee ID" value={user.employeeId ?? '—'} />
              <InfoRow label="Department" value={user.department ?? '—'} />
            </>
          )}
        </Card>
      )}

      <Button
        label="Sign Out"
        variant="secondary"
        icon={<LogOut size={18} color={colors.textPrimary} />}
        onPress={handleLogout}
        loading={loggingOut}
        style={styles.logoutButton}
      />

      <Button
        label="Delete Account"
        variant="danger"
        icon={<Trash2 size={18} color={colors.textOnPrimary} />}
        onPress={confirmDeleteAccount}
        loading={deleting}
        style={styles.deleteButton}
      />
    </ScreenContainer>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  avatarSection: { alignItems: 'center', marginVertical: spacing.xl },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: { fontSize: 28, fontWeight: '800', color: colors.primaryDark },
  roleBadge: { backgroundColor: colors.primarySurface, paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.full, marginTop: spacing.xs },
  roleBadgeText: { fontSize: 12, fontWeight: '700', color: colors.primaryDark },
  row: { flexDirection: 'row', gap: spacing.sm },
  third: { flex: 1 },
  saveButton: { marginTop: spacing.sm },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  infoLabel: { ...typography.bodySmall },
  infoValue: { ...typography.bodyMedium },
  logoutButton: { marginTop: spacing.xxl },
  deleteButton: { marginTop: spacing.sm },
});
