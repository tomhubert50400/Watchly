import { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { colors, radii, spacing, typography } from '../design/tokens';

type ChipTone = 'accent' | 'neutral' | 'rating' | 'success';

type ChipProps = {
  icon?: ReactNode;
  label: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  tone?: ChipTone;
};

export function Chip({ icon, label, style, textStyle, tone = 'neutral' }: ChipProps) {
  return (
    <View style={[styles.base, toneStyles[tone], style]}>
      {icon}
      <Text numberOfLines={1} style={[styles.label, labelToneStyles[tone], textStyle]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radii.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 26,
    paddingHorizontal: spacing.sm,
  },
  label: {
    ...typography.meta,
    textTransform: 'uppercase',
  },
});

const toneStyles = StyleSheet.create({
  accent: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
  },
  neutral: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
  },
  rating: {
    backgroundColor: colors.ratingSoft,
    borderColor: colors.ratingBorder,
  },
  success: {
    backgroundColor: colors.successBackground,
    borderColor: colors.successBorder,
  },
});

const labelToneStyles = StyleSheet.create({
  accent: {
    color: colors.accentText,
  },
  neutral: {
    color: colors.textMuted,
  },
  rating: {
    color: colors.rating,
  },
  success: {
    color: colors.success,
  },
});
