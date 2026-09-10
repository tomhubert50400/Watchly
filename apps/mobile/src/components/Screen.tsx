import { useScrollToTop } from '@react-navigation/native';
import { PropsWithChildren, ReactNode, RefObject, useRef } from 'react';
import {
  GestureResponderHandlers,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../design/tokens';
import { useFocusedFieldVisibility } from './useFocusedFieldVisibility';
import { AppHeader } from './AppHeader';

type ScreenProps = PropsWithChildren<{
  background?: ReactNode;
  eyebrow?: string;
  footer?: ReactNode;
  gestureHandlers?: GestureResponderHandlers;
  headerMode?: 'regular' | 'sticky';
  horizontalPadding?: boolean | number;
  leading?: ReactNode;
  nativeKeyboardInsetsOnly?: boolean;
  refreshControl?: ScrollViewProps['refreshControl'];
  scrollViewRef?: RefObject<ScrollView | null>;
  statusBanner?: ReactNode;
  tabBarPadding?: boolean | number;
  title: string;
  trailing?: ReactNode;
}>;

export function Screen({
  background,
  children,
  eyebrow,
  footer,
  gestureHandlers,
  headerMode = 'regular',
  horizontalPadding = true,
  leading,
  nativeKeyboardInsetsOnly = false,
  refreshControl,
  scrollViewRef: providedScrollViewRef,
  statusBanner,
  tabBarPadding = false,
  title,
  trailing,
}: ScreenProps) {
  const fallbackScrollViewRef = useRef<ScrollView>(null);
  const scrollViewRef = providedScrollViewRef ?? fallbackScrollViewRef;
  const visibility = useFocusedFieldVisibility(scrollViewRef);
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
  const footerBottomPadding = typeof tabBarPadding === 'number'
    ? tabBarPadding
    : tabBarPadding
      ? 72
      : spacing.md;
  const useNativeKeyboardInsets = nativeKeyboardInsetsOnly && !footer;
  const hasHeader = Boolean(title || eyebrow || leading || trailing);
  useScrollToTop(scrollViewRef);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea} {...gestureHandlers}>
      {background ? <View pointerEvents="none" style={styles.background}>{background}</View> : null}
      <KeyboardAvoidingView
        behavior={!useNativeKeyboardInsets && Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoider}
      >
        <ScrollView
          {...visibility}
          automaticallyAdjustKeyboardInsets={useNativeKeyboardInsets}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: footer ? spacing.lg : navigationPadding + insets.bottom },
          ]}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={headerMode === 'sticky' && hasHeader ? [0] : undefined}
          style={styles.container}
        >
          {hasHeader ? (
            <View
              style={[
                styles.headerShell,
                background ? styles.transparentHeader : null,
                headerMode === 'sticky' ? styles.stickyHeader : null,
                { paddingHorizontal: chromePadding },
              ]}
            >
              <AppHeader eyebrow={eyebrow} leading={leading} title={title} trailing={trailing} />
            </View>
          ) : null}
          {statusBanner ? <View style={[styles.banner, { marginHorizontal: chromePadding }]}>{statusBanner}</View> : null}
          <View style={[styles.body, { paddingHorizontal: sidePadding }]}>{children}</View>
        </ScrollView>
        {footer ? (
          <View
            style={[
              styles.footer,
              background ? styles.transparentFooter : null,
              {
                paddingBottom: footerBottomPadding + insets.bottom,
                paddingHorizontal: chromePadding,
              },
            ]}
          >
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  background: {
    ...StyleSheet.absoluteFillObject,
  },
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
  footer: {
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
  },
  keyboardAvoider: {
    flex: 1,
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
  transparentFooter: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
  },
  transparentHeader: {
    backgroundColor: 'transparent',
  },
});
