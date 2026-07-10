import AsyncStorage from '@react-native-async-storage/async-storage';
import { CacheEnvelope, parseCacheEnvelope, serializeCacheEnvelope } from './cacheEnvelope';

const PUBLIC_CACHE_PREFIX = 'watchly:public:';
const USER_CACHE_PREFIX = 'watchly:user:';

export type PersistedCacheStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
  getAllKeys: () => Promise<readonly string[]>;
  multiRemove: (keys: readonly string[]) => Promise<void>;
};

const defaultStorage: PersistedCacheStorage = AsyncStorage;

export function getPublicCacheKey(resourceKey: string) {
  return `${PUBLIC_CACHE_PREFIX}${validateResourceKey(resourceKey)}`;
}

export function getPrivateCacheKey(userId: string, resourceKey: string) {
  const normalizedUserId = userId.trim();

  if (!normalizedUserId || normalizedUserId.includes(':')) {
    throw new Error('A non-empty user ID without colons is required for private cache keys.');
  }

  return `${getPrivateCachePrefix(normalizedUserId)}${validateResourceKey(resourceKey)}`;
}

export async function readPersistedCache<T>(
  key: string,
  storage: PersistedCacheStorage = defaultStorage,
): Promise<CacheEnvelope<T> | null> {
  validateCacheKey(key);
  const rawValue = await storage.getItem(key);

  if (rawValue === null) {
    return null;
  }

  const envelope = parseCacheEnvelope<T>(rawValue);

  if (!envelope) {
    await storage.removeItem(key);
  }

  return envelope;
}

export async function writePersistedCache<T>(
  key: string,
  data: T,
  storage: PersistedCacheStorage = defaultStorage,
  savedAt = new Date().toISOString(),
) {
  validateCacheKey(key);
  assertDoesNotContainAuthenticationTokens(data);
  assertJsonSafe(data);
  const serialized = serializeCacheEnvelope(data, savedAt);

  await storage.setItem(key, serialized);
}

export async function removePersistedCache(
  key: string,
  storage: PersistedCacheStorage = defaultStorage,
) {
  validateCacheKey(key);
  await storage.removeItem(key);
}

export async function clearPrivateCacheForUser(
  userId: string,
  storage: PersistedCacheStorage = defaultStorage,
) {
  const prefix = getPrivateCachePrefix(userId.trim());
  const keys = await storage.getAllKeys();
  const privateKeys = keys.filter((key) => key.startsWith(prefix));

  if (privateKeys.length > 0) {
    await storage.multiRemove(privateKeys);
  }
}

function getPrivateCachePrefix(userId: string) {
  if (!userId || userId.includes(':')) {
    throw new Error('A non-empty user ID without colons is required to clear private cache data.');
  }

  return `${USER_CACHE_PREFIX}${userId}:`;
}

function validateResourceKey(resourceKey: string) {
  const normalized = resourceKey.trim();

  if (!normalized) {
    throw new Error('A non-empty persisted cache resource key is required.');
  }

  return normalized;
}

function validateCacheKey(key: string) {
  if (!key.startsWith(PUBLIC_CACHE_PREFIX) && !key.startsWith(USER_CACHE_PREFIX)) {
    throw new Error('Persisted cache keys must be scoped as public or to a Watchly user.');
  }
}

function assertJsonSafe(value: unknown) {
  const ancestors = new Set<object>();

  const visit = (current: unknown): void => {
    if (
      current === null ||
      typeof current === 'string' ||
      typeof current === 'boolean' ||
      (typeof current === 'number' && Number.isFinite(current))
    ) {
      return;
    }

    if (typeof current !== 'object') {
      throw new Error('Persisted cache data must contain only JSON-safe values.');
    }

    if (ancestors.has(current)) {
      throw new Error('Persisted cache data must contain only JSON-safe values.');
    }

    const prototype = Object.getPrototypeOf(current);

    if (!Array.isArray(current) && prototype !== Object.prototype && prototype !== null) {
      throw new Error('Persisted cache data must contain only JSON-safe values.');
    }

    ancestors.add(current);
    const nestedValues = Array.isArray(current) ? current : Object.values(current);
    nestedValues.forEach(visit);
    ancestors.delete(current);
  };

  visit(value);
}

function assertDoesNotContainAuthenticationTokens(value: unknown) {
  const visited = new WeakSet<object>();

  const visit = (current: unknown): void => {
    if (typeof current !== 'object' || current === null || visited.has(current)) {
      return;
    }

    visited.add(current);

    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }

    Object.entries(current).forEach(([key, nestedValue]) => {
      const normalizedKey = key.replace(/[^a-z]/gi, '').toLowerCase();

      if (['accesstoken', 'firebaseidtoken', 'idtoken', 'refreshtoken'].includes(normalizedKey)) {
        throw new Error('Persisted cache data must never contain authentication tokens.');
      }

      visit(nestedValue);
    });
  };

  visit(value);
}
