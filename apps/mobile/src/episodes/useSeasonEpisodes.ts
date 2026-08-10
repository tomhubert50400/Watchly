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
import { hapticConfirm, hapticError } from '../feedback/haptics';
import { useToast } from '../notifications/ToastContext';
import {
  applyEpisodeMutation,
  createEpisodeKey,
  createWatchedEpisodeState,
  EpisodeMutationIntent,
  getNextEpisode,
  getScopedWatchedEpisodeState,
  getSeasonProgressFraction,
  rollbackEpisodeMutation,
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
  const { currentUser, firebaseIdToken, notifyTrackingChanged, trackingRevision } = useAuthSession();
  const { showToast } = useToast();
  const [watchedState, setWatchedState] = useState<WatchedEpisodeState>({});
  const [isSaving, setIsSaving] = useState(false);
  const isMountedRef = useRef(true);
  const mutationLockRef = useRef(false);
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
  }, [firebaseIdToken, seasonNumber, seriesTmdbId, trackingRevision]);
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

  const performUndo = useCallback(async (intent: EpisodeMutationIntent) => {
    if (
      !firebaseIdToken ||
      !isMountedRef.current ||
      mutationLockRef.current ||
      watchedStateOwnerRef.current !== privateCacheKey
    ) {
      return;
    }

    mutationLockRef.current = true;
    setIsSaving(true);
    const stateBeforeUndo = watchedStateRef.current;
    const restoredState = rollbackEpisodeMutation(stateBeforeUndo, intent);
    setWatchedState(restoredState);
    watchedStateRef.current = restoredState;
    void persistState(restoredState).catch(() => undefined);

    try {
      if (intent.undoAction === 'mark') {
        const restoredProgress = await markEpisodeWatched(
          firebaseIdToken,
          intent.seriesTmdbId,
          intent.seasonNumber,
          intent.episodeNumber,
        );
        if (!isMountedRef.current || watchedStateOwnerRef.current !== privateCacheKey) {
          return;
        }
        const confirmed = {
          ...restoredState,
          [createEpisodeKey(intent.seasonNumber, intent.episodeNumber)]: restoredProgress,
        };
        setWatchedState(confirmed);
        watchedStateRef.current = confirmed;
        await persistState(confirmed);
      } else {
        await clearEpisodeProgress(
          firebaseIdToken,
          intent.seriesTmdbId,
          intent.seasonNumber,
          intent.episodeNumber,
        );
        if (!isMountedRef.current || watchedStateOwnerRef.current !== privateCacheKey) {
          return;
        }
        await persistState(restoredState);
      }
      if (!isMountedRef.current || watchedStateOwnerRef.current !== privateCacheKey) {
        return;
      }
      notifyTrackingChanged();
      hapticConfirm();
      showToast('Episode progress restored.', 'success');
    } catch {
      if (isMountedRef.current && watchedStateOwnerRef.current === privateCacheKey) {
        setWatchedState(stateBeforeUndo);
        watchedStateRef.current = stateBeforeUndo;
        void persistState(stateBeforeUndo).catch(() => undefined);
        hapticError();
        showToast('Could not undo episode progress.');
      }
    } finally {
      mutationLockRef.current = false;
      setIsSaving(false);
    }
  }, [firebaseIdToken, notifyTrackingChanged, persistState, privateCacheKey, showToast]);

  const setEpisodeWatched = useCallback(async (episodeNumber: number, watched: boolean) => {
    if (
      !firebaseIdToken ||
      mutationLockRef.current ||
      watchedStateOwnerRef.current !== privateCacheKey
    ) {
      return;
    }

    const currentState = watchedStateRef.current;
    const optimistic = applyEpisodeMutation(currentState, {
      episodeNumber,
      now: new Date().toISOString(),
      seasonNumber,
      seriesTmdbId,
      watched,
    });

    if (optimistic.intent.previouslyWatched === watched) {
      return;
    }

    mutationLockRef.current = true;
    setIsSaving(true);
    setWatchedState(optimistic.state);
    watchedStateRef.current = optimistic.state;
    void persistState(optimistic.state).catch(() => undefined);

    try {
      let confirmedState = optimistic.state;
      if (watched) {
        const saved = await markEpisodeWatched(firebaseIdToken, seriesTmdbId, seasonNumber, episodeNumber);
        confirmedState = {
          ...optimistic.state,
          [createEpisodeKey(seasonNumber, episodeNumber)]: saved,
        };
      } else {
        await clearEpisodeProgress(firebaseIdToken, seriesTmdbId, seasonNumber, episodeNumber);
      }

      if (!isMountedRef.current || watchedStateOwnerRef.current !== privateCacheKey) {
        return;
      }
      setWatchedState(confirmedState);
      watchedStateRef.current = confirmedState;
      await persistState(confirmedState);
      notifyTrackingChanged();
      hapticConfirm();
      showToast(watched ? 'Episode marked watched.' : 'Episode marked unwatched.', 'success', {
        label: 'Undo',
        onPress: () => void performUndo(optimistic.intent),
      });
    } catch {
      if (isMountedRef.current && watchedStateOwnerRef.current === privateCacheKey) {
        const rolledBack = rollbackEpisodeMutation(optimistic.state, optimistic.intent);
        setWatchedState(rolledBack);
        watchedStateRef.current = rolledBack;
        void persistState(rolledBack).catch(() => undefined);
        hapticError();
        showToast('Could not save your episode progress.');
      }
    } finally {
      mutationLockRef.current = false;
      setIsSaving(false);
    }
  }, [firebaseIdToken, notifyTrackingChanged, performUndo, persistState, privateCacheKey, seasonNumber, seriesTmdbId, showToast]);

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
    isSaving,
    isSignedIn: Boolean(firebaseIdToken),
    nextEpisode,
    progress,
    retry: () => {
      seasonResource.retry();
      progressResource.retry();
    },
    season,
    setEpisodeWatched,
    watchedState: scopedWatchedState,
  };
}
