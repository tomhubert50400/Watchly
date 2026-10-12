import { Image, type ImageProps, Platform, type StyleProp, View, type ViewStyle } from 'react-native';
import { SvgUri } from 'react-native-svg';

type Props = Omit<ImageProps, 'source'> & { source: { uri: string } };

export function MediaLogo(props: Props) {
  if (Platform.OS === 'android' && /\.svg(?:[?#]|$)/i.test(props.source.uri)) {
    return (
      <View accessible={props.accessible} accessibilityLabel={props.accessibilityLabel} style={props.style as StyleProp<ViewStyle>}>
        <SvgUri uri={props.source.uri} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" />
      </View>
    );
  }
  return <Image {...props} />;
}
