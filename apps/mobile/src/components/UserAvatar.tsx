import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../design/tokens';

type UserAvatarProps = {
  avatarUrl: string | null;
  displayName: string | null;
  size: number;
  style?: StyleProp<ViewStyle>;
};

export function UserAvatar({ avatarUrl, displayName, size, style }: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const name = displayName?.trim() || 'Watchly member';

  useEffect(() => {
    setImageFailed(false);
  }, [avatarUrl]);

  return (
    <View
      accessibilityLabel={`${name} profile photo`}
      style={[
        styles.avatar,
        { borderRadius: size / 2, height: size, width: size },
        style,
      ]}
    >
      {avatarUrl && !imageFailed ? (
        <Image
          onError={() => setImageFailed(true)}
          resizeMode="cover"
          source={{ uri: avatarUrl }}
          style={{ borderRadius: size / 2, height: size, width: size }}
        />
      ) : (
        <Text style={[styles.initials, { fontSize: Math.max(13, Math.round(size * 0.32)) }]}>
          {getInitials(name)}
        </Text>
      )}
    </View>
  );
}

export function getInitials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'W';
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    color: colors.accentText,
    fontWeight: '900',
  },
});
