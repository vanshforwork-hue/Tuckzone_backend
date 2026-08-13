import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Mail, Lock, UtensilsCrossed } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Input } from '../../components/Input';
import { PasswordInput } from '../../components/PasswordInput';
import { Button } from '../../components/Button';
import { SegmentedControl } from '../../components/SegmentedControl';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api/auth';
import { configApi } from '../../api/config';
import { apiErrorCode, apiErrorMessage } from '../../api/client';
import { validateEmail, validateOtpCode } from '../../utils/validation';
import { colors, spacing, typography } from '../../theme';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;
type Mode = 'password' | 'otp';

export function LoginScreen({ navigation }: Props) {
  const { login, loginWithOtp } = useAuth();
  const [mode, setMode] = useState<Mode>('password');
  const [otpLength, setOtpLength] = useState(6);
  const [devHint, setDevHint] = useState(false);

  // Password fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // OTP fields — codes are emailed, so the identity here is the address, not a number
  const [otpEmail, setOtpEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // One interval for the whole screen, cleared on unmount so it cannot keep ticking (and
  // setting state) after the user has navigated away. Clamped at 0 when idle.
  useEffect(() => {
    const timer = setInterval(() => {
      setCooldown((seconds) => (seconds > 0 ? seconds - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // otpDevCodeReturned tells us the backend has no mail server configured yet — in that
    // case the requested code comes back in the response, so we can show it directly
    // instead of the user waiting for an email that will never arrive.
    configApi
      .get()
      .then((config) => {
        setOtpLength(config.otpLength);
        setDevHint(config.otpDevCodeReturned);
      })
      .catch(() => undefined);
  }, []);

  async function handlePasswordLogin() {
    const emailError = validateEmail(email);
    const passwordError = password ? undefined : 'Password is required';
    setErrors({ email: emailError ?? '', password: passwordError ?? '' });
    if (emailError || passwordError) return;

    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      Toast.show({ type: 'success', text1: `Welcome back, ${user.fullName.split(' ')[0]}!` });
    } catch (error) {
      // Someone who signed up but never entered the emailed code lands here. Sending them
      // to the verification screen is far more useful than a dead-end error toast.
      if (apiErrorCode(error) === 'EMAIL_NOT_VERIFIED') {
        Toast.show({
          type: 'info',
          text1: 'Verify your email first',
          text2: 'Enter the code we emailed you.',
        });
        navigation.navigate('VerifyEmail', { email: email.trim() });
        return;
      }
      Toast.show({ type: 'error', text1: apiErrorMessage(error, 'Invalid email or password') });
    } finally {
      setLoading(false);
    }
  }

  async function handleSendCode() {
    const emailError = validateEmail(otpEmail);
    setErrors({ otpEmail: emailError ?? '' });
    if (emailError) return;

    setSendingCode(true);
    try {
      const response = await authApi.requestOtp(otpEmail.trim(), 'LOGIN');
      setCodeSent(true);
      setCooldown(response.resendAfterSeconds ?? 30);
      if (devHint && response.devCode) {
        setCode(response.devCode);
        Toast.show({ type: 'success', text1: 'Dev mode', text2: `Code: ${response.devCode}` });
      } else {
        Toast.show({ type: 'success', text1: 'Code sent', text2: 'Check your email inbox' });
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: apiErrorMessage(error) });
    } finally {
      setSendingCode(false);
    }
  }

  async function handleOtpLogin() {
    const codeError = validateOtpCode(code, otpLength);
    setErrors((prev) => ({ ...prev, code: codeError ?? '' }));
    if (codeError) return;

    setLoading(true);
    try {
      const user = await loginWithOtp(otpEmail.trim(), code.trim());
      Toast.show({ type: 'success', text1: `Welcome back, ${user.fullName.split(' ')[0]}!` });
    } catch (error) {
      Toast.show({ type: 'error', text1: apiErrorMessage(error, 'Incorrect or expired code') });
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScreenContainer contentStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <UtensilsCrossed color={colors.primaryDark} size={30} />
          </View>
          <Text style={typography.display}>TuckZone</Text>
          <Text style={styles.subtitle}>Fresh meals, delivered to your classroom</Text>
        </View>

        <SegmentedControl
          options={[
            { value: 'password', label: 'Password' },
            { value: 'otp', label: 'OTP' },
          ]}
          value={mode}
          onChange={(next) => {
            setMode(next);
            setErrors({});
          }}
        />

        <View style={styles.form}>
          {mode === 'password' ? (
            <>
              <Input
                label="Email address"
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                error={errors.email}
                leftIcon={<Mail size={18} color={colors.textTertiary} />}
              />
              <PasswordInput
                label="Password"
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                autoComplete="password"
                error={errors.password}
                leftIcon={<Lock size={18} color={colors.textTertiary} />}
              />
              <Button label="Sign In" onPress={handlePasswordLogin} loading={loading} style={styles.actionSpacing} />
              <Button
                label="Forgot password?"
                variant="ghost"
                fullWidth={false}
                onPress={() => navigation.navigate('ForgotPassword')}
              />
            </>
          ) : (
            <>
              <Input
                label="Email address"
                placeholder="you@example.com"
                value={otpEmail}
                onChangeText={(text) => {
                  setOtpEmail(text);
                  setCodeSent(false);
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                error={errors.otpEmail}
                leftIcon={<Mail size={18} color={colors.textTertiary} />}
              />
              {!codeSent ? (
                <Button label="Send Code" onPress={handleSendCode} loading={sendingCode} />
              ) : (
                <>
                  <Input
                    label={`${otpLength}-digit code`}
                    placeholder="000000"
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                    maxLength={otpLength}
                    error={errors.code}
                  />
                  <Button label="Verify & Sign In" onPress={handleOtpLogin} loading={loading} style={styles.actionSpacing} />
                  <Button
                    label={cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                    variant="ghost"
                    fullWidth={false}
                    onPress={handleSendCode}
                    loading={sendingCode}
                    disabled={cooldown > 0}
                  />
                </>
              )}
            </>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don&apos;t have an account?</Text>
          <Button label="Register here" variant="ghost" fullWidth={false} onPress={() => navigation.navigate('Register')} />
        </View>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: spacing.xxl },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
  form: { marginTop: spacing.xxl },
  actionSpacing: { marginTop: spacing.sm },
  footer: { alignItems: 'center', marginTop: spacing.xl },
  footerText: { ...typography.bodySmall },
});
