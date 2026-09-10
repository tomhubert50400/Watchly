import { useState, type PropsWithChildren } from 'react';
import { BlurView } from 'expo-blur';
import { EyeOff } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, touchTargets } from '../design/tokens';

export function SpoilerGuard({ children, reason, contextLabel, revealKey, canReveal = true }: PropsWithChildren<{ reason?: string | null; contextLabel?: string; revealKey: string; canReveal?: boolean }>) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const hidden = Boolean(reason) && (revealed !== revealKey || !canReveal);
  return <View style={[styles.container, hidden && styles.protected]}>
    <View aria-hidden={hidden} accessibilityElementsHidden={hidden} importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'} pointerEvents={hidden ? 'none' : 'auto'}>{children}</View>
    {hidden ? <>
      <BlurView experimentalBlurMethod="dimezisBlurView" intensity={80} tint="dark" pointerEvents="none" style={styles.blur} />
      <View style={styles.overlay}>
        {contextLabel ? <Text numberOfLines={2} style={styles.context}>{contextLabel}</Text> : null}
        <Text style={styles.reason}>{reason}</Text>
        {canReveal ? <Pressable accessibilityRole="button" accessibilityLabel="Reveal this post" onPress={() => setRevealed(revealKey)} style={styles.button}>
          <EyeOff size={18} color={colors.accentText} />
          <Text style={styles.label}>Reveal post</Text>
        </Pressable> : null}
      </View>
    </> : null}
  </View>;
}
const styles = StyleSheet.create({
  container: { position: 'relative' },
  protected: { minHeight: 150 },
  context: { color: colors.text, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  blur: { ...StyleSheet.absoluteFillObject, borderRadius: radii.lg, overflow: 'hidden' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.sm },
  reason: { color: colors.text, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minHeight: touchTargets.min, paddingHorizontal: spacing.md, backgroundColor: colors.accentSoft, borderColor: colors.accentBorder, borderWidth: 1, borderRadius: 12 },
  label: { color: colors.accentText, fontSize: 14, fontWeight: '800' },
});
