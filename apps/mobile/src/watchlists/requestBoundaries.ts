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

export async function loadProgressively<T, V>({
  concurrency,
  items,
  load,
  onLoaded,
}: {
  concurrency: number;
  items: readonly T[];
  load: (item: T, index: number) => Promise<V>;
  onLoaded: (value: V, item: T, index: number) => void;
}) {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error('Progressive load concurrency must be positive.');
  }

  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index]!;
      const value = await load(item, index);
      onLoaded(value, item, index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()),
  );
}
