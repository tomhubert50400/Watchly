import { ApiError, apiGet } from './client';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('The operation was aborted.', 'AbortError')),
          { once: true },
        );
      })) as typeof fetch;

    const error = await withDeadline(
      apiGet('/qa-timeout', { timeoutMs: 5 }).then(
        () => null,
        (caught: unknown) => caught,
      ),
      100,
    );

    assert(error instanceof ApiError, 'Expected a typed ApiError.');
    assert(error.message === 'API request timed out.', 'Expected a timeout-specific error message.');

    let completedSignal: AbortSignal | null | undefined;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      completedSignal = init?.signal;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }) as typeof fetch;

    const payload = await apiGet<{ ok: boolean }>('/qa-success', { timeoutMs: 10 });
    assert(payload.ok, 'Expected a JSON success body.');
    await delay(20);
    assert(!completedSignal?.aborted, 'A completed request timer must be cleared.');

    let invalidTimeoutFetchCalled = false;
    globalThis.fetch = (async () => {
      invalidTimeoutFetchCalled = true;
      return new Response('{}');
    }) as typeof fetch;

    for (const timeoutMs of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const invalidError = await apiGet('/qa-invalid-timeout', { timeoutMs }).then(
        () => null,
        (caught: unknown) => caught,
      );
      assert(invalidError instanceof ApiError, 'Expected invalid timeouts to produce ApiError.');
      assert(
        invalidError.message === 'API request timeout must be a positive finite number.',
        'Expected a stable invalid-timeout message.',
      );
    }
    assert(!invalidTimeoutFetchCalled, 'Invalid timeout values must fail before fetch.');

    globalThis.fetch = (async () => new Response(null, { status: 204 })) as typeof fetch;
    const noContent = await apiGet<undefined>('/qa-no-content');
    assert(noContent === undefined, 'Expected 204 responses to resolve without JSON parsing.');
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log('Mobile API client QA passed.');
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
        timer = setTimeout(() => reject(new Error('API request did not time out.')), milliseconds);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

void main();
