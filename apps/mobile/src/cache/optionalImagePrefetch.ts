import { Image } from 'react-native';

type IsCurrent = () => boolean;
type PrefetchJob = {
  url: string;
  consumers: IsCurrent[];
  promise: Promise<void>;
  resolve: () => void;
};

/** One budget across callers; only queued/in-flight URLs are retained here. */
export function createOptionalImagePrefetcher(
  load: (url: string) => Promise<unknown>,
  concurrency = 3,
) {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error('Image prefetch concurrency must be a positive integer.');
  }
  const pending = new Map<string, PrefetchJob>();
  const queue: PrefetchJob[] = [];
  let running = 0;

  const wanted = (job: PrefetchJob) => job.consumers.some(isCurrent => isCurrent());
  const finish = (job: PrefetchJob) => {
    pending.delete(job.url);
    job.resolve();
  };
  function pump() {
    // Prune canceled work even when all native prefetch slots are occupied.
    for (let index = queue.length - 1; index >= 0; index -= 1) {
      if (!wanted(queue[index]!)) finish(queue.splice(index, 1)[0]!);
    }
    while (running < concurrency && queue.length) {
      const job = queue.shift()!;
      running += 1;
      void Promise.resolve()
        .then(() => wanted(job) ? load(job.url) : undefined)
        .catch(() => undefined)
        .finally(() => {
          running -= 1;
          finish(job);
          pump();
        });
    }
  }

  return async (urls: readonly (string | null | undefined)[], isCurrent: IsCurrent = () => true) => {
    if (!isCurrent()) return;
    const jobs: Promise<void>[] = [];
    for (const url of new Set(urls.map(value => value?.trim()).filter((value): value is string => Boolean(value)))) {
      let job = pending.get(url);
      if (job) {
        // A slow native request may outlive many focus cycles. Drop obsolete
        // owners instead of retaining all their screen closures until it ends.
        job.consumers = job.consumers.filter(consumer => consumer());
        if (!job.consumers.includes(isCurrent)) job.consumers.push(isCurrent);
      } else {
        let resolve!: () => void;
        const promise = new Promise<void>(done => { resolve = done; });
        job = { url, consumers: [isCurrent], promise, resolve };
        pending.set(url, job);
        queue.push(job);
      }
      jobs.push(job.promise);
    }
    pump();
    await Promise.all(jobs);
  };
}

// Successful artwork remains the native image cache's responsibility.
export const prefetchOptionalImages = createOptionalImagePrefetcher(url => Image.prefetch(url));
