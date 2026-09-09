// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';
import { ApiError, apiGet, apiPostFormData } from './client';
import { analyzeDataImport, cancelDataImport, confirmDataImport, previewDataImport, startBackgroundImport } from './imports';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const appConfig = JSON.parse(
    readFileSync(new URL('../../app.json', import.meta.url), 'utf8'),
  ) as {
    expo: {
      ios: {
        infoPlist: {
          NSAppTransportSecurity?: { NSAllowsLocalNetworking?: boolean };
          NSLocalNetworkUsageDescription?: string;
        };
      };
    };
  };
  const infoPlist = appConfig.expo.ios.infoPlist;

  assert(
    infoPlist.NSAppTransportSecurity?.NSAllowsLocalNetworking === true,
    'The iOS development build must allow its local HTTP API.',
  );
  assert(
    Boolean(infoPlist.NSLocalNetworkUsageDescription?.trim()),
    'The iOS development build must explain why it accesses the local network.',
  );

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

    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) =>
      ({
        text: () =>
          new Promise<never>((_resolve, reject) => {
            init?.signal?.addEventListener(
              'abort',
              () => reject(new DOMException('The operation was aborted.', 'AbortError')),
              { once: true },
            );
          }),
        ok: true,
        status: 200,
      }) as unknown as Response) as typeof fetch;

    const stalledBodyError = await withDeadline(
      apiGet('/qa-stalled-body', { timeoutMs: 5 }).then(
        () => null,
        (caught: unknown) => caught,
      ),
      100,
    );
    assert(stalledBodyError instanceof ApiError, 'Expected a typed stalled-body ApiError.');
    assert(
      stalledBodyError.message === 'API request timed out.',
      'Expected the timeout to cover response body parsing.',
    );

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

    globalThis.fetch = (async () => new Response(null, { status: 200 })) as typeof fetch;
    const emptySuccess = await apiGet<undefined>('/qa-empty-success');
    assert(emptySuccess === undefined, 'Expected an empty 200 response to represent an absent optional resource.');

    globalThis.fetch = (async () => new Response(null, { status: 204 })) as typeof fetch;
    const noContent = await apiGet<undefined>('/qa-no-content');
    assert(noContent === undefined, 'Expected 204 responses to resolve without JSON parsing.');

    const formData = new FormData();
    formData.append('file', new Blob(['Title,Year\nHeat,1995']), 'ratings.csv');
    let uploadRequest: RequestInit | undefined;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      uploadRequest = init;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;
    await apiPostFormData('/qa-upload', formData);
    assert(uploadRequest?.body === formData, 'Form data must be sent without JSON serialization.');
    assert(
      !(uploadRequest?.headers as Record<string, string> | undefined)?.['Content-Type'],
      'Multipart boundaries must be set by fetch.',
    );
    assert(
      (uploadRequest?.headers as Record<string, string> | undefined)?.['X-Watchly-Environment']
        === 'development',
      'Every mobile API request must identify its app environment.',
    );

    globalThis.fetch = (async () => new Response(JSON.stringify({
      code: 'ACCOUNT_LINK_REQUIRED',
      existingProviders: ['GOOGLE'],
      message: 'Sign in with an existing provider.',
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 409,
    })) as typeof fetch;
    const structuredError = await apiGet('/qa-structured-error').then(
      () => null,
      (caught: unknown) => caught,
    );
    assert(structuredError instanceof ApiError);
    assert(structuredError.code === 'ACCOUNT_LINK_REQUIRED');
    assert(
      Array.isArray(structuredError.details?.existingProviders),
      'Structured auth conflicts must preserve the existing provider list.',
    );

    globalThis.fetch = (async () => new Response(JSON.stringify({
      message: 'ThrottlerException: Too Many Requests',
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 429,
    })) as typeof fetch;
    const throttledError = await apiGet('/qa-throttled').then(
      () => null,
      (caught: unknown) => caught,
    );
    assert(throttledError instanceof ApiError);
    assert(
      throttledError.message === 'Watchly is catching up. Try again in a moment.',
      'Rate limits must never expose the server exception name.',
    );
    await verifyImportBatches();
    await verifyImportAnalysis();
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log('Mobile API client QA passed.');
}

async function verifyImportBatches() {
  let uploads = 0;
  let prepared = 0;
  let committed = 0;
  let lostResponse = false;
  const progress: number[] = [];
  globalThis.fetch = async (input) => {
    const path = String(input);
    let payload: unknown;
    if (path.endsWith('/preview?batch=true')) {
      uploads += 1;
      payload = { importId: 'test-import', items: [], preparation: { processed: 0, total: 1001 } };
    } else if (path.endsWith('/prepare')) {
      prepared = Math.min(1001, prepared + 25);
      payload = { importId: 'test-import', items: [], preparation: { processed: prepared, total: 1001 } };
    } else {
      assert(path.endsWith('/confirm?batch=true'), 'Confirmation must use bounded requests.');
      committed = Math.min(1001, committed + 25);
      if (!lostResponse) {
        lostResponse = true;
        throw new TypeError('Simulated lost response after commit');
      }
      payload = { titlesProcessed: committed, completed: committed === 1001 };
    }
    return new Response(JSON.stringify(payload), { status: 200 });
  };
  await previewDataImport('token', 'letterboxd', {
    uri: 'file:///export.zip', name: 'export.zip', file: new File(['export'], 'export.zip'),
  }, (processed) => progress.push(processed));
  assert(uploads === 1 && prepared === 1001, 'One upload must prepare the entire library.');
  assert(progress[0] === 0 && progress.at(-1) === 1001, 'Preparation must expose progress through completion.');
  const result = await confirmDataImport('token', 'test-import');
  assert(result.titlesProcessed === 1001, 'Confirmation must use cumulative results after a lost response.');
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ message: 'Not authorized' }), { status: 401 });
  };
  const error = await confirmDataImport('token', 'test-import').catch((caught: unknown) => caught);
  assert(error instanceof ApiError && calls === 1, 'Authorization errors must stop immediately.');
}

async function verifyImportAnalysis() {
  const requests: string[] = [];
  globalThis.fetch = async (input) => {
    requests.push(String(input));
    return new Response(JSON.stringify({ importId: 'analysis', estimatedSeconds: 121,
      preparation: { processed: 25, total: 2001 }, items: [] }), { status: 200 });
  };
  const analysis = await analyzeDataImport('token', 'letterboxd', {
    uri: 'file:///export.zip', name: 'export.zip', file: new File(['export'], 'export.zip'),
  });
  assert(analysis.estimatedSeconds === 121, 'Analysis must expose the server estimate.');
  assert(requests.length === 1 && requests[0].endsWith('/analyze'), 'Analysis must not start preparation loops or library writes.');
  await cancelDataImport('token', analysis.importId);
  assert(requests.at(-1)?.endsWith('/cancel'), 'Cancel must discard the pending analysis.');
  await startBackgroundImport('token', analysis.importId);
  assert(requests.at(-1)?.endsWith('/background'), 'Background work must require an explicit start request.');
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
