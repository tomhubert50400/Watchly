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
import { takeHydrationItems } from './requestBoundaries';

const MAX_WATCHLIST_ITEM_HYDRATIONS = 12;

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
  const { refreshMovie, refreshSeries } = useCatalogueCache();
  const [personalDetails, setPersonalDetails] = useState<Record<string, CachedPersonalWatchlist>>({});
  const [personalWatchlists, setPersonalWatchlists] = useState<PersonalWatchlistSummary[]>([]);
  const [sharedDetails, setSharedDetails] = useState<Record<string, CachedSharedWatchlist>>({});
  const [sharedWatchlists, setSharedWatchlists] = useState<SharedWatchlistSummary[]>([]);
  const [summariesOwnerId, setSummariesOwnerId] = useState<string | null>(currentUser?.id ?? null);
  const preloadVersionRef = useRef(0);
  const ownerRef = useRef<string | null>(currentUser?.id ?? null);
  const ownerVersionRef = useRef(0);
  const personalRefreshVersionsRef = useRef(new Map<string, number>());
  const sharedRefreshVersionsRef = useRef(new Map<string, number>());
  const ownerId = currentUser?.id ?? null;

  // Effects run too late to stop a response that settles between an account
  // switch render and cleanup, so invalidate the old owner synchronously.
  if (ownerRef.current !== ownerId) {
    ownerRef.current = ownerId;
    ownerVersionRef.current += 1;
    preloadVersionRef.current += 1;
  }

  useEffect(() => {
    setPersonalDetails({});
    setPersonalWatchlists([]);
    setSharedDetails({});
    setSharedWatchlists([]);
    setSummariesOwnerId(currentUser?.id ?? null);
    preloadVersionRef.current += 1;
  }, [currentUser?.id]);

  const refreshPersonalWatchlist = useCallback(async (watchlistId: string) => {
    const requestOwner = ownerId;
    if (!requestOwner) throw new Error('Sign in again to load watchlists.');

    const ownerVersion = ownerVersionRef.current;
    const detailKey = getDetailCacheKey(requestOwner, watchlistId);
    const refreshVersion = (personalRefreshVersionsRef.current.get(detailKey) ?? 0) + 1;
    personalRefreshVersionsRef.current.set(detailKey, refreshVersion);
    const isCurrent = () => ownerRef.current === requestOwner
      && ownerVersionRef.current === ownerVersion
      && personalRefreshVersionsRef.current.get(detailKey) === refreshVersion;

    const token = await getRequiredToken(getFirebaseIdToken);
    assertCurrentRequest(isCurrent);
    const watchlist = await getWatchlist(token, watchlistId);
    assertCurrentRequest(isCurrent);
    const hydratedItems = await Promise.all(
      takeHydrationItems(watchlist.items, MAX_WATCHLIST_ITEM_HYDRATIONS)
        .map((item) => hydratePersonalItem(item, refreshMovie, refreshSeries)),
    );
    hydratedItems.push(...watchlist.items.slice(MAX_WATCHLIST_ITEM_HYDRATIONS).map(toPersonalFallback));
    assertCurrentRequest(isCurrent);
    const cached = { hydratedItems, watchlist };

    setPersonalDetails((current) => ({ ...current, [detailKey]: cached }));

    return cached;
  }, [getFirebaseIdToken, ownerId, refreshMovie, refreshSeries]);

  const refreshSharedWatchlist = useCallback(async (watchlistId: string) => {
    const requestOwner = ownerId;
    if (!requestOwner) throw new Error('Sign in again to load watchlists.');

    const ownerVersion = ownerVersionRef.current;
    const detailKey = getDetailCacheKey(requestOwner, watchlistId);
    const refreshVersion = (sharedRefreshVersionsRef.current.get(detailKey) ?? 0) + 1;
    sharedRefreshVersionsRef.current.set(detailKey, refreshVersion);
    const isCurrent = () => ownerRef.current === requestOwner
      && ownerVersionRef.current === ownerVersion
      && sharedRefreshVersionsRef.current.get(detailKey) === refreshVersion;

    const token = await getRequiredToken(getFirebaseIdToken);
    assertCurrentRequest(isCurrent);
    const watchlist = await getSharedWatchlist(token, watchlistId);
    assertCurrentRequest(isCurrent);
    const hydratedItems = await Promise.all(
      takeHydrationItems(watchlist.items, MAX_WATCHLIST_ITEM_HYDRATIONS)
        .map((item) => hydrateSharedItem(item, refreshMovie, refreshSeries)),
    );
    hydratedItems.push(...watchlist.items.slice(MAX_WATCHLIST_ITEM_HYDRATIONS).map(toSharedFallback));
    assertCurrentRequest(isCurrent);
    const cached = { hydratedItems, watchlist };

    setSharedDetails((current) => ({ ...current, [detailKey]: cached }));

    return cached;
  }, [getFirebaseIdToken, ownerId, refreshMovie, refreshSeries]);

  const preloadWatchlists = useCallback(async () => {
    const requestOwner = ownerId;
    if (!firebaseIdToken || !requestOwner) return;

    const preloadVersion = preloadVersionRef.current + 1;
    const ownerVersion = ownerVersionRef.current;
    preloadVersionRef.current = preloadVersion;
    const isCurrent = () => ownerRef.current === requestOwner
      && ownerVersionRef.current === ownerVersion
      && preloadVersionRef.current === preloadVersion;

    const token = await getRequiredToken(getFirebaseIdToken);
    if (!isCurrent()) return;
    const [personalResponse, sharedResponse] = await Promise.all([
      listWatchlists(token),
      listSharedWatchlists(token),
    ]);

    if (!isCurrent()) return;

    setPersonalWatchlists(personalResponse.items);
    setSharedWatchlists(sharedResponse.items);
    setSummariesOwnerId(requestOwner);
  }, [firebaseIdToken, getFirebaseIdToken, ownerId]);

  useEffect(() => {
    void preloadWatchlists();
  }, [preloadWatchlists]);

  const value = useMemo<WatchlistCacheContextValue>(
    () => ({
      getCachedPersonalWatchlist: (watchlistId) => ownerId
        ? personalDetails[getDetailCacheKey(ownerId, watchlistId)] ?? null
        : null,
      getCachedSharedWatchlist: (watchlistId) => ownerId
        ? sharedDetails[getDetailCacheKey(ownerId, watchlistId)] ?? null
        : null,
      personalWatchlists: summariesOwnerId === ownerId ? personalWatchlists : [],
      preloadWatchlists,
      refreshPersonalWatchlist,
      refreshSharedWatchlist,
      removePersonalWatchlist: (watchlistId) => {
        if (ownerId) {
          setPersonalDetails((current) => removeKey(current, getDetailCacheKey(ownerId, watchlistId)));
        }
        setPersonalWatchlists((current) => current.filter((watchlist) => watchlist.id !== watchlistId));
      },
      removeSharedWatchlist: (watchlistId) => {
        if (ownerId) {
          setSharedDetails((current) => removeKey(current, getDetailCacheKey(ownerId, watchlistId)));
        }
        setSharedWatchlists((current) => current.filter((watchlist) => watchlist.id !== watchlistId));
      },
      setPersonalWatchlists: (watchlists) => {
        setSummariesOwnerId(ownerId);
        setPersonalWatchlists(watchlists);
      },
      setSharedWatchlists: (watchlists) => {
        setSummariesOwnerId(ownerId);
        setSharedWatchlists(watchlists);
      },
      sharedWatchlists: summariesOwnerId === ownerId ? sharedWatchlists : [],
    }),
    [
      ownerId,
      personalDetails,
      personalWatchlists,
      preloadWatchlists,
      refreshPersonalWatchlist,
      refreshSharedWatchlist,
      sharedDetails,
      sharedWatchlists,
      summariesOwnerId,
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

function toPersonalFallback(item: PersonalWatchlistItem): HydratedPersonalWatchlistItem {
  return { ...item, posterUrl: null, title: `TMDB ${item.tmdbId}` };
}

function toSharedFallback(item: SharedWatchlistItem): HydratedSharedWatchlistItem {
  return { ...item, posterUrl: null, title: `TMDB ${item.tmdbId}` };
}

function removeKey<T>(record: Record<string, T>, key: string) {
  const next = { ...record };

  delete next[key];

  return next;
}

export function getDetailCacheKey(ownerId: string, watchlistId: string) {
  return JSON.stringify([ownerId, watchlistId]);
}

function assertCurrentRequest(isCurrent: () => boolean) {
  if (!isCurrent()) {
    throw new Error('Watchlist request was superseded.');
  }
}
