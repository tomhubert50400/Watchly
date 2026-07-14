export type CachedResourceState<T> = {
  data: T | null;
  error: string | null;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  savedAt: string | null;
};

export type CachedResourceAction<T> =
  | { type: 'cacheLoaded'; data: T; savedAt: string }
  | { type: 'requestStarted'; visible?: boolean }
  | { type: 'requestSucceeded'; data: T; savedAt: string }
  | { type: 'requestFailed'; error: string }
  | { type: 'reset' };

export function createInitialCachedResourceState<T>(): CachedResourceState<T> {
  return {
    data: null,
    error: null,
    isInitialLoading: false,
    isRefreshing: false,
    savedAt: null,
  };
}

export function cachedResourceReducer<T>(
  state: CachedResourceState<T>,
  action: CachedResourceAction<T>,
): CachedResourceState<T> {
  switch (action.type) {
    case 'cacheLoaded':
    case 'requestSucceeded':
      return {
        data: action.data,
        error: null,
        isInitialLoading: false,
        isRefreshing: false,
        savedAt: action.savedAt,
      };
    case 'requestStarted':
      return {
        ...state,
        error: null,
        isInitialLoading: state.data === null,
        isRefreshing: state.data !== null && action.visible !== false,
      };
    case 'requestFailed':
      return {
        ...state,
        error: action.error,
        isInitialLoading: false,
        isRefreshing: false,
      };
    case 'reset':
      return createInitialCachedResourceState<T>();
  }
}
