import assert from 'node:assert/strict';
import { fetchWithTimeout } from '../catalogue/tmdb-catalogue.service';

async function main() {
  let timeoutSignal: AbortSignal | null = null;
  const neverFetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
    timeoutSignal = init?.signal ?? null;

    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener(
        'abort',
        () => reject(new DOMException('The operation was aborted.', 'AbortError')),
        { once: true },
      );
    });
  }) as typeof fetch;

  const timeoutError = await withDeadline(
    fetchWithTimeout(
      'https://example.invalid/qa-timeout',
      {},
      (response) => response.json(),
      5,
      neverFetch,
    ).then(
      () => null,
      (caught: unknown) => caught,
    ),
    100,
  );

  assert(timeoutError instanceof DOMException && timeoutError.name === 'AbortError');
  assert((timeoutSignal as AbortSignal | null)?.aborted, 'External fetch must receive an aborted timeout signal.');

  let completedSignal: AbortSignal | null | undefined;
  const immediateFetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    completedSignal = init?.signal;
    return new Response('{}', { status: 200 });
  }) as typeof fetch;

  await fetchWithTimeout(
    'https://example.invalid/qa-success',
    {},
    (response) => response.json(),
    10,
    immediateFetch,
  );
  await delay(20);
  assert(
    !(completedSignal as AbortSignal | null | undefined)?.aborted,
    'A completed external request timer must be cleared.',
  );

  let stalledBodySignal: AbortSignal | null = null;
  const stalledBodyFetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    stalledBodySignal = init?.signal ?? null;

    return {
      json: () =>
        new Promise<never>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('The operation was aborted.', 'AbortError')),
            { once: true },
          );
        }),
      ok: true,
      status: 200,
    } as unknown as Response;
  }) as typeof fetch;

  const stalledBodyError = await withDeadline(
    fetchWithTimeout(
      'https://example.invalid/qa-stalled-body',
      {},
      (response) => response.json(),
      5,
      stalledBodyFetch,
    ).then(
      () => null,
      (caught: unknown) => caught,
    ),
    100,
  );
  assert(stalledBodyError instanceof DOMException && stalledBodyError.name === 'AbortError');
  assert(
    (stalledBodySignal as AbortSignal | null)?.aborted,
    'The timeout must remain active while consuming the response body.',
  );

  const callerController = new AbortController();
  let forwardedSignal: AbortSignal | null = null;
  const callerAbortFetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
    forwardedSignal = init?.signal ?? null;
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener(
        'abort',
        () => reject(new DOMException('The operation was aborted.', 'AbortError')),
        { once: true },
      );
    });
  }) as typeof fetch;
  const callerAbortResult = fetchWithTimeout(
    'https://example.invalid/qa-caller-abort',
    { signal: callerController.signal },
    (response) => response.json(),
    100,
    callerAbortFetch,
  ).then(
    () => null,
    (caught: unknown) => caught,
  );
  callerController.abort(new Error('caller cancelled'));
  const callerAbortError = await withDeadline(callerAbortResult, 100);
  assert(callerAbortError instanceof DOMException && callerAbortError.name === 'AbortError');
  assert((forwardedSignal as AbortSignal | null)?.aborted, 'Caller abort must reach the owned fetch signal.');

  const bodyAbortController = new AbortController();
  let bodyAbortSignal: AbortSignal | null = null;
  const bodyAbortFetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    bodyAbortSignal = init?.signal ?? null;
    return {
      json: () =>
        new Promise<never>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('The operation was aborted.', 'AbortError')),
            { once: true },
          );
        }),
      ok: true,
      status: 200,
    } as unknown as Response;
  }) as typeof fetch;
  const bodyAbortResult = fetchWithTimeout(
    'https://example.invalid/qa-body-caller-abort',
    { signal: bodyAbortController.signal },
    (response) => response.json(),
    100,
    bodyAbortFetch,
  ).then(
    () => null,
    (caught: unknown) => caught,
  );
  await delay(0);
  bodyAbortController.abort(new Error('caller cancelled during body'));
  const bodyAbortError = await withDeadline(bodyAbortResult, 100);
  assert(bodyAbortError instanceof DOMException && bodyAbortError.name === 'AbortError');
  assert(
    (bodyAbortSignal as AbortSignal | null)?.aborted,
    'Caller abort must remain connected while consuming the body.',
  );

  let invalidTimeoutFetchCalled = false;
  const invalidTimeoutFetch = (async () => {
    invalidTimeoutFetchCalled = true;
    return new Response('{}');
  }) as typeof fetch;

  for (const timeoutMs of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const invalidError = await fetchWithTimeout(
      'https://example.invalid/qa-invalid-timeout',
      {},
      (response) => response.json(),
      timeoutMs,
      invalidTimeoutFetch,
    ).then(
      () => null,
      (caught: unknown) => caught,
    );
    assert(invalidError instanceof RangeError);
  }
  assert(!invalidTimeoutFetchCalled, 'Invalid timeouts must fail before starting fetch.');

  console.log('External HTTP QA passed.');
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function withDeadline<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('External HTTP QA did not settle.')), milliseconds);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

void main();
