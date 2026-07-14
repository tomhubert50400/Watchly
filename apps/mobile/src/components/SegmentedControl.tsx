import { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleProp, StyleSheet, Text, TextStyle, useWindowDimensions, View, ViewStyle } from 'react-native';
import { colors, radii, spacing, touchTargets } from '../design/tokens';
import { resolveDynamicTypeLayout } from './dynamicTypeLayout';

type SegmentedControlOption<T extends string> = {
  accessibilityLabel?: string;
  label: string;
  render?: (state: { selected: boolean }) => ReactNode;
  value: T;
};

type SegmentedControlProps<T extends string> = {
  buttonMinHeight?: number;
  containerStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  labelStyle?: StyleProp<TextStyle>;
  onChange: (value: T) => void;
  options: SegmentedControlOption<T>[];
  selectedLabelStyle?: StyleProp<TextStyle>;
  value: T | null;
};

const controlGap = 3;
const controlPadding = 3;

export function SegmentedControl<T extends string>({
  buttonMinHeight = 40,
  containerStyle,
  disabled = false,
  labelStyle,
  onChange,
  options,
  selectedLabelStyle,
  value,
}: SegmentedControlProps<T>) {
  const { fontScale } = useWindowDimensions();
  const dynamicTypeLayout = resolveDynamicTypeLayout(fontScale);
  const [controlWidth, setControlWidth] = useState(0);
  const buttonHeight = Math.max(buttonMinHeight, touchTargets.min, dynamicTypeLayout.segmentMinHeight);
  const initialIndex = options.findIndex((option) => option.value === value);
  const selectionProgress = useRef(new Animated.Value(Math.max(initialIndex, 0))).current;
  const selectedIndex = options.findIndex((option) => option.value === value);
  const indicatorWidth =
    options.length > 0
      ? Math.max((controlWidth - controlPadding * 2 - controlGap * (options.length - 1)) / options.length, 0)
      : 0;
  const translateX = selectionProgress.interpolate({
    inputRange: options.length > 0 ? options.map((_, index) => index) : [0],
    outputRange: options.length > 0 ? options.map((_, index) => index * (indicatorWidth + controlGap)) : [0],
  });

  useEffect(() => {
    if (selectedIndex >= 0) {
      Animated.timing(selectionProgress, {
        duration: 210,
        easing: Easing.out(Easing.cubic),
        toValue: selectedIndex,
        useNativeDriver: true,
      }).start();
    }
  }, [selectedIndex, selectionProgress]);

  return (
    <View
      onLayout={(event) => setControlWidth(event.nativeEvent.layout.width)}
      style={[
        styles.control,
        dynamicTypeLayout.segmentStacked && styles.controlStacked,
        disabled && styles.controlDisabled,
        containerStyle,
      ]}
    >
      {!dynamicTypeLayout.segmentStacked && indicatorWidth > 0 && selectedIndex >= 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            {
              transform: [{ translateX }],
              width: indicatorWidth,
            },
          ]}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <Pressable
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityRole="button"
            accessibilityState={{ disabled, selected }}
            disabled={disabled}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.button,
              { minHeight: buttonHeight },
              dynamicTypeLayout.segmentStacked && styles.buttonStacked,
              dynamicTypeLayout.segmentStacked && selected && styles.buttonStackedSelected,
              pressed && styles.pressed,
            ]}
          >
            {option.render ? (
              option.render({ selected })
            ) : (
              <Text
                numberOfLines={dynamicTypeLayout.segmentNumberOfLines}
                style={[styles.label, labelStyle, selected && styles.labelSelected, selected && selectedLabelStyle]}
              >
                {option.label}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: radii.sm,
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: spacing.sm,
    zIndex: 1,
  },
  buttonStacked: {
    flex: 0,
    width: '100%',
  },
  buttonStackedSelected: {
    backgroundColor: colors.segmentSelected,
    borderColor: colors.segmentSelectedBorder,
    borderWidth: 1,
  },
  control: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: controlGap,
    padding: controlPadding,
  },
  controlDisabled: {
    opacity: 0.55,
  },
  controlStacked: {
    flexDirection: 'column',
  },
  indicator: {
    backgroundColor: colors.segmentSelected,
    borderColor: colors.segmentSelectedBorder,
    borderRadius: radii.sm,
    borderWidth: 1,
    bottom: controlPadding,
    left: controlPadding,
    position: 'absolute',
    top: controlPadding,
  },
  label: {
    color: colors.textSubtle,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  labelSelected: {
    color: colors.segmentSelectedText,
  },
  pressed: {
    opacity: 0.78,
  },
});
