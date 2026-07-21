import { useCallback, useEffect, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { PersonalWatchlist } from '../api/watchlists';
import { useAuthSession } from '../auth/AuthSessionContext';
import { SignInRequiredCard } from '../auth/SignInRequired';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { SectionHeader } from '../components/SectionHeader';
import { colors, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import {
  WatchlistDisplayItem,
  WatchlistPage,
  WatchlistPosterGrid,
  WatchlistSection,
} from './WatchlistDetailLayout';
import { HydratedPersonalWatchlistItem, useWatchlistCache } from './WatchlistCacheContext';

type PersonalWatchlistScreenProps = NativeStackScreenProps<RootStackParamList, 'PersonalWatchlist'>;

export function PersonalWatchlistScreen({ navigation, route }: PersonalWatchlistScreenProps) {
  const { currentUser, firebaseIdToken } = useAuthSession();
  const { getCachedPersonalWatchlist, refreshPersonalWatchlist } = useWatchlistCache();
  const { watchlistId } = route.params;
  const resourceScope = JSON.stringify([currentUser?.id ?? null, watchlistId]);
  const initialCached = getCachedPersonalWatchlist(watchlistId);
  const [error, setError] = useState<string | null>(null);
  const [hydratedItems, setHydratedItems] = useState<HydratedPersonalWatchlistItem[]>(
    () => initialCached?.hydratedItems ?? [],
  );
  const [isLoading, setIsLoading] = useState(() => !initialCached);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [watchlist, setWatchlist] = useState<PersonalWatchlist | null>(() => initialCached?.watchlist ?? null);
  const [stateScope, setStateScope] = useState(resourceScope);
  const requestRef = useRef({ scope: resourceScope, version: 0 });
  const visibleStateRef = useRef({ scope: stateScope, watchlist });
  visibleStateRef.current = { scope: stateScope, watchlist };

  if (requestRef.current.scope !== resourceScope) {
    requestRef.current = { scope: resourceScope, version: requestRef.current.version + 1 };
  }

  const isStateCurrent = stateScope === resourceScope;
  const visibleWatchlist = isStateCurrent ? watchlist : null;
  const visibleItems = isStateCurrent ? hydratedItems : [];

  const loadWatchlist = useCallback(async () => {
    const requestScope = resourceScope;
    const requestVersion = requestRef.current.version + 1;
    requestRef.current = { scope: requestScope, version: requestVersion };
    const isCurrent = () => requestRef.current.scope === requestScope
      && requestRef.current.version === requestVersion;

    if (!firebaseIdToken || !currentUser) {
      setError(null);
      setHydratedItems([]);
      setIsLoading(false);
      setWatchlist(null);
      setStateScope(requestScope);
      return;
    }

    setError(null);
    setIsLoading(!visibleStateRef.current.watchlist);

    try {
      const cached = await refreshPersonalWatchlist(watchlistId);
      if (!isCurrent()) return;

      setHydratedItems(cached.hydratedItems);
      setWatchlist(cached.watchlist);
      setStateScope(requestScope);
    } catch (loadError) {
      if (!isCurrent()) return;
      setError(loadError instanceof Error ? loadError.message : 'Could not load the list.');
      if (visibleStateRef.current.scope !== requestScope || !visibleStateRef.current.watchlist) {
        setHydratedItems([]);
        setWatchlist(null);
        setStateScope(requestScope);
      }
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, [currentUser, firebaseIdToken, refreshPersonalWatchlist, resourceScope, watchlistId]);

  const refreshWatchlist = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadWatchlist();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadWatchlist]);

  useEffect(() => {
    const cached = getCachedPersonalWatchlist(watchlistId);

    if (cached) {
      setHydratedItems(cached.hydratedItems);
      setWatchlist(cached.watchlist);
      setStateScope(resourceScope);
      setIsLoading(false);
      void loadWatchlist();
      return;
    }

    setHydratedItems([]);
    setWatchlist(null);
    setStateScope(resourceScope);
    void loadWatchlist();
  }, [loadWatchlist, resourceScope, watchlistId]);

  function openItem(item: WatchlistDisplayItem) {
    const title = item.title ?? (item.contentType === 'movie' ? 'Film' : 'Series');

    if (item.contentType === 'movie') {
      navigation.navigate('FilmDetail', {
        title,
        tmdbId: item.tmdbId,
      });
      return;
    }

    navigation.navigate('SeriesDetail', {
      title,
      tmdbId: item.tmdbId,
    });
  }

  if (!firebaseIdToken) {
    return (
      <WatchlistPage>
        <SignInRequiredCard
          body="You need to be signed in to use private lists. Sign in here to open this watchlist."
          title="Sign in to view this list"
        />
      </WatchlistPage>
    );
  }

  return (
    <WatchlistPage
      isRefreshing={isRefreshing}
      onRefresh={refreshWatchlist}
    >
      {isLoading && !visibleWatchlist ? (
        <LoadingState label="Loading list" />
      ) : error && !visibleWatchlist ? (
        <EmptyState body={error} title="List failed">
          <Button label="Retry" onPress={() => loadWatchlist()} />
        </EmptyState>
      ) : visibleWatchlist ? (
        <WatchlistSection>
          <SectionHeader title="Titles" />
          {visibleItems.length === 0 ? (
            <Text style={styles.emptyCopy}>
              Add films or series from detail pages to start shaping this list.
            </Text>
          ) : (
            <WatchlistPosterGrid
              items={visibleItems}
              onOpen={openItem}
            />
          )}
        </WatchlistSection>
      ) : null}
    </WatchlistPage>
  );
}

const styles = {
  emptyCopy: {
    ...typography.body,
    color: colors.textMuted,
  },
} as const;
