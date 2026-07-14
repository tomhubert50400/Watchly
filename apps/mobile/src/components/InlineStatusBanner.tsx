import { useEffect } from 'react';
import { CircleCheck, RefreshCw, TriangleAlert, WifiOff } from 'lucide-react-native';
import { AccessibilityInfo, ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, touchTargets, typography } from '../design/tokens';
import { BannerTone, getBannerPresentation } from './cinematicPrimitives';

type InlineStatusBannerProps = {
  detail?: string;
  onRetry?: () => void;
  retryLabel?: string;
  title?: string;
  tone: BannerTone;
};

const toneColors = {
  error: { background: colors.dangerBackground, border: colors.dangerBorder, foreground: colors.danger },
  offline: { background: 'rgba(241, 184, 91, 0.09)', border: 'rgba(241, 184, 91, 0.24)', foreground: '#F1B85B' },
  success: { background: colors.successBackground, border: colors.successBorder, foreground: colors.success },
  updating: { background: colors.accentSoft, border: colors.accentBorder, foreground: colors.accentText },
} as const;

export function InlineStatusBanner({ detail, onRetry, retryLabel = 'Retry', title, tone }: InlineStatusBannerProps) {
  const presentation = getBannerPresentation(tone);
  const palette = toneColors[tone];
  const iconProps = { color: palette.foreground, size: 18, strokeWidth: 2 };
  const icon = presentation.icon === 'offline'
    ? <WifiOff {...iconProps} />
    : presentation.icon === 'error'
      ? <TriangleAlert {...iconProps} />
      : presentation.icon === 'success'
        ? <CircleCheck {...iconProps} />
        : <RefreshCw {...iconProps} />;

  const resolvedTitle = title ?? presentation.defaultTitle;

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      return;
    }

    const announcement = detail ? `${resolvedTitle}. ${detail}` : resolvedTitle;
    const timer = setTimeout(() => AccessibilityInfo.announceForAccessibility(announcement), 100);
    return () => clearTimeout(timer);
  }, [detail, resolvedTitle]);

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole={presentation.accessibilityRole}
      style={[styles.container, { backgroundColor: palette.background, borderColor: palette.border }]}
    >
      <View style={styles.icon}>
        {presentation.showsActivity ? <ActivityIndicator color={palette.foreground} size="small" /> : icon}
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{resolvedTitle}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => [styles.retry, pressed ? styles.pressed : null]}
        >
          <Text style={[styles.retryLabel, { color: palette.foreground }]}>{retryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: touchTargets.min,
    paddingLeft: spacing.md,
  },
  copy: {
    flex: 1,
    paddingVertical: spacing.sm,
  },
  detail: {
    ...typography.meta,
    color: colors.textMuted,
    fontWeight: '500',
    marginTop: 2,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    width: 20,
  },
  pressed: {
    opacity: 0.68,
  },
  retry: {
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
    minHeight: touchTargets.min,
    minWidth: touchTargets.min,
    paddingHorizontal: spacing.md,
  },
  retryLabel: {
    ...typography.meta,
  },
  title: {
    ...typography.meta,
    color: colors.text,
  },
});
