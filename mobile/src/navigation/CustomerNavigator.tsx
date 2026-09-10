import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { CustomerTabs } from './CustomerTabs';
import { CheckoutScreen } from '../screens/customer/CheckoutScreen';
import { OrderConfirmationScreen } from '../screens/customer/OrderConfirmationScreen';
import { OrderDetailScreen } from '../screens/customer/OrderDetailScreen';
import { NotificationsScreen } from '../screens/customer/NotificationsScreen';
import type { CustomerStackParamList } from './types';

const Stack = createNativeStackNavigator<CustomerStackParamList>();

const headerOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.textPrimary,
  headerTitleStyle: { fontWeight: '700' as const },
  headerShadowVisible: false,
};

export function CustomerNavigator() {
  return (
    <Stack.Navigator screenOptions={headerOptions}>
      <Stack.Screen name="CustomerTabs" component={CustomerTabs} options={{ headerShown: false }} />
      {/* headerShown: false — CheckoutScreen renders its own HeroHeader, so the native
          stack header would otherwise stack a second, plain header on top of it. */}
      <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="OrderConfirmation"
        component={OrderConfirmationScreen}
        // No back arrow: the order is already placed, so the only ways on are the two
        // explicit actions on the screen.
        options={{ title: 'Order Confirmed', headerBackVisible: false, gestureEnabled: false }}
      />
      {/* headerShown: false — OrderDetailScreen renders its own HeroHeader, matching every
          other customer screen instead of being the one plain-white-bar exception. */}
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
    </Stack.Navigator>
  );
}
