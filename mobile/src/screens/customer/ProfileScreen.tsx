import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  Bell,
  CalendarClock,
  ChevronRight,
  LogOut,
  Sparkles,
  Sun,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import Toast from 'react-native-toast-message';
import { ScreenContainer } from '../../components/ScreenContainer';
import { WaveFooter } from '../../components/WaveFooter';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useAuth } from '../../context/AuthContext';
import { profileApi } from '../../api/profile';
import { apiErrorMessage } from '../../api/client';
import { validateRequired } from '../../utils/validation';
import { initials } from '../../utils/format';
import { colors, spacing } from '../../theme';
import type { CustomerStackParamList } from '../../navigation/types';

type ProfileNav = NativeStackNavigationProp<CustomerStackParamList>;

export function ProfileScreen() {
  const navigation = useNavigation<ProfileNav>();
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
    <ScreenContainer edges={['top']} scroll={false} contentStyle={{ padding: 0, backgroundColor: '#0A6344' }}>
      {/* Top Header Bar matching My Profile design */}
      <View style={styles.topHeader}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={24} color="#FFFFFF" strokeWidth={2.4} />
        </Pressable>
        <Text style={styles.headerTitle}>My Profile</Text>
      </View>

      <ScrollView
        style={styles.mainContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* User Info Header Card */}
        <View style={styles.userHeaderCard}>
          <View style={styles.userInfoRow}>
            <View style={styles.avatarWrap}>
              <Text style={styles.avatarInitials}>{initials(user.fullName)}</Text>
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{user.fullName}</Text>
              <Text style={styles.userSubtext}>
                {user.studentClass
                  ? `Class ${user.studentClass}${user.section ? ` - ${user.section}` : ''}`
                  : user.role.replace('_', ' ')}
              </Text>
            </View>
            <Pressable
              style={styles.editPill}
              onPress={editing ? () => setEditing(false) : startEditing}
            >
              <Text style={styles.editPillText}>{editing ? 'Cancel' : 'Edit'}</Text>
            </Pressable>
          </View>
        </View>

        {editing && (
          <Card style={{ marginTop: spacing.md }}>
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
        )}

        {/* Profile Navigation Links */}
        <View style={styles.navigationList}>
          <Pressable
            style={styles.navRow}
            onPress={() => navigation.navigate('CustomerTabs', { screen: 'Orders' })}
          >
            <View style={[styles.navIconWell, { backgroundColor: '#E0F2FE' }]}>
              <CalendarClock size={20} color="#0284C7" strokeWidth={2} />
            </View>
            <Text style={styles.navText}>My Orders</Text>
            <ChevronRight size={18} color="#94A3B8" strokeWidth={2} />
          </Pressable>

          <Pressable
            style={styles.navRow}
            onPress={() => navigation.navigate('CustomerTabs', { screen: 'Wallet' })}
          >
            <View style={[styles.navIconWell, { backgroundColor: '#F3E8FF' }]}>
              <Wallet size={20} color="#9333EA" strokeWidth={2} />
            </View>
            <Text style={styles.navText}>Wallet</Text>
            <ChevronRight size={18} color="#94A3B8" strokeWidth={2} />
          </Pressable>

          <Pressable
            style={styles.navRow}
            onPress={() => navigation.navigate('Notifications')}
          >
            <View style={[styles.navIconWell, { backgroundColor: '#FEF3C7' }]}>
              <Bell size={20} color="#D97706" strokeWidth={2} />
            </View>
            <Text style={styles.navText}>Notifications</Text>
            <ChevronRight size={18} color="#94A3B8" strokeWidth={2} />
          </Pressable>

          {user.role === 'PARENT' && (
            <Pressable
              style={styles.navRow}
              onPress={() => navigation.navigate('CustomerTabs', { screen: 'Children' })}
            >
              <View style={[styles.navIconWell, { backgroundColor: '#CCFBF1' }]}>
                <Users size={20} color="#0D9488" strokeWidth={2} />
              </View>
              <Text style={styles.navText}>My Wards</Text>
              <ChevronRight size={18} color="#94A3B8" strokeWidth={2} />
            </Pressable>
          )}

          <Pressable
            style={[styles.navRow, styles.navRowLast]}
            onPress={handleLogout}
            disabled={loggingOut}
          >
            <View style={[styles.navIconWell, { backgroundColor: '#FFE4E6' }]}>
              <LogOut size={20} color="#E11D48" strokeWidth={2} />
            </View>
            <Text style={[styles.navText, { color: '#E11D48' }]}>Log Out</Text>
            <ChevronRight size={18} color="#94A3B8" strokeWidth={2} />
          </Pressable>
        </View>

        <Pressable onPress={confirmDeleteAccount} disabled={deleting} style={styles.deleteLink}>
          <Trash2 size={14} color={colors.textTertiary} />
          <Text style={styles.deleteLinkText}>Delete Account</Text>
        </Pressable>

        <WaveFooter />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topHeader: {
    backgroundColor: '#0A6344',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  mainContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 0,
  },
  userHeaderCard: {
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 22,
    fontWeight: '800',
    color: '#D97706',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
  },
  userSubtext: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 2,
  },
  editPill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  editPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  third: { flex: 1 },
  saveButton: { marginTop: spacing.sm },
  navigationList: {
    marginTop: 8,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  navRowLast: {
    borderBottomWidth: 0,
  },
  navIconWell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  navText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  deleteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: 24,
    paddingVertical: spacing.sm,
  },
  deleteLinkText: { fontSize: 12, color: '#94A3B8' },
  motivationalBanner: {
    alignItems: 'center',
    marginTop: 24,
    marginHorizontal: -20,
  },
  motiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 12,
    transform: [{ rotate: '-2deg' }],
  },
  motiveText1: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0A6344',
    textAlign: 'center',
    lineHeight: 24,
  },
  motiveText2: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0A6344',
    textAlign: 'center',
    lineHeight: 24,
  },
  waveWrap: {
    width: '100%',
    height: 70,
    marginTop: 8,
  },
  waveSvg: {
    width: '100%',
    height: '100%',
  },
});
