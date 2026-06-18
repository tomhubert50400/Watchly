import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  getSharedWatchlist,
  listSharedWatchlists,
  SharedWatchlist,
  SharedWatchlistItem,
  SharedWatchlistSummary,
} from '../api/sharedWatchlists';
import {
  getWatchlist,
  listWatchlists,
  PersonalWatchlist,
  PersonalWatchlistItem,
  PersonalWatchlistSummary,
} from '../api/watchlists';
import { useAuthSession } from '../auth/AuthSessionContext';
import { useCatalogueCache } from '../catalogue/CatalogueCacheContext';

export type HydratedPersonalWatchlistItem = PersonalWatchlistItem & {
  posterUrl: string | null;
  title: string;
};

export type HydratedSharedWatchlistItem = SharedWatchlistItem & {
  posterUrl: string | null;
  title: string;
};

export type CachedPersonalWatchlist = {
  hydratedItems: HydratedPersonalWatchlistItem[];
  watchlist: PersonalWatchlist;
};

export type CachedSharedWatchlist = {
  hydratedItems: HydratedSharedWatchlistItem[];
  watchlist: SharedWatchlist;
};

type WatchlistCacheContextValue = {
  getCachedPersonalWatchlist: (watchlistId: string) => CachedPersonalWatchlist | null;
  getCachedSharedWatchlist: (watchlistId: string) => CachedSharedWatchlist | null;
  personalWatchlists: PersonalWatchlistSummary[];
  preloadWatchlists: () => Promise<void>;
  refreshPersonalWatchlist: (watchlistId: string) => Promise<CachedPersonalWatchlist>;
  refreshSharedWatchlist: (watchlistId: string) => Promise<CachedSharedWatchlist>;
  removePersonalWatchlist: (watchlistId: string) => void;
  removeSharedWatchlist: (watchlistId: string) => void;
  sharedWatchlists: SharedWatchlistSummary[];
  setPersonalWatchlists: (watchlists: PersonalWatchlistSummary[]) => void;
  setSharedWatchlists: (watchlists: SharedWatchlistSummary[]) => void;
};

const WatchlistCacheContext = createContext<WatchlistCacheContextValue | null>(null);

export function WatchlistCacheProvider({ children }: PropsWithChildren) {
  const { currentUser, firebaseIdToken, getFirebaseIdToken } = useAuthSession();
  const { preloadCatalogueItems, refreshMovie, refreshSeries } = useCatalogueCache();
  const [personalDetails, setPersonalDetails] = useState<Record<string, CachedPersonalWatchlist>>({});
  const [personalWatchlists, setPersonalWatchlists] = useState<PersonalWatchlistSummary[]>([]);
  const [sharedDetails, setSharedDetails] = useState<Record<string, CachedSharedWatchlist>>({});
  const [sharedWatchlists, setSharedWatchlists] = useState<SharedWatchlistSummary[]>([]);
  const preloadVersionRef = useRef(0);

  useEffect(() => {
    setPersonalDetails({});
    setPersonalWatchlists([]);
    setSharedDetails({});
    setSharedWatchlists([]);
    preloadVersionRef.current += 1;
  }, [currentUser?.id]);

  const refreshPersonalWatchlist = useCallback(async (watchlistId: string) => {
    const token = await getRequiredToken(getFirebaseIdToken);
    const watchlist = await getWatchlist(token, watchlistId);
    preloadCatalogueItems(watchlist.items);
    const hydratedItems = await Promise.all(
      watchlist.items.map((item) => hydratePersonalItem(item, refreshMovie, refreshSeries)),
    );
    const cached = { hydratedItems, watchlist };

    setPersonalDetails((current) => ({ ...current, [watchlistId]: cached }));

    return cached;
  }, [getFirebaseIdToken, preloadCatalogueItems, refreshMovie, refreshSeries]);

  const refreshSharedWatchlist = useCallback(async (watchlistId: string) => {
    const token = await getRequiredToken(getFirebaseIdToken);
    const watchlist = await getSharedWatchlist(token, watchlistId);
    preloadCatalogueItems(watchlist.items);
    const hydratedItems = await Promise.all(
      watchlist.items.map((item) => hydrateSharedItem(item, refreshMovie, refreshSeries)),
    );
    const cached = { hydratedItems, watchlist };

    setSharedDetails((current) => ({ ...current, [watchlistId]: cached }));

    return cached;
  }, [getFirebaseIdToken, preloadCatalogueItems, refreshMovie, refreshSeries]);

  const preloadWatchlists = useCallback(async () => {
    if (!firebaseIdToken) {
      return;
    }

    const preloadVersion = preloadVersionRef.current + 1;

    preloadVersionRef.current = preloadVersion;

    const token = await getRequiredToken(getFirebaseIdToken);
    const [personalResponse, sharedResponse] = await Promise.all([
      listWatchlists(token),
      listSharedWatchlists(token),
    ]);

    if (preloadVersionRef.current !== preloadVersion) {
      return;
    }

    setPersonalWatchlists(personalResponse.items);
    setSharedWatchlists(sharedResponse.items);

    void Promise.all(personalResponse.items.map((watchlist) => refreshPersonalWatchlist(watchlist.id))).catch(
      () => undefined,
    );
    void Promise.all(sharedResponse.items.map((watchlist) => refreshSharedWatchlist(watchlist.id))).catch(
      () => undefined,
    );
  }, [firebaseIdToken, getFirebaseIdToken, refreshPersonalWatchlist, refreshSharedWatchlist]);

  useEffect(() => {
    void preloadWatchlists();
  }, [preloadWatchlists]);

  const value = useMemo<WatchlistCacheContextValue>(
    () => ({
      getCachedPersonalWatchlist: (watchlistId) => personalDetails[watchlistId] ?? null,
      getCachedSharedWatchlist: (watchlistId) => sharedDetails[watchlistId] ?? null,
      personalWatchlists,
      preloadWatchlists,
      refreshPersonalWatchlist,
      refreshSharedWatchlist,
      removePersonalWatchlist: (watchlistId) => {
        setPersonalDetails((current) => removeKey(current, watchlistId));
        setPersonalWatchlists((current) => current.filter((watchlist) => watchlist.id !== watchlistId));
      },
      removeSharedWatchlist: (watchlistId) => {
        setSharedDetails((current) => removeKey(current, watchlistId));
        setSharedWatchlists((current) => current.filter((watchlist) => watchlist.id !== watchlistId));
      },
      setPersonalWatchlists,
      setSharedWatchlists,
      sharedWatchlists,
    }),
    [
      personalDetails,
      personalWatchlists,
      preloadWatchlists,
      refreshPersonalWatchlist,
      refreshSharedWatchlist,
      sharedDetails,
      sharedWatchlists,
    ],
  );

  return <WatchlistCacheContext.Provider value={value}>{children}</WatchlistCacheContext.Provider>;
}

