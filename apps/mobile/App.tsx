import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, NavigatorScreenParams, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Home, ListChecks, Search, Settings, UserCircle } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

type TabParamList = {
  HomeFeed: undefined;
  SearchDiscover: undefined;
  Watchlists: undefined;
  Profile: undefined;
};

type RootStackParamList = {
  MainTabs: NavigatorScreenParams<TabParamList>;
  Settings: undefined;
};

type TabRoute = keyof TabParamList;

type ScreenProps = {
  body: string;
  eyebrow: string;
  title: string;
  showSettings?: boolean;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const tabs: Record<
  TabRoute,
  ScreenProps & { Icon: typeof Home; label: string }
> = {
  HomeFeed: {
    Icon: Home,
    body: 'Public reviews from followed people will appear here.',
    eyebrow: 'Followed reviews',
    label: 'Home/Feed',
    title: 'No feed items yet',
  },
  SearchDiscover: {
    Icon: Search,
    body: 'Films and shows will appear here after search is connected.',
    eyebrow: 'Catalogue',
    label: 'Search/Discover',
    title: 'No catalogue results yet',
  },
  Watchlists: {
    Icon: ListChecks,
    body: 'Personal lists and shared voting sessions will appear here.',
    eyebrow: 'Personal and shared',
    label: 'Watchlists',
    title: 'No watchlists yet',
  },
  Profile: {
    Icon: UserCircle,
    body: 'Reviews visible on your profile will appear here.',
    eyebrow: 'Public profile',
    label: 'Profile',
    showSettings: true,
    title: 'No profile activity yet',
  },
};

function AppScreen({ body, eyebrow, showSettings, title }: ScreenProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.heading}>{showSettings ? 'Profile' : eyebrow}</Text>
        </View>
        {showSettings ? (
          <Pressable
            accessibilityLabel="Open settings"
            accessibilityRole="button"
            onPress={() => navigation.navigate('Settings')}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Settings color="#111827" size={22} strokeWidth={2} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyBody}>{body}</Text>
      </View>
    </View>
  );
}

function HomeFeedScreen() {
  return <AppScreen {...tabs.HomeFeed} />;
}

function SearchDiscoverScreen() {
  return <AppScreen {...tabs.SearchDiscover} />;
}

function WatchlistsScreen() {
  return <AppScreen {...tabs.Watchlists} />;
}

function ProfileScreen() {
  return <AppScreen {...tabs.Profile} />;
}

function SettingsScreen() {
  return (
    <AppScreen
      body="This area is empty for now."
      eyebrow="Account"
      title="No settings yet"
    />
  );
}

function tabIcon(routeName: TabRoute, color: string, size: number) {
  const Icon = tabs[routeName].Icon;
  return <Icon color={color} size={size} strokeWidth={2} />;
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#111827',
        tabBarInactiveTintColor: '#6B7280',
        tabBarIcon: ({ color, size }) => tabIcon(route.name, color, size),
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: styles.tabBar,
      })}
    >
      <Tab.Screen
        component={HomeFeedScreen}
        name="HomeFeed"
        options={{ title: tabs.HomeFeed.label }}
      />
      <Tab.Screen
        component={SearchDiscoverScreen}
        name="SearchDiscover"
        options={{ title: tabs.SearchDiscover.label }}
      />
      <Tab.Screen
        component={WatchlistsScreen}
        name="Watchlists"
        options={{ title: tabs.Watchlists.label }}
      />
      <Tab.Screen component={ProfileScreen} name="Profile" />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Stack.Navigator>
          <Stack.Screen
            component={MainTabs}
            name="MainTabs"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            component={SettingsScreen}
            name="Settings"
            options={{ headerShadowVisible: false, title: 'Settings' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  emptyBody: { color: '#475569', fontSize: 15, letterSpacing: 0, lineHeight: 22, marginTop: 8 },
  emptyState: { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', borderRadius: 8, borderWidth: 1, marginTop: 32, padding: 20 },
  emptyTitle: { color: '#111827', fontSize: 18, fontWeight: '700', letterSpacing: 0, lineHeight: 24 },
  eyebrow: { color: '#64748B', fontSize: 13, fontWeight: '700', letterSpacing: 0, marginBottom: 10, textTransform: 'uppercase' },
  header: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  heading: { color: '#111827', fontSize: 34, fontWeight: '800', letterSpacing: 0, lineHeight: 40 },
  iconButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#D1D5DB', borderRadius: 8, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  screen: { backgroundColor: '#F8FAFC', flex: 1, paddingHorizontal: 24, paddingTop: 68 },
  tabBar: { borderTopColor: '#E5E7EB', height: 64, paddingBottom: 8, paddingTop: 8 },
  tabLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0 },
});
