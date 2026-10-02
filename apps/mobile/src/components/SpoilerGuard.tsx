import { useId, useState, type PropsWithChildren } from 'react';
import { EyeOff } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors, spacing, touchTargets } from '../design/tokens';

export function SpoilerGuard({ children, reason, revealKey, canReveal = true }: PropsWithChildren<{ reason?: string | null; revealKey: string; canReveal?: boolean }>) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const veilId = `spoiler-veil-${useId().replace(/:/g, '')}`;
  const hidden = Boolean(reason) && (revealed !== revealKey || !canReveal);
  return <View style={[styles.container, hidden && styles.protected]}>
    <View aria-hidden={hidden} accessibilityElementsHidden={hidden} importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'} pointerEvents={hidden ? 'none' : 'auto'} style={hidden ? styles.concealed : null}>{children}</View>
    {hidden ? <>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.veil}>
        <Svg width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
          <Defs>
            <RadialGradient id={veilId} cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor={colors.background} stopOpacity={0.8} />
              <Stop offset="0.35" stopColor={colors.background} stopOpacity={0.72} />
              <Stop offset="0.6" stopColor={colors.background} stopOpacity={0.42} />
              <Stop offset="0.8" stopColor={colors.background} stopOpacity={0.14} />
              <Stop offset="0.94" stopColor={colors.background} stopOpacity={0.02} />
              <Stop offset="1" stopColor={colors.background} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width="1" height="1" fill={`url(#${veilId})`} />
        </Svg>
      </View>
      <View style={styles.overlay}>
        <Text style={styles.reason}>{reason}</Text>
        {canReveal ? <Pressable accessibilityRole="button" accessibilityLabel="Reveal this review" onPress={() => setRevealed(revealKey)} style={styles.button}>
          <EyeOff size={18} color={colors.accentText} />
          <Text style={styles.label}>Reveal review</Text>
        </Pressable> : null}
      </View>
    </> : null}
  </View>;
}
const styles = StyleSheet.create({
  container: { position: 'relative' },
  protected: { minHeight: 112 },
  concealed: { opacity: 0 },
  veil: { ...StyleSheet.absoluteFillObject, left: -spacing.sm, right: -spacing.sm },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.sm },
  reason: { color: colors.text, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: touchTargets.min, paddingHorizontal: spacing.md, backgroundColor: colors.accentSoft, borderColor: colors.accentBorder, borderWidth: 1, borderRadius: 12 },
  label: { color: colors.accentText, fontSize: 14, fontWeight: '800' },
});
