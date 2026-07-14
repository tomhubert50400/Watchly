export type MemoryResourceEntry<T> = {
  data: T;
  savedAt: string;
};

type MemoryResourceCache = {
  get: <T>(key: string) => MemoryResourceEntry<T> | null;
  set: <T>(key: string, data: T, savedAt: string) => void;
  deleteWithPrefix: (prefix: string) => void;
  clear: () => void;
};

const DEFAULT_MAX_ENTRIES = 120;

export function isMemoryResourceFresh(savedAt: string, staleTimeMs: number, now = Date.now()) {
  if (!Number.isFinite(staleTimeMs) || staleTimeMs <= 0) {
    return false;
  }

  const savedAtMs = Date.parse(savedAt);
  return Number.isFinite(savedAtMs) && now - savedAtMs < staleTimeMs;
}

export function createMemoryResourceCache(maxEntries = DEFAULT_MAX_ENTRIES): MemoryResourceCache {
  if (!Number.isInteger(maxEntries) || maxEntries <= 0) {
    throw new Error('Memory resource cache size must be a positive integer.');
  }

  const entries = new Map<string, MemoryResourceEntry<unknown>>();

  return {
    get: <T>(key: string) => {
      const entry = entries.get(key);

      if (!entry) {
        return null;
      }

      entries.delete(key);
      entries.set(key, entry);
      return entry as MemoryResourceEntry<T>;
    },
    set: <T>(key: string, data: T, savedAt: string) => {
      entries.delete(key);
      entries.set(key, { data, savedAt });

      while (entries.size > maxEntries) {
        const oldestKey = entries.keys().next().value as string | undefined;
        if (oldestKey === undefined) break;
        entries.delete(oldestKey);
      }
    },
    deleteWithPrefix: (prefix: string) => {
      [...entries.keys()].forEach((key) => {
        if (key.startsWith(prefix)) entries.delete(key);
      });
    },
    clear: () => entries.clear(),
  };
}

const sharedCache = createMemoryResourceCache();
const requests = new Map<string, Promise<unknown>>();

export function getMemoryResource<T>(key: string) {
  return sharedCache.get<T>(key);
}

export function setMemoryResource<T>(key: string, data: T, savedAt: string) {
  sharedCache.set(key, data, savedAt);
}

export function getOrCreateResourceRequest<T>(key: string, load: () => Promise<T>): Promise<T> {
  const existing = requests.get(key);

  if (existing) {
    return existing as Promise<T>;
  }

  const request = load().finally(() => {
    if (requests.get(key) === request) {
      requests.delete(key);
    }
  });
  requests.set(key, request);
  return request;
}

export function clearMemoryResourceCache() {
  sharedCache.clear();
  requests.clear();
}

export function clearMemoryResourcesWithPrefix(prefix: string) {
  sharedCache.deleteWithPrefix(prefix);
  [...requests.keys()].forEach((key) => {
    if (key.startsWith(prefix)) requests.delete(key);
  });
}
