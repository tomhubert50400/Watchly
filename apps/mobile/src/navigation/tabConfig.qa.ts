// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';
import { mainTabs } from './tabConfig';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const routeNames: string[] = mainTabs.map((tab) => tab.name);
const labels: string[] = mainTabs.map((tab) => tab.label);

assert(
  JSON.stringify(routeNames) === JSON.stringify(['Home', 'Explore', 'Community', 'Library', 'Profile']),
  'Main tabs must remain Home, Explore, Community, Library, Profile in that order.',
);
assert(
  JSON.stringify(labels) === JSON.stringify(['Home', 'Discover', 'Community', 'Library', 'Profile']),
  'Main tab labels must match the approved architecture.',
);
assert(!routeNames.includes('Feed'), 'Feed must not remain a primary tab route.');
assert(!routeNames.includes('MyTV'), 'MyTV must be replaced by Library.');

const appSource = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
const publicProfileSource = readFileSync(
  new URL('../profile/PublicProfileScreen.tsx', import.meta.url),
  'utf8',
);
const packageJson = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as {
  dependencies: Record<string, string>;
};
const workspaceSource = readFileSync(
  new URL('../../../../pnpm-workspace.yaml', import.meta.url),
  'utf8',
);
const screensPatch = readFileSync(
  new URL('../../../../patches/react-native-screens@4.16.0.patch', import.meta.url),
  'utf8',
);
const tabBarStyle = appSource.match(/tabBar: \{(?<style>[\s\S]*?)\n  \},/)?.groups?.style ?? '';

assert(
  appSource.includes("import { FeedScreen } from './src/feed/FeedScreen';") &&
    appSource.includes('<NativeTabs.Screen component={FeedScreen} name="Community" />') &&
    appSource.includes('<Tabs.Screen component={FeedScreen} name="Community" />'),
  'Community must render the existing social feed in both native and fallback tabs.',
);

assert(
  packageJson.dependencies['@react-navigation/bottom-tabs'] === '7.8.12' &&
    packageJson.dependencies['react-native-screens'] === '4.16.0' &&
    workspaceSource.includes(
      'react-native-screens@4.16.0: patches/react-native-screens@4.16.0.patch',
    ) &&
    screensPatch.includes("resolvedIcon.type === 'sfSymbol'") &&
    screensPatch.includes('iconSfSymbolName: resolvedIcon.name'),
  'Native tabs must retain the SDK 54 screens binary and its SF Symbol compatibility patch.',
);
assert(
  appSource.includes(
    "import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';",
  ) &&
    appSource.includes('const NativeTabs = createNativeBottomTabNavigator<RootTabParamList>();') &&
    appSource.includes("type: 'sfSymbol'") &&
    appSource.includes("Platform.OS === 'ios'") &&
    appSource.includes('Constants.appOwnership !== AppOwnership.Expo') &&
    appSource.includes(
      'Constants.executionEnvironment !== ExecutionEnvironment.StoreClient',
    ),
  'A development build on iOS must use native tabs and SF Symbols, while Expo Go must retain the compatible fallback.',
);
assert(
  appSource.includes('const ExploreStack = createNativeStackNavigator<ExploreStackParamList>();') &&
    appSource.includes('<ExploreStack.Screen component={PublicProfileScreen} name="PublicProfile" />') &&
    appSource.includes('<NativeTabs.Screen component={ExploreNavigator} name="Explore" />') &&
    appSource.includes('<Tabs.Screen component={ExploreNavigator} name="Explore" />') &&
    !appSource.includes("options={{ title: 'Public profile' }}"),
  'Public profiles opened from Explore must stay inside the Explore tab without a stack header.',
);
assert(
  !publicProfileSource.includes('BrandWordmark') &&
    publicProfileSource.includes('tabBarPadding') &&
    publicProfileSource.includes('accessibilityLabel="Back"') &&
    publicProfileSource.includes('onPress={() => navigation.goBack()}'),
  'Public profiles must omit the Watchly wordmark, keep an accessible back action, and reserve space for the persistent tab bar.',
);
assert(
  !appSource.includes("from 'expo-glass-effect';") && !appSource.includes('<GlassView'),
  'The tab bar must not simulate Liquid Glass with a background GlassView.',
);
assert(
  tabBarStyle.includes("backgroundColor: 'transparent'"),
  'The main tab bar must remain transparent.',
);
assert(
  tabBarStyle.includes("position: 'absolute'"),
  'The main tab bar must overlay screen content so its transparency is visible.',
);
assert(
  tabBarStyle.includes('borderTopWidth: 0') &&
    tabBarStyle.includes('elevation: 0') &&
    tabBarStyle.includes('shadowOpacity: 0'),
  'The transparent tab bar must not retain a border or platform shadow.',
);

console.log('Tab config QA passed.');
