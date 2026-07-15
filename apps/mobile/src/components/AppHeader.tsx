import { ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { colors, spacing, typography } from '../design/tokens';
import { resolveDynamicTypeLayout } from './dynamicTypeLayout';

type AppHeaderProps = {
  eyebrow?: string;
  leading?: ReactNode;
  title: string;
  trailing?: ReactNode;
};

export function AppHeader({ eyebrow, leading, title, trailing }: AppHeaderProps) {
  const dynamicTypeLayout = resolveDynamicTypeLayout(useWindowDimensions().fontScale);
  return (
    <View style={[styles.container, dynamicTypeLayout.headerStacked && styles.containerStacked]}>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.copy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        {title ? (
          <Text
            accessibilityRole="header"
            maxFontSizeMultiplier={dynamicTypeLayout.headerTitleMaxFontSizeMultiplier}
            numberOfLines={2}
            style={styles.title}
          >
            {title}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={[styles.trailing, dynamicTypeLayout.headerStacked && styles.trailingStacked]}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 54,
  },
  containerStacked: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    gap: spacing.md,
  },
  copy: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.accentText,
    marginBottom: spacing.xs,
  },
  leading: {
    marginRight: spacing.md,
  },
  title: {
    ...typography.heading,
    color: colors.text,
  },
  trailing: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginLeft: spacing.md,
  },
  trailingStacked: {
    alignSelf: 'flex-end',
    marginLeft: 0,
  },
});
