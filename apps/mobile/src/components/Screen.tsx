import { PropsWithChildren, ReactNode } from 'react';
import { GestureResponderHandlers, ScrollView, ScrollViewProps, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../design/tokens';
import { AppHeader } from './AppHeader';

type ScreenProps = PropsWithChildren<{
  eyebrow?: string;
  gestureHandlers?: GestureResponderHandlers;
  headerMode?: 'regular' | 'sticky';
  horizontalPadding?: boolean | number;
  refreshControl?: ScrollViewProps['refreshControl'];
  statusBanner?: ReactNode;
  tabBarPadding?: boolean | number;
  title: string;
  trailing?: ReactNode;
}>;

export function Screen({
  children,
  eyebrow,
  gestureHandlers,
  headerMode = 'regular',
  horizontalPadding = true,
  refreshControl,
  statusBanner,
  tabBarPadding = false,
  title,
  trailing,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const sidePadding = typeof horizontalPadding === 'number'
    ? horizontalPadding
    : horizontalPadding
      ? spacing.xl
      : 0;
  const chromePadding = sidePadding || spacing.xl;
  const navigationPadding = typeof tabBarPadding === 'number'
    ? tabBarPadding
    : tabBarPadding
      ? 72
      : spacing.xxxl;
  const hasHeader = Boolean(title || eyebrow || trailing);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea} {...gestureHandlers}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: navigationPadding + insets.bottom }]}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={headerMode === 'sticky' && hasHeader ? [0] : undefined}
        style={styles.container}
      >
        {hasHeader ? (
          <View style={[styles.headerShell, headerMode === 'sticky' ? styles.stickyHeader : null, { paddingHorizontal: chromePadding }]}>
            <AppHeader eyebrow={eyebrow} title={title} trailing={trailing} />
          </View>
        ) : null}
        {statusBanner ? <View style={[styles.banner, { marginHorizontal: chromePadding }]}>{statusBanner}</View> : null}
        <View style={[styles.body, { paddingHorizontal: sidePadding }]}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginBottom: spacing.md,
  },
  body: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  headerShell: {
    backgroundColor: colors.background,
    paddingBottom: spacing.lg,
    paddingTop: spacing.xl,
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  stickyHeader: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing.sm,
    paddingTop: spacing.sm,
  },
});
