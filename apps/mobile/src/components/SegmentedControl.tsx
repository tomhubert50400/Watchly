import { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { colors, radii, spacing } from '../design/tokens';

export type SegmentedControlOption<T extends string> = {
  accessibilityLabel?: string;
  label: string;
  render?: (state: { selected: boolean }) => ReactNode;
  value: T;
};

type SegmentedControlProps<T extends string> = {
  buttonMinHeight?: number;
  containerStyle?: StyleProp<ViewStyle>;
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
  labelStyle,
  onChange,
  options,
  selectedLabelStyle,
  value,
}: SegmentedControlProps<T>) {
  const [controlWidth, setControlWidth] = useState(0);
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
        duration: 220,
        toValue: selectedIndex,
        useNativeDriver: true,
      }).start();
    }
  }, [selectedIndex, selectionProgress]);

  return (
    <View
      onLayout={(event) => setControlWidth(event.nativeEvent.layout.width)}
      style={[styles.control, containerStyle]}
    >
      {indicatorWidth > 0 && selectedIndex >= 0 ? (
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
            accessibilityState={{ selected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.button,
              { minHeight: buttonMinHeight },
              pressed && styles.pressed,
            ]}
          >
            {option.render ? (
              option.render({ selected })
            ) : (
              <Text
                numberOfLines={1}
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
  control: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: controlGap,
    padding: controlPadding,
  },
  indicator: {
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    bottom: controlPadding,
    left: controlPadding,
    position: 'absolute',
    top: controlPadding,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  labelSelected: {
    color: colors.textOnAccent,
  },
  pressed: {
    opacity: 0.78,
  },
});
