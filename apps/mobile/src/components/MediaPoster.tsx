import { Search } from 'lucide-react-native';
import { Image, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radii } from '../design/tokens';

type MediaPosterProps = {
  accessibilityLabel?: string;
  posterUrl: string | null;
  style?: StyleProp<ViewStyle>;
};

export function MediaPoster({ accessibilityLabel, posterUrl, style }: MediaPosterProps) {
  return (
    <View style={[styles.frame, style]}>
      {posterUrl ? (
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel={accessibilityLabel}
          source={{ uri: posterUrl }}
          style={styles.image}
        />
      ) : (
        <View style={styles.placeholder}>
          <Search color={colors.textSubtle} size={22} strokeWidth={2} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  image: {
    height: '100%',
    width: '100%',
  },
  placeholder: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
});
