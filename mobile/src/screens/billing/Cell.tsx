import React from 'react';
import { View } from 'react-native';

/** Equal-width slot for a Button inside a row. Button is width:100%, so two of them side by
 *  side overflow unless each sits in its own flex cell. */
export function Cell({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1 }}>{children}</View>;
}
