import type { EpisodeProgress } from '../api/progress';

export type EpisodeIdentity = {
  episodeNumber: number;
  seasonNumber: number;
};

export type WatchedEpisodeState = Record<string, EpisodeProgress>;

export type EpisodeMutationIntent = EpisodeIdentity & {
  action: 'mark' | 'unmark';
  previousProgress: EpisodeProgress | null;
  previouslyWatched: boolean;
  seriesTmdbId: number;
  undoAction: 'mark' | 'unmark';
};

export function createEpisodeKey(seasonNumber: number, episodeNumber: number) {
  return `${seasonNumber}:${episodeNumber}`;
}

export function createWatchedEpisodeState(progress: readonly EpisodeProgress[]): WatchedEpisodeState {
  return Object.fromEntries(
    progress.map((episode) => [createEpisodeKey(episode.seasonNumber, episode.episodeNumber), episode]),
  );
}

export function getScopedWatchedEpisodeState(
  ownerCacheKey: string,
  requestedCacheKey: string,
  state: WatchedEpisodeState,
): WatchedEpisodeState {
  return ownerCacheKey === requestedCacheKey ? state : {};
}

export function isEpisodeWatched(
  state: WatchedEpisodeState,
  seasonNumber: number,
  episodeNumber: number,
) {
  return Boolean(state[createEpisodeKey(seasonNumber, episodeNumber)]);
}

export function getNextEpisode<T extends EpisodeIdentity>(
  episodes: readonly T[],
  state: WatchedEpisodeState,
): T | null {
  return episodes.find((episode) => !isEpisodeWatched(state, episode.seasonNumber, episode.episodeNumber)) ?? null;
}

export function getSeasonProgressFraction(
  episodes: readonly EpisodeIdentity[],
  state: WatchedEpisodeState,
) {
  const completed = episodes.filter((episode) =>
    isEpisodeWatched(state, episode.seasonNumber, episode.episodeNumber),
  ).length;
  const total = episodes.length;

  return {
    completed,
    fraction: total === 0 ? 0 : completed / total,
    total,
  };
}

export function applyEpisodeMutation(
  state: WatchedEpisodeState,
  mutation: EpisodeIdentity & {
    now: string;
    seriesTmdbId: number;
    watched: boolean;
  },
): { intent: EpisodeMutationIntent; state: WatchedEpisodeState } {
  const key = createEpisodeKey(mutation.seasonNumber, mutation.episodeNumber);
  const previousProgress = state[key] ?? null;
  const nextState = { ...state };

  if (mutation.watched) {
    nextState[key] = previousProgress ?? {
      episodeNumber: mutation.episodeNumber,
      id: `optimistic:${mutation.seriesTmdbId}:${key}`,
      seasonNumber: mutation.seasonNumber,
      seriesTmdbId: mutation.seriesTmdbId,
      updatedAt: mutation.now,
      watchedAt: mutation.now,
    };
  } else {
    delete nextState[key];
  }

  return {
    intent: {
      action: mutation.watched ? 'mark' : 'unmark',
      episodeNumber: mutation.episodeNumber,
      previousProgress,
      previouslyWatched: previousProgress !== null,
      seasonNumber: mutation.seasonNumber,
      seriesTmdbId: mutation.seriesTmdbId,
      undoAction: mutation.watched ? 'unmark' : 'mark',
    },
    state: nextState,
  };
}

export function applyEpisodeWatchedThroughMutation(
  state: WatchedEpisodeState,
  mutation: EpisodeIdentity & {
    now: string;
    seriesTmdbId: number;
  },
) {
  let nextState = state;

  for (let episodeNumber = 1; episodeNumber <= mutation.episodeNumber; episodeNumber += 1) {
    nextState = applyEpisodeMutation(nextState, {
      episodeNumber,
      now: mutation.now,
      seasonNumber: mutation.seasonNumber,
      seriesTmdbId: mutation.seriesTmdbId,
      watched: true,
    }).state;
  }

  return nextState;
}

export function getWatchedEpisodeRestorationPlan(
  currentState: WatchedEpisodeState,
  targetState: WatchedEpisodeState,
) {
  const currentKeys = new Set(Object.keys(currentState));
  const targetKeys = new Set(Object.keys(targetState));

  return {
    markEpisodeNumbers: Object.values(targetState)
      .filter((episode) => !currentKeys.has(createEpisodeKey(episode.seasonNumber, episode.episodeNumber)))
      .map((episode) => episode.episodeNumber)
      .sort((left, right) => left - right),
    unmarkEpisodeNumbers: Object.values(currentState)
      .filter((episode) => !targetKeys.has(createEpisodeKey(episode.seasonNumber, episode.episodeNumber)))
      .map((episode) => episode.episodeNumber)
      .sort((left, right) => left - right),
  };
}

export function rollbackEpisodeMutation(
  state: WatchedEpisodeState,
  intent: EpisodeMutationIntent,
): WatchedEpisodeState {
  const key = createEpisodeKey(intent.seasonNumber, intent.episodeNumber);
  const restored = { ...state };

  if (intent.previousProgress) {
    restored[key] = intent.previousProgress;
  } else {
    delete restored[key];
  }

  return restored;
}
