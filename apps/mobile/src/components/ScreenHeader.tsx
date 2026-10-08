import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, spacing } from '../design/tokens';
import { AppHeader, type AppHeaderProps } from './AppHeader';
import { ScreenReveal } from './ScreenReveal';

export function ScreenHeader({ style, ...props }: AppHeaderProps & { style?: StyleProp<ViewStyle> }) {
  return <ScreenReveal style={[styles.header, style]}><AppHeader {...props} /></ScreenReveal>;
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    paddingTop: spacing.xl,
  },
});
