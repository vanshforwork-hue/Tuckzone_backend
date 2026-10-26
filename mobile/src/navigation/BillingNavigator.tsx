import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { PosScreen } from '../screens/billing/PosScreen';
import { BillingHistoryScreen } from '../screens/billing/BillingHistoryScreen';
import { BillDetailScreen } from '../screens/billing/BillDetailScreen';
import { BillingCatalogScreen } from '../screens/billing/BillingCatalogScreen';
import { BillingSettingsScreen } from '../screens/billing/BillingSettingsScreen';
import { BillingReportsScreen } from '../screens/billing/BillingReportsScreen';
import { BillingPrinterScreen } from '../screens/billing/BillingPrinterScreen';
import { useAuth } from '../context/AuthContext';
import type { BillingStackParamList } from './types';

const Stack = createNativeStackNavigator<BillingStackParamList>();

/** Billing section mounted as a tab in both the Admin and Sub Admin navigators. Screens that
 *  are Canteen-Admin-only (settings, reports) are not registered for a Sub Admin at all; the
 *  backend enforces the same split. */
export function BillingNavigator() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'CANTEEN_ADMIN';
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: '700' as const },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="BillingPos" component={PosScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BillingHistory" component={BillingHistoryScreen} options={{ title: 'Bills' }} />
      <Stack.Screen name="BillDetail" component={BillDetailScreen} options={{ title: 'Bill' }} />
      <Stack.Screen name="BillingCatalog" component={BillingCatalogScreen} options={{ title: 'Billing Catalog' }} />
      <Stack.Screen name="BillingPrinter" component={BillingPrinterScreen} options={{ title: 'Printing' }} />
      {isAdmin && <Stack.Screen name="BillingSettings" component={BillingSettingsScreen} options={{ title: 'Billing Settings' }} />}
      {isAdmin && <Stack.Screen name="BillingReports" component={BillingReportsScreen} options={{ title: 'Billing Reports' }} />}
    </Stack.Navigator>
  );
}
