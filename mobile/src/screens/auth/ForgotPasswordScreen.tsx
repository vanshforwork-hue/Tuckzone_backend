import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Mail, Lock } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Input } from '../../components/Input';
import { PasswordInput } from '../../components/PasswordInput';
import { Button } from '../../components/Button';
import { authApi } from '../../api/auth';
import { configApi } from '../../api/config';
import { apiErrorMessage } from '../../api/client';
import { validateEmail, validateOtpCode, validatePassword } from '../../utils/validation';
import { colors, spacing, typography } from '../../theme';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const [otpLength, setOtpLength] = useState(6);
  const [devHint, setDevHint] = useState(false);

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sendingCode, setSendingCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    configApi
      .get()
      .then((config) => {
        setOtpLength(config.otpLength);
        setDevHint(config.otpDevCodeReturned);
      })
      .catch(() => undefined);
  }, []);

  // One interval for the whole screen, cleared on unmount so it cannot keep ticking (and
  // setting state) after the user has navigated away. Clamped at 0 when idle.
  useEffect(() => {
    const timer = setInterval(() => {
      setCooldown((seconds) => (seconds > 0 ? seconds - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  async function handleSendCode() {
    const emailError = validateEmail(email);
    setErrors({ email: emailError ?? '' });
    if (emailError) return;

    setSendingCode(true);
    try {
      const response = await authApi.requestOtp(email.trim(), 'PASSWORD_RESET');
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

  async function handleReset() {
    const codeError = validateOtpCode(code, otpLength);
    const passwordError = validatePassword(newPassword);
    setErrors((prev) => ({ ...prev, code: codeError ?? '', newPassword: passwordError ?? '' }));
    if (codeError || passwordError) return;

    setSubmitting(true);
    try {
      await authApi.resetPassword(email.trim(), code.trim(), newPassword);
      Toast.show({ type: 'success', text1: 'Password updated', text2: 'Please sign in with your new password' });
      navigation.navigate('Login');
    } catch (error) {
      Toast.show({ type: 'error', text1: apiErrorMessage(error, 'Could not reset password') });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScreenContainer contentStyle={styles.container} maxWidth={440}>
        <Text style={typography.h1}>Forgot your password?</Text>
        <Text style={styles.subtitle}>
          We&apos;ll email a one-time code to your registered address.
        </Text>

        <View style={styles.form}>
          <Input
            label="Email address"
            required
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setCodeSent(false);
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            error={errors.email}
            leftIcon={<Mail size={18} color={colors.textTertiary} />}
          />

          {!codeSent ? (
            <Button label="Send Code" onPress={handleSendCode} loading={sendingCode} />
          ) : (
            <>
              <Input
                label={`${otpLength}-digit code`}
                required
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={otpLength}
                error={errors.code}
              />
              <PasswordInput
                label="New password"
                required
                value={newPassword}
                onChangeText={setNewPassword}
                error={errors.newPassword}
                leftIcon={<Lock size={18} color={colors.textTertiary} />}
              />
              <Button label="Reset Password" onPress={handleReset} loading={submitting} style={styles.actionSpacing} />
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
        </View>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1 },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  form: { marginTop: spacing.xxl },
  actionSpacing: { marginTop: spacing.sm },
});
