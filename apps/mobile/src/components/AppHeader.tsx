import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../design/tokens';

type AppHeaderProps = {
  eyebrow?: string;
  leading?: ReactNode;
  title: string;
  trailing?: ReactNode;
};

export function AppHeader({ eyebrow, leading, title, trailing }: AppHeaderProps) {
  return (
    <View style={styles.container}>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.copy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" numberOfLines={2} style={styles.title}>
          {title}
        </Text>
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 54,
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
});
