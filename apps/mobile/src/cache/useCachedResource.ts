import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  cachedResourceReducer,
  createInitialCachedResourceState,
  type CachedResourceState,
} from './cachedResourceReducer';
import { readPersistedCache, writePersistedCache } from './persistedCache';

type UseCachedResourceOptions<T> = {
  key: string;
  load: () => Promise<T>;
  enabled?: boolean;
};

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

export function useCachedResource<T>({
  key,
  load,
  enabled = true,
}: UseCachedResourceOptions<T>): UseCachedResourceResult<T> {
  const [state, dispatch] = useReducer(cachedResourceReducer<T>, createInitialCachedResourceState<T>());
  const [retryRevision, setRetryRevision] = useState(0);
  const requestVersionsRef = useRef(createRequestVersionGuard());
  const stateKeyRef = useRef(key);
  const keyChangedDuringRender = stateKeyRef.current !== key;

  const retry = useCallback(() => {
    setRetryRevision((revision) => revision + 1);
  }, []);

  useEffect(() => {
    const requestVersions = requestVersionsRef.current;

    if (!enabled) {
      stateKeyRef.current = key;
      requestVersions.invalidate();
      dispatch({ type: 'reset' });
      return;
    }

    if (stateKeyRef.current !== key) {
      stateKeyRef.current = key;
      dispatch({ type: 'reset' });
    }

    const requestVersion = requestVersions.begin();

    dispatch({ type: 'requestStarted' });

    void (async () => {
      try {
        const cached = await readPersistedCache<T>(key);

        if (!requestVersions.isCurrent(requestVersion)) {
          return;
        }

        if (cached) {
          dispatch({
            type: 'cacheLoaded',
            data: cached.data,
            savedAt: cached.savedAt,
          });
          dispatch({ type: 'requestStarted' });
        }
      } catch {
        // Persistence failures must not prevent a fresh network request.
      }

      if (!requestVersions.isCurrent(requestVersion)) {
        return;
      }

      try {
        const data = await load();

        if (!requestVersions.isCurrent(requestVersion)) {
          return;
        }

        const savedAt = new Date().toISOString();
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
  }, [enabled, key, load, retryRevision]);

  if (!enabled || keyChangedDuringRender) {
    return {
      ...createInitialCachedResourceState<T>(),
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
