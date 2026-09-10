import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  BarChart3,
  Receipt,
  Users,
  CalendarClock,
  ShieldPlus,
  CreditCard,
  FileDown,
  LogOut,
  ChevronRight,
} from 'lucide-react-native';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { WaveFooter } from '../../components/WaveFooter';
import { useAuth } from '../../context/AuthContext';
import { colors, radius, spacing, typography } from '../../theme';
import type { AdminStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<AdminStackParamList>;

const LINKS: { screen: keyof AdminStackParamList; label: string; description: string; icon: React.ReactNode }[] = [
  { screen: 'Reports', label: 'Sales Reports', description: 'Revenue, profit, peak hours', icon: <BarChart3 size={20} color={colors.primaryDark} /> },
  { screen: 'Expenses', label: 'Expenses', description: 'Track overheads for accurate profit', icon: <Receipt size={20} color={colors.primaryDark} /> },
  { screen: 'OrderingWindows', label: 'Advance Ordering', description: 'Open/close ordering, view demand', icon: <CalendarClock size={20} color={colors.primaryDark} /> },
  { screen: 'Users', label: 'Accounts', description: 'Enable or disable user accounts', icon: <Users size={20} color={colors.primaryDark} /> },
  { screen: 'SubAdmins', label: 'Sub Admins', description: 'Create and manage sub admin accounts', icon: <ShieldPlus size={20} color={colors.primaryDark} /> },
  { screen: 'PaymentSettings', label: 'Payment Settings', description: 'Configure the platform fee', icon: <CreditCard size={20} color={colors.primaryDark} /> },
  { screen: 'ExportOrders', label: 'Export Orders', description: 'Download orders as Excel or PDF', icon: <FileDown size={20} color={colors.primaryDark} /> },
];

export function MoreScreen() {
  const navigation = useNavigation<Nav>();
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await logout();
  }

  return (
    <ScreenContainer edges={['top']} scroll={false} contentStyle={{ padding: 0, backgroundColor: '#0A6344' }}>
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.headerTitle}>More Settings</Text>
          <Text style={styles.headerSubtitle}>Signed in as {user?.fullName}</Text>
        </View>
      </View>

      <ScrollView style={styles.mainContainer} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={{ gap: spacing.sm }}>
          {LINKS.map((link) => (
            <Pressable key={link.screen} onPress={() => navigation.navigate(link.screen as never)}>
              <Card style={styles.row}>
                <View style={styles.iconWrap}>{link.icon}</View>
                <View style={{ flex: 1 }}>
                  <Text style={typography.bodyMedium}>{link.label}</Text>
                  <Text style={typography.caption}>{link.description}</Text>
                </View>
                <ChevronRight size={18} color={colors.textTertiary} />
              </Card>
            </Pressable>
          ))}
        </View>

        <Button
          label="Sign Out"
          variant="secondary"
          icon={<LogOut size={18} color={colors.textPrimary} />}
          onPress={handleLogout}
          loading={loggingOut}
          style={styles.logoutButton}
        />

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
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  mainContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  logoutButton: { marginTop: spacing.xxl },
});
