import { useEffect, useMemo, useRef, useState } from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Home, Search, Settings, Tv, UserCircle } from 'lucide-react-native';
import { Animated, Easing, PanResponder, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthSessionProvider } from './src/auth/AuthSessionContext';
import { ProfileAuthCard } from './src/auth/ProfileAuthCard';
import { EpisodeDetailScreen } from './src/catalogue/EpisodeDetailScreen';
import { ExploreScreen } from './src/catalogue/ExploreScreen';
import { FilmDetailScreen } from './src/catalogue/FilmDetailScreen';
import { SeasonDetailScreen } from './src/catalogue/SeasonDetailScreen';
import { SeriesDetailScreen } from './src/catalogue/SeriesDetailScreen';
import { EmptyState } from './src/components/EmptyState';
import { IconButton } from './src/components/IconButton';
import { Screen } from './src/components/Screen';
import { colors } from './src/design/tokens';
import { FeedScreen } from './src/feed/FeedScreen';
import { RootStackParamList } from './src/navigation/types';
import { PublicProfileScreen } from './src/profile/PublicProfileScreen';
import { SettingsScreen } from './src/profile/SettingsScreen';
import { MyTvScreen } from './src/tracking/MyTvScreen';
import { SharedWatchlistScreen } from './src/watchlists/SharedWatchlistScreen';

type TabParamList = {
  Feed: undefined;
  Explore: undefined;
  MyTV: undefined;
  Profile: undefined;
};

type TabRoute = keyof TabParamList;

type AppScreenProps = {
  body: string;
  emptyTitle: string;
  headline: string;
  showSettings?: boolean;
};

type TabContent = AppScreenProps & {
  Icon: typeof Home;
  label: string;
};

type AppNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const Stack = createNativeStackNavigator<RootStackParamList>();
const tabOrder: TabRoute[] = ['Feed', 'Explore', 'MyTV', 'Profile'];

const tabs: Record<TabRoute, TabContent> = {
  Feed: {
    Icon: Home,
    body: 'Follow people you trust and their public reviews will shape this feed.',
    emptyTitle: 'No reviews from your circle yet',
    headline: 'Track what matters next',
    label: 'Feed',
  },
  Explore: {
    Icon: Search,
    body: 'Search will connect to the catalogue provider in the next milestone.',
    emptyTitle: 'Search is not connected yet',
    headline: 'Find films and series fast',
    label: 'Explore',
  },
  MyTV: {
    Icon: Tv,
    body: 'Your films, series, progress, lists, and shared voting sessions will live here.',
    emptyTitle: 'Your TV space is empty for now',
    headline: 'Manage your watch life',
    label: 'My TV',
  },
  Profile: {
    Icon: UserCircle,
    body: 'Public reviews will appear here. Viewing history stays private by default.',
    emptyTitle: 'No public profile activity yet',
    headline: 'Your public shelf',
    label: 'Profile',
    showSettings: true,
  },
};

function AppScreen({ body, children, emptyTitle, headline, showSettings }: React.PropsWithChildren<AppScreenProps>) {
  const navigation = useNavigation<AppNavigationProp>();

  return (
    <Screen
      title={headline}
      trailing={
        showSettings ? (
          <IconButton
            accessibilityLabel="Open settings"
            icon={<Settings color={colors.text} size={22} strokeWidth={2} />}
            onPress={() => navigation.navigate('Settings')}
          />
        ) : undefined
      }
    >
      <EmptyState body={body} title={emptyTitle} />
      {children}
    </Screen>
  );
}

function ProfileScreen() {
  return (
    <AppScreen {...tabs.Profile}>
      <ProfileAuthCard />
    </AppScreen>
  );
}

function tabIcon(routeName: TabRoute, color: string, size: number) {
  const Icon = tabs[routeName].Icon;
  return (
    <View style={styles.tabIconFrame}>
      <Icon color={color} size={size} strokeWidth={2} />
    </View>
  );
}

function renderTabScreen(routeName: TabRoute) {
  if (routeName === 'Feed') {
    return <FeedScreen />;
  }

  if (routeName === 'Explore') {
    return <ExploreScreen />;
  }

  if (routeName === 'MyTV') {
    return <MyTvScreen />;
  }

  return <ProfileScreen />;
}

function clampPagerOffset(value: number, width: number) {
  const min = -(tabOrder.length - 1) * width;

  if (value > 0) {
    return value * 0.28;
  }

  if (value < min) {
    return min + (value - min) * 0.28;
  }

  return value;
}

