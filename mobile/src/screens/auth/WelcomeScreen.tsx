import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChefHat, ArrowRight } from 'lucide-react-native';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Button } from '../../components/Button';
import { Lunchbox } from '../../components/illustrations/Lunchbox';
import { WaterBottle } from '../../components/illustrations/WaterBottle';
import { colors, spacing, typography } from '../../theme';
import type { AuthStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  return (
    <ScreenContainer contentStyle={styles.container} maxWidth={440}>
      {/* Brand Header */}
      <View style={styles.brandHeader}>
        <ChefHat size={46} color={colors.primary} strokeWidth={2.5} />
        <View style={styles.logoRow}>
          <Text style={[styles.logoLetter, { color: '#0E6347' }]}>T</Text>
          <Text style={[styles.logoLetter, { color: '#107352' }]}>u</Text>
          <Text style={[styles.logoLetter, { color: '#13805C' }]}>c</Text>
          <Text style={[styles.logoLetter, { color: '#168E66' }]}>k</Text>
          <Text style={[styles.logoLetter, { color: '#51A246' }]}>z</Text>
          <Text style={[styles.logoLetter, { color: '#F59E0B' }]}>o</Text>
          <Text style={[styles.logoLetter, { color: '#EA580C' }]}>n</Text>
          <Text style={[styles.logoLetter, { color: '#157F5A' }]}>e</Text>
        </View>
        <View style={styles.taglineRow}>
          <Text style={styles.taglineText}>School Canteen</Text>
          <View style={styles.taglineDot} />
          <Text style={styles.taglineText}>Made Easy</Text>
        </View>
      </View>

      {/* Hero Illustration & Headline */}
      <View style={styles.heroSection}>
        <View style={styles.headlineBox}>
          <Text style={styles.heroHeadline}>
            Good Food{'\n'}Fuels Great{'\n'}Days <Text style={styles.heartText}>♡</Text>
          </Text>
          <View style={styles.highlightLine} />
        </View>

        {/* Note Pill */}
        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>Healthy</Text>
          <Text style={styles.noteTitle}>Tasty</Text>
          <Text style={styles.noteFresh}>Fresh ♡</Text>
        </View>

        <View style={styles.illustrationWrap}>
          <Lunchbox size={120} />
          <WaterBottle size={90} />
        </View>
      </View>

      {/* Bottom Actions */}
      <View style={styles.actions}>
        <Button
          label="Login"
          onPress={() => navigation.navigate('Login')}
          size="lg"
          icon={<ArrowRight size={20} color={colors.textOnPrimary} />}
          style={styles.loginBtn}
        />
        <Button
          label="Create New Account"
          onPress={() => navigation.navigate('Register')}
          variant="secondary"
          size="lg"
          style={styles.registerBtn}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'space-between', paddingVertical: spacing.lg },
  brandHeader: { alignItems: 'center', marginTop: spacing.md },
  logoRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  logoLetter: { fontSize: 44, fontWeight: '900', fontFamily: typography.display.fontFamily },
  taglineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 4 },
  taglineText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  taglineDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.primary },

  heroSection: {
    alignItems: 'center',
    marginVertical: spacing.xl,
    position: 'relative',
  },
  headlineBox: { alignItems: 'center', marginBottom: spacing.lg },
  heroHeadline: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
    color: colors.primary,
    textAlign: 'center',
  },
  heartText: { color: '#E11D48', fontSize: 26 },
  highlightLine: { width: 90, height: 5, backgroundColor: '#F59E0B', borderRadius: 3, marginTop: 8 },

  noteCard: {
    position: 'absolute',
    top: 70,
    right: 20,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    transform: [{ rotate: '-6deg' }],
    zIndex: 10,
  },
  noteTitle: { fontSize: 12, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
  noteFresh: { fontSize: 12, fontWeight: '800', color: colors.primary, textAlign: 'center' },

  illustrationWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },

  actions: { gap: spacing.md, marginBottom: spacing.md },
  loginBtn: { backgroundColor: colors.primary },
  registerBtn: { borderColor: colors.primary },
});
