import { HeaderHeightContext, HeaderShownContext } from '@react-navigation/elements';
import { useContext } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useContentHeaderHeight() {
  const height = useContext(HeaderHeightContext) ?? 0;
  const shown = useContext(HeaderShownContext);
  const insets = useSafeAreaInsets();
  // Transparent native headers can report zero on Android. Match native-stack's 56dp toolbar.
  return Platform.OS === 'android' && shown && height === 0 ? 56 + insets.top : height;
}
