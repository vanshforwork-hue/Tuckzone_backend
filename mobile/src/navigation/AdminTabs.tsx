import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LayoutDashboard, ClipboardList, ChefHat, Calculator, Menu as MenuIcon } from 'lucide-react-native';
import { colors } from '../theme';
import { DashboardScreen } from '../screens/admin/DashboardScreen';
import { OrdersBoardScreen } from '../screens/admin/OrdersBoardScreen';
import { MenuManagementScreen } from '../screens/admin/MenuManagementScreen';
import { BillingNavigator } from './BillingNavigator';
import { MoreScreen } from '../screens/admin/MoreScreen';
import type { AdminTabParamList } from './types';

const Tab = createBottomTabNavigator<AdminTabParamList>();

export function AdminTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.textTertiary,
        // A hardcoded height overrides the inset React Navigation would otherwise add,
        // which is what pushed the tabs underneath the 3-button navigation bar. Adding
        // insets.bottom covers both cases: it is the nav-bar height on button phones and
        // the smaller gesture-pill allowance on gesture phones (0 when neither exists).
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
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} /> }}
      />
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
        name="More"
        component={MoreScreen}
        options={{ tabBarIcon: ({ color, size }) => <MenuIcon color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
}
