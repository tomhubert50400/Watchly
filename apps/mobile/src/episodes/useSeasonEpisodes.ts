import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSeasonDetails, SeasonDetails } from '../api/catalogue';
import {
  clearEpisodeProgress,
  listSeasonProgress,
  markEpisodeWatched,
  SeasonProgress,
} from '../api/progress';
import { useAuthSession } from '../auth/AuthSessionContext';
import { getPrivateCacheKey, getPublicCacheKey, writePersistedCache } from '../cache/persistedCache';
import { useCachedResource } from '../cache/useCachedResource';
import { hapticError } from '../feedback/haptics';
import { useToast } from '../notifications/ToastContext';
import { notifyUserDataChanged, useUserDataRevision } from '../sync/userDataEvents';
import {
  applyEpisodeMutation,
  applyEpisodeWatchedThroughMutation,
  createWatchedEpisodeState,
  getNextEpisode,
  getScopedWatchedEpisodeState,
  getSeasonProgressFraction,
  WatchedEpisodeState,
} from './episodeModel';

type UseSeasonEpisodesOptions = {
  initialSeason?: SeasonDetails;
  loadSeason?: boolean;
  seasonNumber: number;
  seriesTmdbId: number;
};

export function useSeasonEpisodes({
  initialSeason,
  loadSeason = true,
  seasonNumber,
  seriesTmdbId,
}: UseSeasonEpisodesOptions) {
  const { currentUser, firebaseIdToken } = useAuthSession();
  const episodeProgressRevision = useUserDataRevision('episodeProgress');
  const { showToast } = useToast();
  const [watchedState, setWatchedState] = useState<WatchedEpisodeState>({});
  const batchFailedRef = useRef(false);
  const isMountedRef = useRef(true);
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingMutationCountRef = useRef(0);
  const watchedStateRef = useRef(watchedState);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    watchedStateRef.current = watchedState;
  }, [watchedState]);

  const loadSeasonDetails = useCallback(
    () => getSeasonDetails(seriesTmdbId, seasonNumber),
    [seasonNumber, seriesTmdbId],
  );
  const seasonResource = useCachedResource({
    enabled: loadSeason && !initialSeason,
    key: getPublicCacheKey(`catalogue:series:${seriesTmdbId}:season:${seasonNumber}:v2`),
    load: loadSeasonDetails,
  });
  const privateCacheKey = currentUser
    ? getPrivateCacheKey(currentUser.id, `episodes:${seriesTmdbId}:season:${seasonNumber}:progress`)
    : 'watchly:user:signed-out:episodes-disabled';
  const watchedStateOwnerRef = useRef(privateCacheKey);
  const scopedWatchedState = getScopedWatchedEpisodeState(
    watchedStateOwnerRef.current,
    privateCacheKey,
    watchedState,
  );
  const loadProgress = useCallback(() => {
    if (!firebaseIdToken) {
      return Promise.reject(new Error('Sign in to load episode progress.'));
    }

    return listSeasonProgress(firebaseIdToken, seriesTmdbId, seasonNumber);
  }, [episodeProgressRevision, firebaseIdToken, seasonNumber, seriesTmdbId]);
  const progressResource = useCachedResource<SeasonProgress>({
    enabled: Boolean(firebaseIdToken && currentUser),
    key: privateCacheKey,
    load: loadProgress,
  });

  useEffect(() => {
    if (watchedStateOwnerRef.current !== privateCacheKey) {
      watchedStateOwnerRef.current = privateCacheKey;
      watchedStateRef.current = {};
      setWatchedState({});
    }
  }, [privateCacheKey]);

  useEffect(() => {
    if (!firebaseIdToken || !currentUser) {
      watchedStateOwnerRef.current = privateCacheKey;
      watchedStateRef.current = {};
      setWatchedState({});
      return;
    }

    if (progressResource.data) {
      const nextState = createWatchedEpisodeState(progressResource.data.episodes);
      watchedStateOwnerRef.current = privateCacheKey;
      watchedStateRef.current = nextState;
      setWatchedState(nextState);
    }
  }, [currentUser, firebaseIdToken, privateCacheKey, progressResource.data]);

  const persistState = useCallback((state: WatchedEpisodeState) => {
    if (!currentUser) {
      return Promise.resolve();
    }

    const progress: SeasonProgress = {
      episodes: Object.values(state).filter(
        (episode) => episode.seriesTmdbId === seriesTmdbId && episode.seasonNumber === seasonNumber,
      ),
      seasonNumber,
      seriesTmdbId,
      watchedEpisodeCount: Object.values(state).filter(
        (episode) => episode.seriesTmdbId === seriesTmdbId && episode.seasonNumber === seasonNumber,
      ).length,
    };

    return writePersistedCache(privateCacheKey, progress);
  }, [currentUser, privateCacheKey, seasonNumber, seriesTmdbId]);

  const syncProgress = useCallback(async () => {
    if (!firebaseIdToken) {
      return watchedStateRef.current;
    }

    const latest = await listSeasonProgress(firebaseIdToken, seriesTmdbId, seasonNumber);
    const confirmedState = createWatchedEpisodeState(latest.episodes);

    if (isMountedRef.current && watchedStateOwnerRef.current === privateCacheKey) {
      setWatchedState(confirmedState);
      watchedStateRef.current = confirmedState;
      await persistState(confirmedState);
    }

    return confirmedState;
  }, [firebaseIdToken, persistState, privateCacheKey, seasonNumber, seriesTmdbId]);

  const setEpisodeWatched = useCallback(async (
    episodeNumber: number,
    watched: boolean,
  ) => {
    if (
      !firebaseIdToken ||
      watchedStateOwnerRef.current !== privateCacheKey
    ) {
      return;
    }

    const currentState = watchedStateRef.current;
    const optimisticState = watched
      ? applyEpisodeWatchedThroughMutation(currentState, {
          episodeNumber,
          now: new Date().toISOString(),
          seasonNumber,
          seriesTmdbId,
        })
      : applyEpisodeMutation(currentState, {
          episodeNumber,
          now: new Date().toISOString(),
          seasonNumber,
          seriesTmdbId,
          watched,
        }).state;

    if (optimisticState === currentState || (
      Object.keys(optimisticState).length === Object.keys(currentState).length &&
      Object.keys(optimisticState).every((key) => optimisticState[key] === currentState[key])
    )) {
      return;
    }

    setWatchedState(optimisticState);
    watchedStateRef.current = optimisticState;
    void persistState(optimisticState).catch(() => undefined);
    pendingMutationCountRef.current += 1;

    const commitMutation = async () => {
      try {
        if (watched) {
          await markEpisodeWatched(
            firebaseIdToken,
            seriesTmdbId,
            seasonNumber,
            episodeNumber,
          );
        } else {
          await clearEpisodeProgress(firebaseIdToken, seriesTmdbId, seasonNumber, episodeNumber);
        }
      } catch {
        batchFailedRef.current = true;
        if (isMountedRef.current && watchedStateOwnerRef.current === privateCacheKey) {
          hapticError();
          showToast('Could not save your episode progress.');
        }
      } finally {
        pendingMutationCountRef.current -= 1;
        if (pendingMutationCountRef.current === 0) {
          if (batchFailedRef.current) {
            batchFailedRef.current = false;
            try {
              await syncProgress();
            } catch {
              // Keep the locally persisted state until a later silent refresh can reconcile it.
            }
          }
          notifyUserDataChanged('episodeProgress');
        }
      }
    };
    const queuedMutation = mutationQueueRef.current.then(commitMutation, commitMutation);
    mutationQueueRef.current = queuedMutation.catch(() => undefined);
    await queuedMutation;
  }, [firebaseIdToken, persistState, privateCacheKey, seasonNumber, seriesTmdbId, showToast, syncProgress]);

  const setSeasonWatched = useCallback(async (episodeNumbers: readonly number[]) => {
    const lastEpisodeNumber = [...episodeNumbers].sort((left, right) => left - right).at(-1);

    if (lastEpisodeNumber === undefined) {
      return;
    }

    await setEpisodeWatched(lastEpisodeNumber, true);
  }, [setEpisodeWatched]);

  const season = initialSeason ?? seasonResource.data?.item ?? null;
  const episodes = season?.episodes ?? [];
  const progress = useMemo(
    () => getSeasonProgressFraction(episodes, scopedWatchedState),
    [episodes, scopedWatchedState],
  );
  const nextEpisode = useMemo(
    () => getNextEpisode(episodes, scopedWatchedState),
    [episodes, scopedWatchedState],
  );

  return {
    error: seasonResource.error ?? progressResource.error,
    episodes,
    isLoading: !initialSeason && seasonResource.isInitialLoading,
    isRefreshing:
      seasonResource.isRefreshing ||
      progressResource.isInitialLoading ||
      progressResource.isRefreshing,
    isSignedIn: Boolean(firebaseIdToken),
    nextEpisode,
    progress,
    retry: () => {
      seasonResource.retry();
      progressResource.retry();
    },
    season,
    setEpisodeWatched,
    setSeasonWatched,
    watchedState: scopedWatchedState,
  };
}
