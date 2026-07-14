export type CacheEnvelope<T> = {
  data: T;
  savedAt: string;
  version: 1;
};

export function serializeCacheEnvelope<T>(data: T, savedAt = new Date().toISOString()) {
  const envelope: CacheEnvelope<T> = {
    data,
    savedAt,
    version: 1,
  };

  return JSON.stringify(envelope);
}

export function parseCacheEnvelope<T>(rawValue: string): CacheEnvelope<T> | null {
  try {
    const parsed: unknown = JSON.parse(rawValue);

    if (!isRecord(parsed) || parsed.version !== 1 || !Object.prototype.hasOwnProperty.call(parsed, 'data')) {
      return null;
    }

    if (typeof parsed.savedAt !== 'string' || !isValidIsoDate(parsed.savedAt)) {
      return null;
    }

    return {
      data: parsed.data as T,
      savedAt: parsed.savedAt,
      version: 1,
    };
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidIsoDate(value: string) {
  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}
