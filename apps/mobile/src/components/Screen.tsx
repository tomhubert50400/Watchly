import { PropsWithChildren, ReactNode } from 'react';
import { GestureResponderHandlers, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../design/tokens';

type ScreenProps = PropsWithChildren<{
  eyebrow?: string;
  gestureHandlers?: GestureResponderHandlers;
  title: string;
  trailing?: ReactNode;
}>;

export function Screen({ children, eyebrow, gestureHandlers, title, trailing }: ScreenProps) {
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea} {...gestureHandlers}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.container}
      >
        <View style={styles.header}>
          <View style={styles.titleGroup}>
            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
            <Text style={styles.heading}>{title}</Text>
          </View>
          {trailing}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    paddingTop: spacing.xxxl,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.accent,
    marginBottom: spacing.sm,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  heading: {
    ...typography.heading,
    color: colors.text,
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  titleGroup: {
    flex: 1,
    paddingRight: spacing.md,
  },
});
