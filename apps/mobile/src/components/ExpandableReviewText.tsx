import { useEffect, useState } from 'react';
import {
  NativeSyntheticEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextLayoutEventData,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { colors, spacing, typography } from '../design/tokens';

const collapsedLineCount = 5;

type ExpandableReviewTextProps = {
  body: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function ExpandableReviewText({ body, style, textStyle }: ExpandableReviewTextProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);

  useEffect(() => {
    setIsExpanded(false);
    setCanExpand(false);
  }, [body]);

  function handleTextLayout(event: NativeSyntheticEvent<TextLayoutEventData>) {
    setCanExpand(event.nativeEvent.lines.length > collapsedLineCount);
  }

  return (
    <View style={style}>
      <Text
        numberOfLines={isExpanded ? undefined : collapsedLineCount}
        onTextLayout={handleTextLayout}
        style={[styles.body, textStyle]}
      >
        {body}
      </Text>
      {canExpand ? (
        <Pressable
          accessibilityLabel={isExpanded ? 'Collapse review' : 'Expand full review'}
          accessibilityRole="button"
          accessibilityState={{ expanded: isExpanded }}
          hitSlop={8}
          onPress={() => setIsExpanded((current) => !current)}
          style={({ pressed }) => [styles.toggle, pressed ? styles.togglePressed : null]}
        >
          <Text style={styles.toggleLabel}>{isExpanded ? 'Less' : 'More'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    ...typography.body,
    color: colors.textMuted,
  },
  toggle: {
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
    justifyContent: 'center',
    marginTop: spacing.xs,
    minHeight: 32,
  },
  toggleLabel: {
    ...typography.meta,
    color: colors.accentText,
  },
  togglePressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
});
