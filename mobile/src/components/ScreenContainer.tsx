import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

interface ScreenContainerProps {
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: ViewStyle;
  /**
   * Which physical screen edges to keep clear.
   *
   * Defaults to top+bottom, which is what a stack screen needs: it runs all the way to the
   * hardware edge, so without the bottom inset its last button sits under the gesture bar
   * or the 3-button navigation bar.
   *
   * Screens inside a tab navigator must pass `['top']` instead — there the tab bar already
   * occupies the bottom inset (see CustomerTabs/AdminTabs), and padding it twice leaves a
   * dead gap above the tabs.
   */
  edges?: readonly Edge[];
  /**
   * Caps content width and centers it, instead of letting it stretch edge-to-edge. A no-op
   * on an actual phone (the viewport is already narrower than any sane value here) — it
   * only matters on the web build, where a one-column form/card layout stretched across a
   * desktop-width viewport reads as an unfinished mobile screen rather than a real page.
   * Opt-in per screen: most screens (grids, lists) want the full width even on web.
   */
  maxWidth?: number;
}

/**
 * Every screen renders inside this. It owns the safe-area padding, the background color,
 * and (when scroll=true) pull-to-refresh — so scrolling behaviour is identical everywhere
 * instead of some screens forgetting it.
 */
export function ScreenContainer({
  children,
  scroll = true,
  refreshing = false,
  onRefresh,
  contentStyle,
  edges = ['top', 'bottom'],
  maxWidth,
}: ScreenContainerProps) {
  const body = maxWidth ? <View style={[styles.capped, { maxWidth }]}>{children}</View> : children;

  if (!scroll) {
    return (
      <SafeAreaView style={styles.safeArea} edges={edges}>
        {/*
          flex:1 is load-bearing, not cosmetic. Without it this View shrinks to fit its
          children, so anything positioned `absolute ... bottom` inside a screen (the cart
          bar) anchors to the bottom of the *content* rather than the bottom of the screen
          and can land off-view. It only appeared to fix itself when a re-render remeasured
          the View, which is why the cart bar showed up on switching menu tabs.
        */}
        <View style={[styles.fill, styles.content, contentStyle]}>{body}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={edges}>
      <ScrollView
        style={styles.safeArea}
        contentContainerStyle={[styles.content, contentStyle]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          ) : undefined
        }
      >
        {body}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  capped: { width: '100%', alignSelf: 'center' },
});
