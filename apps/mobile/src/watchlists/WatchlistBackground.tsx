import { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { SpotlightAtmosphere } from '../components/SpotlightAtmosphere';
import { colors } from '../design/tokens';

export function WatchlistBackground({ imageUrl }: { imageUrl: string | null }) {
  const gradientId = `watchlist-background-${useId().replace(/:/g, '')}`;
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
    <Svg width="100%" height="100%">
      <Defs>
        <RadialGradient id={gradientId} cx="20%" cy="10%" rx="100%" ry="80%">
          <Stop offset="0" stopColor={colors.secondary} stopOpacity={0.28} />
          <Stop offset="0.5" stopColor={colors.accent} stopOpacity={0.12} />
          <Stop offset="1" stopColor={colors.background} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={colors.background} />
      <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
    </Svg>
    <SpotlightAtmosphere imageUrl={imageUrl} />
  </View>;
}
