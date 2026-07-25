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
  JSON.stringify(routeNames) === JSON.stringify(['Home', 'Explore', 'Library', 'Profile']),
  'Main tabs must remain Home, Explore, Library, Profile in that order.',
);
assert(
  JSON.stringify(labels) === JSON.stringify(['Home', 'Explore', 'Library', 'Profile']),
  'Main tab labels must match the approved architecture.',
);
assert(!routeNames.includes('Feed'), 'Feed must not remain a primary tab route.');
assert(!routeNames.includes('MyTV'), 'MyTV must be replaced by Library.');

const appSource = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
const packageJson = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as {
  dependencies: Record<string, string>;
};
const tabBarStyle = appSource.match(/tabBar: \{(?<style>[\s\S]*?)\n  \},/)?.groups?.style ?? '';

assert(
  packageJson.dependencies['@react-navigation/bottom-tabs'] === '7.8.12' &&
    packageJson.dependencies['react-native-screens'] === '4.18.0',
  'Native tabs must use the compatible pre-Tabs.Host dependency pair.',
);
assert(
  appSource.includes(
    "import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';",
  ) &&
    appSource.includes('const NativeTabs = createNativeBottomTabNavigator<RootTabParamList>();') &&
    appSource.includes("type: 'sfSymbol'") &&
    appSource.includes("Platform.OS === 'ios'") &&
    appSource.includes(
      'Constants.executionEnvironment !== ExecutionEnvironment.StoreClient',
    ),
  'A development build on iOS must use native tabs and SF Symbols, while Expo Go must retain the compatible fallback.',
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
