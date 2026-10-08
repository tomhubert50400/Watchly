import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../design/tokens';

export function NativeHeaderTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.headerTitle}>
      <Text accessibilityRole="header" numberOfLines={1} style={styles.headerTitleText}>
        {title}
      </Text>
      {subtitle !== undefined ? (
        <Text numberOfLines={1} style={styles.headerSubtitle}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerSubtitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 13,
    textAlign: 'center',
  },
  headerTitle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 20,
    textAlign: 'center',
  },
});
