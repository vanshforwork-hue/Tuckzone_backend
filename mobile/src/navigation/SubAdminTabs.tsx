import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ClipboardList, ChefHat, Calculator, FileDown, UserCircle } from 'lucide-react-native';
import { colors } from '../theme';
import { OrdersBoardScreen } from '../screens/admin/OrdersBoardScreen';
import { MenuManagementScreen } from '../screens/admin/MenuManagementScreen';
import { BillingNavigator } from './BillingNavigator';
import { ExportOrdersScreen } from '../screens/admin/ExportOrdersScreen';
import { SubAdminAccountScreen } from '../screens/admin/SubAdminAccountScreen';
import type { SubAdminTabParamList } from './types';

const Tab = createBottomTabNavigator<SubAdminTabParamList>();

export function SubAdminTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          borderTopColor: colors.border,
          height: 60 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="OrdersBoard"
        component={OrdersBoardScreen}
        options={{ tabBarLabel: 'Orders', tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} /> }}
      />
      <Tab.Screen
        name="MenuManagement"
        component={MenuManagementScreen}
        options={{ tabBarLabel: 'Menu', tabBarIcon: ({ color, size }) => <ChefHat color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Billing"
        component={BillingNavigator}
        options={{ tabBarIcon: ({ color, size }) => <Calculator color={color} size={size} /> }}
      />
      <Tab.Screen
        name="ExportOrders"
        component={ExportOrdersScreen}
        options={{ tabBarLabel: 'Export', tabBarIcon: ({ color, size }) => <FileDown color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Account"
        component={SubAdminAccountScreen}
        options={{ tabBarIcon: ({ color, size }) => <UserCircle color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
}
