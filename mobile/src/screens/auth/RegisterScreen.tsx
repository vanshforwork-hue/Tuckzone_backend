import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { User, Mail, Phone, Lock, Hash, BookOpen, KeyRound, Layers, Users, ChefHat } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Input } from '../../components/Input';
import { PasswordInput } from '../../components/PasswordInput';
import { Button } from '../../components/Button';
import { SegmentedControl } from '../../components/SegmentedControl';
import { authApi } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { apiErrorMessage, apiFieldErrors } from '../../api/client';
import {
  validateEmail,
  validateMobile,
  validatePassword,
  validateRequired,
} from '../../utils/validation';
import { colors, spacing, typography } from '../../theme';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;
type Role = 'STUDENT' | 'TEACHER' | 'PARENT' | 'ADMIN';

export function RegisterScreen({ navigation, route }: Props) {
  const { registerStudentWithFirebase, registerTeacherWithFirebase, registerParentWithFirebase } = useAuth();
  // Arrives here from LoginScreen's Email tab when a verified Firebase identity has no
  // matching account yet — that identity already proved ownership of the email, so no
  // password is collected and Canteen/admin self-registration isn't offered (it stays on
  // the invite-code + password path only). The email itself can't be changed here: it IS
  // the verified identity, and the backend rejects a mismatch (see
  // FirebaseAccountService.newFirebaseUser on the backend).
  const firebaseIdToken = route.params?.firebaseIdToken;

  const [role, setRole] = useState<Role>('STUDENT');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');

  // Student-only
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [section, setSection] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [seatNumber, setSeatNumber] = useState('');
  const [parentMobile, setParentMobile] = useState('');

  // Teacher-only
  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState('');

  // Admin-only. The endpoint is public, so this invite code is the only thing stopping
  // anyone from granting themselves canteen-admin rights.
  const [signupCode, setSignupCode] = useState('');

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};
    const set = (key: string, error?: string) => {
      if (error) next[key] = error;
    };

    set('fullName', validateRequired(fullName, 'Full name'));
    set('email', validateEmail(email));
    set('mobile', validateMobile(mobile));
    if (!firebaseIdToken) {
      set('password', validatePassword(password));
    }

    if (role === 'STUDENT') {
      set('admissionNumber', validateRequired(admissionNumber, 'Admission number'));
      set('studentClass', validateRequired(studentClass, 'Class'));
      set('section', validateRequired(section, 'Section'));
      set('rollNumber', validateRequired(rollNumber, 'Roll number'));
      set('seatNumber', validateRequired(seatNumber, 'Academic year'));
      // Optional: only checked for a valid format when the student actually enters one.
      if (parentMobile) set('parentMobile', validateMobile(parentMobile));
    }
    if (role === 'TEACHER') {
      set('employeeId', validateRequired(employeeId, 'Employee ID'));
      set('department', validateRequired(department, 'Department'));
    }
    if (role === 'ADMIN') {
      set('signupCode', validateRequired(signupCode, 'Canteen signup code'));
    }
    return next;
  }

  async function handleSubmit() {
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      Toast.show({ type: 'error', text1: 'Please fix the fields highlighted in red' });
      return;
    }

    setLoading(true);
    try {
      if (firebaseIdToken) {
        // Identity already verified by Firebase — this creates the account and signs the
        // user in immediately, so there's no separate email-verification step to route to.
        const base = { idToken: firebaseIdToken, fullName, email: email.trim(), mobile: mobile.trim() };
        if (role === 'STUDENT') {
          await registerStudentWithFirebase({
            ...base,
            admissionNumber,
            studentClass,
            section,
            rollNumber,
            seatNumber: seatNumber || undefined,
            parentMobile: parentMobile.trim() || undefined,
          });
        } else if (role === 'TEACHER') {
          await registerTeacherWithFirebase({ ...base, employeeId, department });
        } else {
          await registerParentWithFirebase(base);
        }
        Toast.show({ type: 'success', text1: `Welcome, ${fullName.split(' ')[0]}!` });
        return;
      }

      if (role === 'STUDENT') {
        await authApi.registerStudent({
          fullName,
          email: email.trim(),
          mobile: mobile.trim(),
          password,
          admissionNumber,
          studentClass,
          section,
          rollNumber,
          seatNumber: seatNumber || undefined,
          parentMobile: parentMobile.trim() || undefined,
        });
      } else if (role === 'TEACHER') {
        await authApi.registerTeacher({
          fullName,
          email: email.trim(),
          mobile: mobile.trim(),
          password,
          employeeId,
          department,
        });
      } else if (role === 'ADMIN') {
        await authApi.registerAdmin({
          fullName,
          email: email.trim(),
          mobile: mobile.trim(),
          password,
          signupCode: signupCode.trim(),
        });
      } else {
        await authApi.registerParent({ fullName, email: email.trim(), mobile: mobile.trim(), password });
      }
      Toast.show({
        type: 'success',
        text1: 'Account created',
        text2: 'Enter the code we emailed you to finish.',
      });
      // Registration is only half the flow now — the account cannot sign in with a
      // password until the emailed code is entered.
      navigation.navigate('VerifyEmail', { email: email.trim() });
    } catch (error) {
      // The backend validates more than this form does (length caps, uniqueness, password
      // rules), so a rejection can name a field we never checked. Put each message on its
      // own input rather than leaving the user to guess which box the toast is about.
      const serverErrors = apiFieldErrors(error);
      if (Object.keys(serverErrors).length > 0) {
        setErrors(serverErrors);
        Toast.show({
          type: 'error',
          text1: 'Please fix the highlighted fields',
          text2: Object.values(serverErrors)[0],
        });
      } else {
        Toast.show({ type: 'error', text1: apiErrorMessage(error, 'Registration failed') });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScreenContainer maxWidth={640} contentStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <ChefHat color={colors.primary} size={22} />
            <Text style={styles.wordmark}>
              Tuck<Text style={styles.wordmarkAccent}>zone</Text>
            </Text>
          </View>
          <Text style={styles.headerTitle}>Create Account</Text>
        </View>

        <SegmentedControl
          options={[
            { value: 'STUDENT', label: 'Learner' },
            { value: 'TEACHER', label: 'Teacher' },
            { value: 'PARENT', label: 'Parent' },
            // Canteen/admin self-registration stays on the invite-code + password path
            // only — a Firebase-verified phone number isn't sufficient for admin access.
            ...(firebaseIdToken ? [] : [{ value: 'ADMIN' as const, label: 'Canteen' }]),
          ]}
          value={role}
          onChange={(next) => {
            setRole(next);
            setErrors({});
          }}
        />
        {firebaseIdToken && (
          <Text style={styles.firebaseHint}>
            Your email is verified — just a few more details to finish setting up your account.
          </Text>
        )}

        <View style={styles.form}>
          <Input
            label="Full Name"
            required
            value={fullName}
            onChangeText={setFullName}
            error={errors.fullName}
            leftIcon={<User size={18} color={colors.textTertiary} />}
          />
          <Input
            label="Email Address"
            required
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            error={errors.email}
            editable={!firebaseIdToken}
            leftIcon={<Mail size={18} color={colors.textTertiary} />}
          />
          <Input
            label={role === 'STUDENT' ? 'Login Mobile (10 digits)' : 'Mobile Number (10 digits)'}
            required
            value={mobile}
            onChangeText={setMobile}
            keyboardType="number-pad"
            maxLength={10}
            error={errors.mobile}
            leftIcon={<Phone size={18} color={colors.textTertiary} />}
          />
          {!firebaseIdToken && (
            <PasswordInput
              label="Password"
              required
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              leftIcon={<Lock size={18} color={colors.textTertiary} />}
            />
          )}

          {role === 'STUDENT' && (
            <>
              <View style={styles.row}>
                <View style={styles.half}>
                  <Input
                    label="Admission No."
                    required
                    value={admissionNumber}
                    onChangeText={setAdmissionNumber}
                    error={errors.admissionNumber}
                    leftIcon={<Hash size={18} color={colors.textTertiary} />}
                  />
                </View>
                <View style={styles.half}>
                  <Input
                    label="Roll No."
                    required
                    value={rollNumber}
                    onChangeText={setRollNumber}
                    error={errors.rollNumber}
                  />
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.third}>
                  <Input
                    label="Class"
                    required
                    value={studentClass}
                    onChangeText={setStudentClass}
                    error={errors.studentClass}
                    leftIcon={<BookOpen size={18} color={colors.textTertiary} />}
                  />
                </View>
                <View style={styles.third}>
                  <Input
                    label="Section"
                    required
                    value={section}
                    onChangeText={setSection}
                    error={errors.section}
                    leftIcon={<Layers size={18} color={colors.textTertiary} />}
                  />
                </View>
                <View style={styles.third}>
                  <Input
                    label="Academic Year"
                    required
                    value={seatNumber}
                    onChangeText={setSeatNumber}
                    error={errors.seatNumber}
                  />
                </View>
              </View>
              <Input
                label="Parent's Mobile (for linking, optional)"
                value={parentMobile}
                onChangeText={setParentMobile}
                keyboardType="number-pad"
                maxLength={10}
                error={errors.parentMobile}
                leftIcon={<Phone size={18} color={colors.textTertiary} />}
              />
            </>
          )}

          {role === 'TEACHER' && (
            <View style={styles.row}>
              <View style={styles.half}>
                <Input
                  label="Employee ID"
                  required
                  value={employeeId}
                  onChangeText={setEmployeeId}
                  error={errors.employeeId}
                  leftIcon={<Hash size={18} color={colors.textTertiary} />}
                />
              </View>
              <View style={styles.half}>
                <Input
                  label="Department"
                  required
                  value={department}
                  onChangeText={setDepartment}
                  error={errors.department}
                  leftIcon={<Users size={18} color={colors.textTertiary} />}
                />
              </View>
            </View>
          )}

          {role === 'ADMIN' && (
            <>
              <Input
                label="Canteen Signup Code"
                required
                value={signupCode}
                onChangeText={setSignupCode}
                autoCapitalize="none"
                error={errors.signupCode}
                leftIcon={<KeyRound size={18} color={colors.textTertiary} />}
              />
              <Text style={styles.adminHint}>
                Whoever set up TuckZone for your school chose this code when installing the
                server. Ask them for it — it is what stops anyone from giving themselves
                canteen access.
              </Text>
            </>
          )}

          <Button label="Register" onPress={handleSubmit} loading={loading} style={styles.submit} />
        </View>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { alignItems: 'center', marginBottom: spacing.lg },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  wordmark: { ...typography.h2, color: colors.primary },
  wordmarkAccent: { color: colors.accent },
  headerTitle: { ...typography.h1, marginTop: spacing.sm },
  form: { marginTop: spacing.xl },
  row: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
  third: { flex: 1 },
  adminHint: { ...typography.caption, marginTop: -spacing.xs, marginBottom: spacing.md },
  firebaseHint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' },
  submit: { marginTop: spacing.sm },
  // Extra room below the last field: with the keyboard open, KeyboardAvoidingView shrinks
  // the scrollable viewport but the content's own bottom padding stays fixed, so the
  // default padding leaves the submit button just barely behind the keyboard.
  scrollContent: { paddingBottom: spacing.xxxl * 3 },
});
