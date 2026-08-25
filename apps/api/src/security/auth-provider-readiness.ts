type AuthProviderReadinessConfig = {
  apiUrl: string;
  appEnvironment: string;
  firebaseApiKey: string;
  firebaseAuthDomain: string;
};

const PROBE_TIMEOUT_MS = 15_000;

export async function checkAuthProviderReadiness(
  config: AuthProviderReadinessConfig,
  request: typeof fetch = fetch,
) {
  const apiUrl = requireHttpsUrl(config.apiUrl, 'API URL');
  const firebaseAuthDomain = requireFirebaseAuthDomain(config.firebaseAuthDomain);
  const firebaseApiKey = requireValue(config.firebaseApiKey, 'Firebase API key');
  const appEnvironment = requireValue(config.appEnvironment, 'app environment');

  await Promise.all([
    assertFirebaseProviderEnabled('google.com', firebaseApiKey, firebaseAuthDomain, request),
    assertFirebaseProviderEnabled('apple.com', firebaseApiKey, firebaseAuthDomain, request),
    assertMicrosoftConfigured(apiUrl, appEnvironment, request),
    assertDiscordConfigured(apiUrl, appEnvironment, request),
  ]);
}

async function assertFirebaseProviderEnabled(
  providerId: 'apple.com' | 'google.com',
  apiKey: string,
  authDomain: string,
  request: typeof fetch,
) {
  const endpoint = new URL('https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp');
  endpoint.searchParams.set('key', apiKey);
  const response = await request(endpoint, {
    body: JSON.stringify({
      postBody: new URLSearchParams({
        id_token: 'watchly-invalid-provider-readiness-proof',
        providerId,
      }).toString(),
      requestUri: `https://${authDomain}/__/auth/handler`,
      returnIdpCredential: true,
      returnSecureToken: true,
    }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
  });
  const message = await readErrorMessage(response);

  if (message.includes('OPERATION_NOT_ALLOWED')) {
    throw new Error(`${providerId} provider is disabled in Firebase.`);
  }
  if (response.status !== 400 || !message.includes('INVALID_IDP_RESPONSE')) {
    throw new Error(`${providerId} Firebase readiness probe returned HTTP ${response.status}.`);
  }
}

async function assertMicrosoftConfigured(
  apiUrl: URL,
  appEnvironment: string,
  request: typeof fetch,
) {
  const response = await request(new URL('/auth/oauth/microsoft/token', apiUrl), {
    body: JSON.stringify({ idToken: 'watchly-invalid-provider-readiness-proof' }),
    headers: apiHeaders(appEnvironment),
    method: 'POST',
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
  });
  const message = await readErrorMessage(response);

  if (response.status !== 401 || !message.includes('Microsoft authentication token is invalid')) {
    throw new Error(`Microsoft readiness probe returned HTTP ${response.status}.`);
  }
}

async function assertDiscordConfigured(
  apiUrl: URL,
  appEnvironment: string,
  request: typeof fetch,
) {
  const response = await request(new URL('/auth/oauth/discord/mobile', apiUrl), {
    body: JSON.stringify({
      code: 'watchly-invalid-provider-readiness-proof',
      codeVerifier: 'a'.repeat(43),
      redirectUri: 'watchly-invalid:/authorize/callback',
    }),
    headers: apiHeaders(appEnvironment),
    method: 'POST',
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
  });
  const message = await readErrorMessage(response);

  if (response.status !== 400 || message !== 'The Discord mobile redirect URI is invalid.') {
    throw new Error(`Discord readiness probe returned HTTP ${response.status}.`);
  }
}

function apiHeaders(appEnvironment: string) {
  return {
    'content-type': 'application/json',
    'X-Watchly-Environment': appEnvironment,
  };
}

async function readErrorMessage(response: Response) {
  const body = await response.json().catch(() => null) as {
    error?: { message?: unknown };
    message?: unknown;
  } | null;
  const message = body?.error?.message ?? body?.message;

  return typeof message === 'string' ? message : '';
}

function requireHttpsUrl(value: string, label: string) {
  const url = new URL(requireValue(value, label));
  if (url.protocol !== 'https:') throw new Error(`${label} must use HTTPS.`);

  return url;
}

function requireFirebaseAuthDomain(value: string) {
  const authDomain = requireValue(value, 'Firebase Auth domain');
  if (authDomain.includes('/') || authDomain.includes(':')) {
    throw new Error('Firebase Auth domain must be a hostname.');
  }

  return authDomain;
}

function requireValue(value: string, label: string) {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${label} is required.`);

  return normalized;
}

async function main() {
  await checkAuthProviderReadiness({
    apiUrl: process.env.DEPLOYMENT_API_URL ?? '',
    appEnvironment: process.env.DEPLOYMENT_APP_ENV ?? '',
    firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
    firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  });
  console.log('Auth provider readiness passed: Google, Apple, Microsoft, and Discord.');
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Auth provider readiness failed.');
    process.exitCode = 1;
  });
}
