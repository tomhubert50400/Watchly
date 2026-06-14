import 'dotenv/config';

const healthPath = '/health';
const protectedPath = '/auth/me';

async function main() {
  const baseUrl = readRequiredUrl();
  const corsOrigin = process.env.DEPLOYMENT_CORS_ORIGIN ?? process.env.CORS_ORIGIN;
  const rateLimitProbeRequests = Number(process.env.RATE_LIMIT_PROBE_REQUESTS ?? '120');

  const failures = [
    ...(await assertHealth(baseUrl)),
    ...(await assertProtectedAuth(baseUrl)),
    ...(await assertCors(baseUrl, corsOrigin)),
    ...(await assertRateLimit(baseUrl, rateLimitProbeRequests)),
  ];

  if (failures.length > 0) {
    throw new Error(`Deployment smoke failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`);
  }

  console.log('Deployment smoke passed.');
}

function readRequiredUrl() {
  const value = process.env.DEPLOYMENT_API_URL ?? process.env.API_BASE_URL;

  if (!value) {
    throw new Error('Set DEPLOYMENT_API_URL or API_BASE_URL before running deployment smoke.');
  }

  return value.replace(/\/$/, '');
}

async function assertHealth(baseUrl: string) {
  const response = await fetch(`${baseUrl}${healthPath}`);

  if (!response.ok) {
    return [`GET ${healthPath} expected 2xx, received ${response.status}.`];
  }

  const body = await response.json().catch(() => null);

  return body && body.status === 'ok' ? [] : [`GET ${healthPath} should return status ok.`];
}

async function assertProtectedAuth(baseUrl: string) {
  const response = await fetch(`${baseUrl}${protectedPath}`);

  return response.status === 401
    ? []
    : [`GET ${protectedPath} without token expected 401, received ${response.status}.`];
}

async function assertCors(baseUrl: string, corsOrigin: string | undefined) {
  if (!corsOrigin) {
    return ['Set DEPLOYMENT_CORS_ORIGIN or CORS_ORIGIN to verify CORS.'];
  }

  const response = await fetch(`${baseUrl}${healthPath}`, {
    headers: {
      'Access-Control-Request-Method': 'GET',
      Origin: corsOrigin,
    },
    method: 'OPTIONS',
  });
  const allowOrigin = response.headers.get('access-control-allow-origin');

  return response.ok && allowOrigin === corsOrigin
    ? []
    : [`CORS preflight expected allow-origin ${corsOrigin}, received ${allowOrigin ?? 'none'}.`];
}

async function assertRateLimit(baseUrl: string, requests: number) {
  if (!Number.isInteger(requests) || requests < 2) {
    return ['RATE_LIMIT_PROBE_REQUESTS must be an integer greater than 1.'];
  }

  for (let index = 0; index < requests; index += 1) {
    const response = await fetch(`${baseUrl}${protectedPath}`);

    if (response.status === 429) {
      return [];
    }
  }

  return [`Rate limit probe did not receive 429 after ${requests} unauthenticated protected requests.`];
}

void main();
