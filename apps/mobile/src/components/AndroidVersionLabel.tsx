import { requireOptionalNativeModule } from 'expo';
import { Platform, StyleSheet, Text } from 'react-native';
import appConfig from '../../app.json';
import { colors, typography } from '../design/tokens';

export function AndroidVersionLabel() {
  if (Platform.OS !== 'android') return null;

  return <Text selectable style={styles.version}>{getAndroidVersionLabel()}</Text>;
}

function getAndroidVersionLabel() {
  const application = requireOptionalNativeModule<{
    nativeApplicationVersion?: string;
    nativeBuildVersion?: string;
  }>('ExpoApplication');
  const updates = requireOptionalNativeModule<{
    isEnabled?: boolean;
    isEmbeddedLaunch?: boolean;
    updateId?: string;
  }>('ExpoUpdates');
  const version = application?.nativeApplicationVersion ?? appConfig.expo.version;
  const build = application?.nativeBuildVersion ? ` (${application.nativeBuildVersion})` : '';
  const release = __DEV__ ? 'Development'
    : updates?.isEnabled && !updates.isEmbeddedLaunch && updates.updateId
      ? `Update ${updates.updateId.slice(-8).toLowerCase()}`
      : 'Original';
  return `APK ${version}${build} · ${release}`;
}

const styles = StyleSheet.create({
  version: {
    ...typography.meta,
    color: colors.textSubtle,
    textAlign: 'center',
  },
});
