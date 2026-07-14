import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  cachedResourceReducer,
  createInitialCachedResourceState,
  type CachedResourceState,
} from './cachedResourceReducer';
import {
  getMemoryResource,
  getOrCreateResourceRequest,
  isMemoryResourceFresh,
  setMemoryResource,
} from './memoryResourceCache';
import { readPersistedCache, writePersistedCache } from './persistedCache';

type UseCachedResourceOptions<T> = {
  key: string;
  load: (cached?: T) => Promise<T>;
  enabled?: boolean;
  staleTimeMs?: number;
};

const DEFAULT_STALE_TIME_MS = 5 * 60 * 1000;

export type UseCachedResourceResult<T> = CachedResourceState<T> & {
  retry: () => void;
};

type RequestVersionGuard = {
  begin: () => number;
  invalidate: () => void;
  isCurrent: (version: number) => boolean;
};

export function createRequestVersionGuard(): RequestVersionGuard {
  let currentVersion = 0;

  return {
    begin: () => {
      currentVersion += 1;
      return currentVersion;
    },
    invalidate: () => {
      currentVersion += 1;
    },
    isCurrent: (version) => currentVersion === version,
  };
}

export function createCachedResourceStateFromMemory<T>(key: string): CachedResourceState<T> {
  const entry = getMemoryResource<T>(key);

  if (!entry) {
    return createInitialCachedResourceState<T>();
  }

  return {
    data: entry.data,
    error: null,
    isInitialLoading: false,
    isRefreshing: false,
    savedAt: entry.savedAt,
  };
}

export function useCachedResource<T>({
  key,
  load,
  enabled = true,
  staleTimeMs = DEFAULT_STALE_TIME_MS,
}: UseCachedResourceOptions<T>): UseCachedResourceResult<T> {
  const [state, dispatch] = useReducer(
    cachedResourceReducer<T>,
    key,
    createCachedResourceStateFromMemory<T>,
  );
  const [retryRevision, setRetryRevision] = useState(0);
  const handledRetryRevisionRef = useRef(0);
  const loadRef = useRef(load);
  const requestVersionsRef = useRef(createRequestVersionGuard());
  const stateKeyRef = useRef(key);
  const keyChangedDuringRender = stateKeyRef.current !== key;

  const retry = useCallback(() => {
    setRetryRevision((revision) => revision + 1);
  }, []);

  useEffect(() => {
    const requestVersions = requestVersionsRef.current;
    const memoryEntry = getMemoryResource<T>(key);
    const isManualRetry = handledRetryRevisionRef.current !== retryRevision;
    const loadChanged = loadRef.current !== load;
    handledRetryRevisionRef.current = retryRevision;
    loadRef.current = load;

    if (!enabled) {
      stateKeyRef.current = key;
      requestVersions.invalidate();
      dispatch({ type: 'reset' });
      return;
    }

    if (stateKeyRef.current !== key) {
      stateKeyRef.current = key;
      dispatch(memoryEntry
        ? { type: 'cacheLoaded', data: memoryEntry.data, savedAt: memoryEntry.savedAt }
        : { type: 'reset' });
    }

    if (
      memoryEntry &&
      !isManualRetry &&
      !loadChanged &&
      isMemoryResourceFresh(memoryEntry.savedAt, staleTimeMs)
    ) {
      return;
    }

    const requestVersion = requestVersions.begin();
    dispatch({ type: 'requestStarted', visible: isManualRetry || !memoryEntry });

    void (async () => {
      let cachedData: T | undefined = memoryEntry?.data;
      let cachedSavedAt = memoryEntry?.savedAt;

      try {
        const cached = await readPersistedCache<T>(key);

        if (!requestVersions.isCurrent(requestVersion)) {
          return;
        }

        if (cached && (!memoryEntry || cached.savedAt > memoryEntry.savedAt)) {
          cachedData = cached.data;
          cachedSavedAt = cached.savedAt;
          setMemoryResource(key, cached.data, cached.savedAt);
          dispatch({
            type: 'cacheLoaded',
            data: cached.data,
            savedAt: cached.savedAt,
          });
          dispatch({ type: 'requestStarted', visible: isManualRetry });
        }
      } catch {
        // Persistence failures must not prevent a fresh network request.
      }

      if (!requestVersions.isCurrent(requestVersion)) {
        return;
      }

      if (
        cachedSavedAt &&
        !isManualRetry &&
        !loadChanged &&
        isMemoryResourceFresh(cachedSavedAt, staleTimeMs)
      ) {
        return;
      }

      try {
        const data = await getOrCreateResourceRequest(key, () => load(cachedData));

        if (!requestVersions.isCurrent(requestVersion)) {
          return;
        }

        const savedAt = new Date().toISOString();
        setMemoryResource(key, data, savedAt);
        dispatch({ type: 'requestSucceeded', data, savedAt });
        void writePersistedCache(key, data, undefined, savedAt).catch(() => undefined);
      } catch (error) {
        if (!requestVersions.isCurrent(requestVersion)) {
          return;
        }

        dispatch({ type: 'requestFailed', error: getErrorMessage(error) });
      }
    })();

    return () => {
      requestVersions.invalidate();
    };
  }, [enabled, key, load, retryRevision, staleTimeMs]);

  if (!enabled || keyChangedDuringRender) {
    const memoryState = enabled ? createCachedResourceStateFromMemory<T>(key) : null;
    return {
      ...(memoryState ?? createInitialCachedResourceState<T>()),
      retry,
    };
  }

  return {
    ...state,
    retry,
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'Unable to update this content. Try again.';
}
