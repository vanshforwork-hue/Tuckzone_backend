import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { AdminTabs } from './AdminTabs';
import { ReportsScreen } from '../screens/admin/ReportsScreen';
import { ExpensesScreen } from '../screens/admin/ExpensesScreen';
import { UsersScreen } from '../screens/admin/UsersScreen';
import { SubAdminsScreen } from '../screens/admin/SubAdminsScreen';
import { OrderingWindowsScreen } from '../screens/admin/OrderingWindowsScreen';
import { PaymentSettingsScreen } from '../screens/admin/PaymentSettingsScreen';
import { ExportOrdersScreen } from '../screens/admin/ExportOrdersScreen';
import { NotificationsScreen } from '../screens/customer/NotificationsScreen';
import type { AdminStackParamList } from './types';

const Stack = createNativeStackNavigator<AdminStackParamList>();

const headerOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.textPrimary,
  headerTitleStyle: { fontWeight: '700' as const },
  headerShadowVisible: false,
};

export function AdminNavigator() {
  return (
    <Stack.Navigator screenOptions={headerOptions}>
      <Stack.Screen name="AdminTabs" component={AdminTabs} options={{ headerShown: false }} />
      <Stack.Screen name="Reports" component={ReportsScreen} options={{ title: 'Sales Reports' }} />
      <Stack.Screen name="Expenses" component={ExpensesScreen} options={{ title: 'Expenses' }} />
      <Stack.Screen name="Users" component={UsersScreen} options={{ title: 'Accounts' }} />
      <Stack.Screen name="SubAdmins" component={SubAdminsScreen} options={{ title: 'Sub Admins' }} />
      <Stack.Screen
        name="OrderingWindows"
        component={OrderingWindowsScreen}
        options={{ title: 'Advance Ordering' }}
      />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      <Stack.Screen
        name="PaymentSettings"
        component={PaymentSettingsScreen}
        options={{ title: 'Payment Settings' }}
      />
      <Stack.Screen name="ExportOrders" component={ExportOrdersScreen} options={{ title: 'Export Orders' }} />
    </Stack.Navigator>
  );
}
