export function takeHydrationItems<T>(items: readonly T[], limit: number) {
  if (!Number.isInteger(limit) || limit < 0) throw new Error('Hydration limit must be non-negative.');
  return items.slice(0, limit);
}

export function createRequestCoalescer<K, V>(load: (key: K) => Promise<V>) {
  const inFlight = new Map<K, Promise<V>>();
  return (key: K) => {
    const existing = inFlight.get(key);
    if (existing) return existing;
    const request = load(key).finally(() => {
      if (inFlight.get(key) === request) inFlight.delete(key);
    });
    inFlight.set(key, request);
    return request;
  };
}
