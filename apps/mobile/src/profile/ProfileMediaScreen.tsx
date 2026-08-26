import { useCallback, useMemo } from 'react';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { Screen } from '../components/Screen';
import { SpotlightAtmosphere } from '../components/SpotlightAtmosphere';
import { colors, spacing } from '../design/tokens';
import type { LibraryMediaItem } from '../library/useLibraryData';
import { useLibraryData } from '../library/useLibraryData';
import type { RootStackParamList } from '../navigation/types';
import { ProfileMediaRail } from './ProfileMediaRail';
import { getProfileMediaItems, groupProfileMediaByStatus } from './profileMediaModel';

type Navigation = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'ProfileMedia'>;

export function ProfileMediaScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<Route>();
  const providedItems = route.params.items;
  const usesProvidedItems = providedItems !== undefined;
  const resource = useLibraryData(!usesProvidedItems);
  const sourceItems = useMemo(
    () => getProfileMediaItems(providedItems ?? resource.data?.items ?? [], route.params.filter),
    [providedItems, resource.data?.items, route.params.filter],
  );
  const groups = useMemo(() => groupProfileMediaByStatus(sourceItems), [sourceItems]);
  const atmosphereUrl = route.params.profileBackdropUrl
    ?? sourceItems[0]?.backdropUrl
    ?? sourceItems[0]?.posterUrl
    ?? null;

  const openItem = useCallback((item: LibraryMediaItem) => {
    if (item.contentType === 'movie') {
      navigation.navigate('FilmDetail', { title: item.title, tmdbId: item.tmdbId });
    } else {
      navigation.navigate('SeriesDetail', { title: item.title, tmdbId: item.tmdbId });
    }
  }, [navigation]);

  return (
    <Screen
      background={atmosphereUrl ? <SpotlightAtmosphere imageUrl={atmosphereUrl} /> : null}
      refreshControl={usesProvidedItems ? undefined : (
        <RefreshControl
          colors={[colors.accent]}
          onRefresh={resource.retry}
          refreshing={resource.isRefreshing}
          tintColor={colors.accent}
        />
      )}
      title=""
    >
      {!usesProvidedItems && resource.isInitialLoading && !resource.data ? (
        <LoadingState label="Loading your titles" />
      ) : !usesProvidedItems && resource.error && !resource.data ? (
        <EmptyState body={resource.error} title="Titles unavailable">
          <Button label="Retry" onPress={resource.retry} />
        </EmptyState>
      ) : (
        <View style={styles.content}>
          {route.params.filter !== 'movies' ? (
            <ProfileMediaRail
              emptyLabel="Nothing in progress right now."
              items={groups.inProgress}
              onOpen={openItem}
              title="In progress"
            />
          ) : null}
          <ProfileMediaRail
            emptyLabel="No planned titles yet."
            items={groups.planned}
            onOpen={openItem}
            title="Planned"
          />
          <ProfileMediaRail
            emptyLabel="No completed titles yet."
            items={groups.completed}
            onOpen={openItem}
            title="Completed"
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xxl,
    paddingTop: spacing.xxxl + spacing.md,
  },
});
