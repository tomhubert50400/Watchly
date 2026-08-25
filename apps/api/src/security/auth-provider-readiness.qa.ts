import assert from 'node:assert/strict';
import { checkAuthProviderReadiness } from './auth-provider-readiness';

const requests: Array<{ init?: RequestInit; url: string }> = [];
const successfulProbeFetch: typeof fetch = async (input, init) => {
  const url = String(input);
  requests.push({ init, url });

  if (url.includes('identitytoolkit.googleapis.com')) {
    return jsonResponse(400, { error: { message: 'INVALID_IDP_RESPONSE: invalid proof credential' } });
  }
  if (url.endsWith('/auth/oauth/microsoft/token')) {
    return jsonResponse(401, { message: 'Microsoft authentication token is invalid or expired.' });
  }
  if (url.endsWith('/auth/oauth/discord/mobile')) {
    return jsonResponse(400, { message: 'The Discord mobile redirect URI is invalid.' });
  }

  throw new Error(`Unexpected readiness URL: ${url}`);
};

async function main() {
  await checkAuthProviderReadiness({
    apiUrl: 'https://watchly-api-staging.example',
    appEnvironment: 'staging',
    firebaseApiKey: 'public-api-key',
    firebaseAuthDomain: 'watchly-staging.example',
  }, successfulProbeFetch);

  assert.equal(requests.length, 4);
  assert.equal(
    requests.filter(({ url }) => url.includes('identitytoolkit.googleapis.com')).length,
    2,
  );
  for (const request of requests.filter(({ url }) => url.includes('/auth/oauth/'))) {
    assert.equal(new Headers(request.init?.headers).get('X-Watchly-Environment'), 'staging');
  }

  await assert.rejects(
    () => checkAuthProviderReadiness({
      apiUrl: 'https://watchly-api-staging.example',
      appEnvironment: 'staging',
      firebaseApiKey: 'public-api-key',
      firebaseAuthDomain: 'watchly-staging.example',
    }, async (input, init) => {
      if (String(input).includes('identitytoolkit.googleapis.com')) {
        return jsonResponse(400, { error: { message: 'OPERATION_NOT_ALLOWED' } });
      }
      return successfulProbeFetch(input, init);
    }),
    /provider is disabled/,
  );

  console.log('Auth provider readiness QA passed.');
}

void main();

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}
