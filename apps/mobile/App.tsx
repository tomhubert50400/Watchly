import { NavigationContainer, useIsFocused } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Compass, House, Library, UserCircle } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthSessionProvider, useAuthSession } from './src/auth/AuthSessionContext';
import { CatalogueCacheProvider } from './src/catalogue/CatalogueCacheContext';
import { EpisodeDetailScreen } from './src/catalogue/EpisodeDetailScreen';
import { ExploreScreen } from './src/catalogue/ExploreScreen';
import { FilmDetailScreen } from './src/catalogue/FilmDetailScreen';
import { SeasonDetailScreen } from './src/catalogue/SeasonDetailScreen';
import { SeriesDetailScreen } from './src/catalogue/SeriesDetailScreen';
import { colors } from './src/design/tokens';
import { HomeScreen } from './src/home/HomeScreen';
import { JournalScreen } from './src/journal/JournalScreen';
import { LibraryScreen } from './src/library/LibraryScreen';
import { appLinking } from './src/navigation/linking';
import { detailBackOptions, resolvePreviousPageLabel, rootStackScreenOptions } from './src/navigation/stackConfig';
import { mainTabs, MainTabName } from './src/navigation/tabConfig';
import { RootStackParamList, RootTabParamList } from './src/navigation/types';
import { NotificationsScreen } from './src/notifications/NotificationsScreen';
import { ToastProvider } from './src/notifications/ToastContext';
import { OnboardingScreen } from './src/onboarding/OnboardingScreen';
import { ProfileScreen } from './src/profile/ProfileScreen';
import { PublicProfileScreen } from './src/profile/PublicProfileScreen';
import { SettingsScreen } from './src/profile/SettingsScreen';
import { ReviewDetailScreen } from './src/reviews/ReviewDetailScreen';

import { PersonalWatchlistScreen } from './src/watchlists/PersonalWatchlistScreen';
import { SharedVoteScreen } from './src/watchlists/SharedVoteScreen';
import { SharedWatchlistScreen } from './src/watchlists/SharedWatchlistScreen';
import { WatchlistCacheProvider } from './src/watchlists/WatchlistCacheContext';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<RootTabParamList>();

const tabIcons: Record<MainTabName, typeof House> = {
  Explore: Compass,
  Home: House,
  Library,
  Profile: UserCircle,
};

function ExploreTabScreen() {
  const isFocused = useIsFocused();

  return <ExploreScreen isActive={isFocused} />;
}

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => {
        const config = mainTabs.find((tab) => tab.name === route.name);
        const Icon = tabIcons[route.name];

        return {
          headerShown: false,
          tabBarAccessibilityLabel: config?.label ?? route.name,
          tabBarActiveTintColor: colors.accent,
          tabBarHideOnKeyboard: true,
          tabBarIcon: ({ color, size }) => <Icon color={color} size={size} strokeWidth={2} />,
          tabBarInactiveTintColor: colors.muted,
          tabBarItemStyle: styles.tabBarItem,
          tabBarLabel: config?.label ?? route.name,
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarStyle: styles.tabBar,
        };
      }}
    >
      <Tabs.Screen component={HomeScreen} name="Home" />
      <Tabs.Screen component={ExploreTabScreen} name="Explore" />
      <Tabs.Screen component={LibraryScreen} name="Library" />
      <Tabs.Screen component={ProfileScreen} name="Profile" />
    </Tabs.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthSessionProvider>
        <NavigationContainer linking={appLinking}>
          <ToastProvider>
            <CatalogueCacheProvider>
              <WatchlistCacheProvider>
                <AppNavigator />
              </WatchlistCacheProvider>
            </CatalogueCacheProvider>
          </ToastProvider>
        </NavigationContainer>
      </AuthSessionProvider>
    </SafeAreaProvider>
  );
}

function AppNavigator() {
  const { currentUser } = useAuthSession();
  const needsOnboarding = currentUser && !currentUser.onboardingCompleted;

  return (
    <>
      <StatusBar style="light" />
      <Stack.Navigator
        screenOptions={({ navigation }) => ({
          contentStyle: { backgroundColor: colors.background },
          ...rootStackScreenOptions,
          ...detailBackOptions(resolvePreviousPageLabel(navigation.getState().routes)),
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: styles.stackHeaderTitle,
        })}
      >
        {needsOnboarding ? (
          <Stack.Screen
            component={OnboardingScreen}
            name="Onboarding"
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <Stack.Screen component={MainTabs} name="MainTabs" options={{ headerShown: false }} />
            <Stack.Screen component={JournalScreen} name="Journal" options={{ title: 'Journal' }} />
            <Stack.Screen component={NotificationsScreen} name="Notifications" options={{ title: 'Alerts' }} />
            <Stack.Screen component={SettingsScreen} name="Settings" options={{ title: 'Settings' }} />
            <Stack.Screen
              component={SharedWatchlistScreen}
              name="SharedWatchlist"
              options={({ route }) => ({ title: route.params.title })}
            />
            <Stack.Screen
              component={SharedVoteScreen}
              name="SharedVotingSession"
              options={({ route }) => ({ title: route.params.title })}
            />
            <Stack.Screen
              component={EpisodeDetailScreen}
              name="EpisodeDetail"
              options={({ route }) => ({ title: route.params.title })}
            />
            <Stack.Screen component={FilmDetailScreen} name="FilmDetail" options={{ title: '' }} />
            <Stack.Screen
              component={PersonalWatchlistScreen}
              name="PersonalWatchlist"
              options={({ route }) => ({ title: route.params.title })}
            />
            <Stack.Screen
              component={PublicProfileScreen}
              name="PublicProfile"
              options={{ title: 'Public profile' }}
            />
            <Stack.Screen component={ReviewDetailScreen} name="ReviewDetail" options={{ title: 'Review' }} />
            <Stack.Screen
              component={SeasonDetailScreen}
              name="SeasonDetail"
              options={({ route }) => ({ title: route.params.title })}
            />
            <Stack.Screen component={SeriesDetailScreen} name="SeriesDetail" options={{ title: '' }} />
          </>
        )}
      </Stack.Navigator>
    </>
  );
}

const styles = StyleSheet.create({
  stackHeaderTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
  },
  tabBar: {
    backgroundColor: colors.panel,
    borderTopColor: colors.border,
    height: 82,
    paddingBottom: 14,
    paddingTop: 10,
  },
  tabBarItem: {
    minHeight: 58,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 12,
  },
});
