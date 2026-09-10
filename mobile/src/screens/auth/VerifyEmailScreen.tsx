import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MailCheck, ShieldCheck } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { authApi } from '../../api/auth';
import { configApi } from '../../api/config';
import { apiErrorMessage } from '../../api/client';
import { validateOtpCode } from '../../utils/validation';
import { colors, radius, spacing, typography } from '../../theme';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'VerifyEmail'>;

/**
 * Seconds to wait before "Resend code" becomes tappable again, until the first real
 * response tells us the server's actual policy (see OtpIssuedResponse.resendAfterSeconds).
 */
const DEFAULT_RESEND_COOLDOWN_SECONDS = 30;

/**
 * Second half of registration: the account exists but cannot sign in with a password until
 * the address is confirmed. Reached straight after signing up, and also from the login
 * screen when the backend answers with EMAIL_NOT_VERIFIED.
 */
export function VerifyEmailScreen({ navigation, route }: Props) {
  const { email, devCode } = route.params;

  const [otpLength, setOtpLength] = useState(6);
  const [code, setCode] = useState(devCode ?? '');
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(DEFAULT_RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    configApi
      .get()
      .then((config) => setOtpLength(config.otpLength))
      .catch(() => undefined);
  }, []);

  // One interval for the whole screen, cleared on unmount so it cannot keep ticking (and
  // setting state) after the user has navigated away.
  useEffect(() => {
    const timer = setInterval(() => {
      setCooldown((seconds) => (seconds > 0 ? seconds - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  async function handleVerify() {
    const codeError = validateOtpCode(code, otpLength);
    setError(codeError);
    if (codeError) return;

    setSubmitting(true);
    try {
      await authApi.verifyEmail(email.trim(), code.trim());
      Toast.show({
        type: 'success',
        text1: 'Email verified',
        text2: 'You can sign in now.',
      });
      // Reset rather than navigate: going "back" to a half-finished sign-up is meaningless
      // once the account is live.
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (err) {
      Toast.show({ type: 'error', text1: apiErrorMessage(err, 'Verification failed') });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      const response = await authApi.requestOtp(email.trim(), 'EMAIL_VERIFICATION');
      setCooldown(response.resendAfterSeconds ?? DEFAULT_RESEND_COOLDOWN_SECONDS);
      if (response.devCode) {
        setCode(response.devCode);
        Toast.show({ type: 'success', text1: 'Dev mode', text2: `Code: ${response.devCode}` });
      } else {
        Toast.show({ type: 'success', text1: 'Code sent', text2: 'Check your email inbox.' });
      }
    } catch (err) {
      Toast.show({ type: 'error', text1: apiErrorMessage(err, 'Could not resend the code') });
    } finally {
      setResending(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenContainer maxWidth={440}>
        <View style={styles.iconWrap}>
          <MailCheck size={30} color={colors.primaryDark} />
        </View>

        <Text style={typography.h1}>Verify your email</Text>
        <Text style={styles.intro}>
          We sent a {otpLength}-digit code to
        </Text>
        <Text style={styles.email}>{email}</Text>

        <Input
          label="Verification code"
          required
          placeholder={'0'.repeat(otpLength)}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={otpLength}
          error={error}
          leftIcon={<ShieldCheck size={18} color={colors.textTertiary} />}
        />

        <Button
          label="Verify & continue"
          onPress={handleVerify}
          loading={submitting}
          style={styles.verifyButton}
        />

        <Button
          label={cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          variant="ghost"
          onPress={handleResend}
          loading={resending}
          disabled={cooldown > 0}
        />

        <Text style={styles.footnote}>
          Wrong address? Go back and sign up again — the account is not usable until it is
          verified.
        </Text>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: radius.full,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  intro: { ...typography.bodySmall, marginTop: spacing.xs },
  email: {
    ...typography.bodyMedium,
    color: colors.primaryDark,
    marginBottom: spacing.xl,
  },
  verifyButton: { marginTop: spacing.lg, marginBottom: spacing.sm },
  footnote: { ...typography.caption, marginTop: spacing.xl, textAlign: 'center' },
});
