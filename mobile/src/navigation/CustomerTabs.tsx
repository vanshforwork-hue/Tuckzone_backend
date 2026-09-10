import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { UtensilsCrossed, ShoppingBag, Wallet, Users, User } from 'lucide-react-native';
import { FloatingTabBar } from '../components/FloatingTabBar';
import { useAuth } from '../context/AuthContext';
import { MenuScreen } from '../screens/customer/MenuScreen';
import { OrdersScreen } from '../screens/customer/OrdersScreen';
import { WalletScreen } from '../screens/customer/WalletScreen';
import { ChildrenScreen } from '../screens/customer/ChildrenScreen';
import { ProfileScreen } from '../screens/customer/ProfileScreen';
import type { CustomerTabParamList } from './types';

const Tab = createBottomTabNavigator<CustomerTabParamList>();

const ICONS = {
  Menu: UtensilsCrossed,
  Orders: ShoppingBag,
  Wallet: Wallet,
  Children: Users,
  Profile: User,
};

const LABELS = { Children: 'Wards' };

/** Parents get an extra "Children" tab; students and teachers do not need it. */
export function CustomerTabs() {
  const { user } = useAuth();
  const isParent = user?.role === 'PARENT';

  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <FloatingTabBar {...props} icons={ICONS} labels={LABELS} />}
    >
      <Tab.Screen name="Menu" component={MenuScreen} />
      <Tab.Screen name="Orders" component={OrdersScreen} />
      <Tab.Screen name="Wallet" component={WalletScreen} />
      {isParent && <Tab.Screen name="Children" component={ChildrenScreen} options={{ tabBarLabel: 'Wards' }} />}
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