function MainTabs() {
  const { width } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(activeIndex);
  const currentOffsetRef = useRef(0);
  const dragStartRef = useRef(0);
  const gestureReadyRef = useRef(true);
  const isDraggingRef = useRef(false);
  const pendingGestureDxRef = useRef(0);
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    const offset = -activeIndexRef.current * width;

    currentOffsetRef.current = offset;
    dragStartRef.current = offset;
    translateX.setValue(offset);
  }, [translateX, width]);

  const animateToIndex = useMemo(
    () => (nextIndex: number) => {
      const index = Math.max(0, Math.min(nextIndex, tabOrder.length - 1));

      setActiveIndex(index);
      activeIndexRef.current = index;
      currentOffsetRef.current = -index * width;

      Animated.timing(translateX, {
        duration: 240,
        easing: Easing.out(Easing.cubic),
        toValue: -index * width,
        useNativeDriver: true,
      }).start();
    },
    [translateX, width],
  );

  const pagerResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.25,
        onPanResponderGrant: () => {
          isDraggingRef.current = true;
          gestureReadyRef.current = false;
          pendingGestureDxRef.current = 0;
          translateX.stopAnimation((value) => {
            if (!isDraggingRef.current) {
              return;
            }

            currentOffsetRef.current = value;
            dragStartRef.current = value;
            gestureReadyRef.current = true;

            if (pendingGestureDxRef.current !== 0) {
              const nextOffset = clampPagerOffset(
                dragStartRef.current + pendingGestureDxRef.current,
                width,
              );

              currentOffsetRef.current = nextOffset;
              translateX.setValue(nextOffset);
            }
          });
        },
        onPanResponderMove: (_, gesture) => {
          if (!gestureReadyRef.current) {
            pendingGestureDxRef.current = gesture.dx;
            return;
          }

          const nextOffset = clampPagerOffset(dragStartRef.current + gesture.dx, width);

          currentOffsetRef.current = nextOffset;
          translateX.setValue(nextOffset);
        },
        onPanResponderRelease: (_, gesture) => {
          isDraggingRef.current = false;
          gestureReadyRef.current = true;
          pendingGestureDxRef.current = 0;
          const currentIndex = activeIndexRef.current;
          const shouldMove =
            Math.abs(gesture.dx) > width * 0.2 || Math.abs(gesture.vx) > 0.65;
          const direction = gesture.dx < 0 ? 1 : -1;
          const nextIndex = shouldMove ? currentIndex + direction : currentIndex;

          animateToIndex(nextIndex);
        },
        onPanResponderTerminate: () => {
          isDraggingRef.current = false;
          gestureReadyRef.current = true;
          pendingGestureDxRef.current = 0;
          animateToIndex(activeIndexRef.current);
        },
      }),
    [animateToIndex, translateX, width],
  );

  return (
    <View style={styles.mainTabs}>
      <View style={styles.pagerViewport} {...pagerResponder.panHandlers}>
        <Animated.View
          style={[
            styles.pagerTrack,
            {
              transform: [{ translateX }],
              width: width * tabOrder.length,
            },
          ]}
        >
          {tabOrder.map((routeName, index) => (
            <View
              accessibilityElementsHidden={index !== activeIndex}
              importantForAccessibility={index === activeIndex ? 'auto' : 'no-hide-descendants'}
              key={routeName}
              style={[styles.page, { width }]}
            >
              {renderTabScreen(routeName)}
            </View>
          ))}
        </Animated.View>
      </View>
      <SafeAreaView edges={['bottom']} style={styles.tabBarSafe}>
        <View style={styles.tabBar}>
          {tabOrder.map((routeName, index) => {
            const isActive = index === activeIndex;
            const color = isActive ? colors.accent : colors.muted;

            return (
              <Pressable
                accessibilityLabel={tabs[routeName].label}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                key={routeName}
                onPress={() => animateToIndex(index)}
                style={({ pressed }) => [
                  styles.tabButton,
                  pressed && styles.tabButtonPressed,
                ]}
              >
                {tabIcon(routeName, color, 24)}
                <Text style={[styles.tabLabel, { color }]}>{tabs[routeName].label}</Text>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthSessionProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <Stack.Navigator
            screenOptions={{
              contentStyle: { backgroundColor: colors.background },
              headerShadowVisible: false,
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.text,
              headerTitleStyle: styles.stackHeaderTitle,
            }}
          >
            <Stack.Screen
              component={MainTabs}
              name="MainTabs"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              component={SettingsScreen}
              name="Settings"
              options={{ title: 'Settings' }}
            />
            <Stack.Screen
              component={SharedWatchlistScreen}
              name="SharedWatchlist"
              options={({ route }) => ({ title: route.params.title })}
            />
            <Stack.Screen
              component={EpisodeDetailScreen}
              name="EpisodeDetail"
              options={({ route }) => ({ title: route.params.title })}
            />
            <Stack.Screen
              component={FilmDetailScreen}
              name="FilmDetail"
              options={({ route }) => ({ title: route.params.title })}
            />
            <Stack.Screen
              component={PublicProfileScreen}
              name="PublicProfile"
              options={{ title: 'Public profile' }}
            />
            <Stack.Screen
              component={SeasonDetailScreen}
              name="SeasonDetail"
              options={({ route }) => ({ title: route.params.title })}
            />
            <Stack.Screen
              component={SeriesDetailScreen}
              name="SeriesDetail"
              options={({ route }) => ({ title: route.params.title })}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </AuthSessionProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  mainTabs: {
    backgroundColor: colors.background,
    flex: 1,
  },
  page: {
    flex: 1,
  },
  pagerTrack: {
    flex: 1,
    flexDirection: 'row',
  },
  pagerViewport: {
    flex: 1,
    overflow: 'hidden',
  },
  stackHeaderTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
  },
  tabBar: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    height: 82,
    paddingBottom: 14,
    paddingTop: 10,
  },
  tabBarSafe: {
    backgroundColor: colors.panel,
  },
  tabButton: {
    alignItems: 'center',
    flex: 1,
    gap: 5,
    height: 58,
    justifyContent: 'center',
  },
  tabButtonPressed: {
    opacity: 0.72,
  },
  tabIconFrame: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    width: 28,
  },
  tabLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0, lineHeight: 12 },
});