export function useWatchlistCache() {
  const context = useContext(WatchlistCacheContext);

  if (!context) {
    throw new Error('useWatchlistCache must be used inside WatchlistCacheProvider.');
  }

  return context;
}

async function getRequiredToken(getFirebaseIdToken: () => Promise<string | null>) {
  const token = await getFirebaseIdToken();

  if (!token) {
    throw new Error('Sign in again to load watchlists.');
  }

  return token;
}

async function hydratePersonalItem(
  item: PersonalWatchlistItem,
  refreshMovie: (tmdbId: number) => Promise<{ posterUrl: string | null; title: string }>,
  refreshSeries: (tmdbId: number) => Promise<{ posterUrl: string | null; title: string }>,
): Promise<HydratedPersonalWatchlistItem> {
  return hydrateItem(item, refreshMovie, refreshSeries);
}

async function hydrateSharedItem(
  item: SharedWatchlistItem,
  refreshMovie: (tmdbId: number) => Promise<{ posterUrl: string | null; title: string }>,
  refreshSeries: (tmdbId: number) => Promise<{ posterUrl: string | null; title: string }>,
): Promise<HydratedSharedWatchlistItem> {
  return hydrateItem(item, refreshMovie, refreshSeries);
}

async function hydrateItem<T extends PersonalWatchlistItem | SharedWatchlistItem>(
  item: T,
  refreshMovie: (tmdbId: number) => Promise<{ posterUrl: string | null; title: string }>,
  refreshSeries: (tmdbId: number) => Promise<{ posterUrl: string | null; title: string }>,
) {
  try {
    if (item.contentType === 'movie') {
      const movie = await refreshMovie(item.tmdbId);

      return {
        ...item,
        posterUrl: movie.posterUrl,
        title: movie.title,
      };
    }

    const series = await refreshSeries(item.tmdbId);

    return {
      ...item,
      posterUrl: series.posterUrl,
      title: series.title,
    };
  } catch {
    return {
      ...item,
      posterUrl: null,
      title: `TMDB ${item.tmdbId}`,
    };
  }
}

function removeKey<T>(record: Record<string, T>, key: string) {
  const next = { ...record };

  delete next[key];

  return next;
}
