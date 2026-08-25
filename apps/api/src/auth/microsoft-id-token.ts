import {
  createPublicKey,
  verify as verifySignature,
} from 'node:crypto';
import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthProvider } from '../generated/prisma/enums';
import type { ExternalProviderIdentity } from './external-oauth.provider';

const MICROSOFT_JWKS_URL = 'https://login.microsoftonline.com/common/discovery/v2.0/keys';
const KEY_CACHE_LIFETIME_MS = 60 * 60 * 1000;
const CLOCK_TOLERANCE_SECONDS = 60;
const MICROSOFT_JWKS_TIMEOUT_MS = 10_000;
const MICROSOFT_TENANT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type MicrosoftJwtHeader = {
  alg?: unknown;
  kid?: unknown;
};

type MicrosoftJwtPayload = {
  aud?: unknown;
  email?: unknown;
  exp?: unknown;
  iss?: unknown;
  name?: unknown;
  nbf?: unknown;
  preferred_username?: unknown;
  sub?: unknown;
  tid?: unknown;
  ver?: unknown;
};

type MicrosoftJwk = JsonWebKey & {
  alg?: string;
  issuer?: string;
  kid?: string;
  kty?: string;
  use?: string;
};

let cachedKeys: { expiresAt: number; keys: MicrosoftJwk[] } | null = null;

export async function verifyMicrosoftIdentity(
  config: ConfigService,
  idToken: string,
): Promise<ExternalProviderIdentity> {
  const clientId = config.get<string>('MICROSOFT_OAUTH_CLIENT_ID')?.trim();

  if (!clientId) {
    throw new ServiceUnavailableException('Microsoft sign-in is not configured yet.');
  }

  return verifyMicrosoftIdentityWithKeys(idToken, clientId, await getMicrosoftSigningKeys());
}

export function verifyMicrosoftIdentityWithKeys(
  idToken: string,
  clientId: string,
  keys: MicrosoftJwk[],
  nowSeconds = Math.floor(Date.now() / 1000),
): ExternalProviderIdentity {
  const sections = idToken.split('.');
  if (sections.length !== 3) throw invalidMicrosoftToken();

  const [encodedHeader, encodedPayload, encodedSignature] = sections;
  const header = parseJwtSection<MicrosoftJwtHeader>(encodedHeader);
  const payload = parseJwtSection<MicrosoftJwtPayload>(encodedPayload);

  if (header.alg !== 'RS256' || typeof header.kid !== 'string') {
    throw invalidMicrosoftToken();
  }

  const tenantId = getRequiredMicrosoftTenantId(payload.tid);
  const subject = getRequiredString(payload.sub);
  const expectedIssuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;

  const signingKey = keys.find((key) => (
    key.kid === header.kid
    && key.kty === 'RSA'
    && (!key.alg || key.alg === 'RS256')
    && (!key.use || key.use === 'sig')
    && microsoftKeyIssuerMatches(key.issuer, expectedIssuer, tenantId)
  ));
  if (!signingKey) throw invalidMicrosoftToken();

  let signatureIsValid = false;
  try {
    signatureIsValid = verifySignature(
      'RSA-SHA256',
      Buffer.from(`${encodedHeader}.${encodedPayload}`),
      createPublicKey({ format: 'jwk', key: signingKey }),
      Buffer.from(encodedSignature, 'base64url'),
    );
  } catch {
    throw invalidMicrosoftToken();
  }
  if (!signatureIsValid) throw invalidMicrosoftToken();

  const audienceIsValid = payload.aud === clientId
    || (Array.isArray(payload.aud) && payload.aud.includes(clientId));

  if (
    payload.ver !== '2.0'
    || payload.iss !== expectedIssuer
    || !audienceIsValid
    || typeof payload.exp !== 'number'
    || payload.exp < nowSeconds - CLOCK_TOLERANCE_SECONDS
    || (typeof payload.nbf === 'number' && payload.nbf > nowSeconds + CLOCK_TOLERANCE_SECONDS)
  ) {
    throw invalidMicrosoftToken();
  }

  const email = getMicrosoftEmail(payload);

  return {
    displayName: getOptionalString(payload.name),
    email,
    emailVerified: false,
    photoUrl: null,
    provider: AuthProvider.MICROSOFT,
    providerUserId: `${tenantId}:${subject}`,
  };
}

export function getLegacyMicrosoftProviderUserId(providerUserId: string) {
  const separatorIndex = providerUserId.indexOf(':');
  const tenantId = providerUserId.slice(0, separatorIndex);
  const subject = providerUserId.slice(separatorIndex + 1);

  return separatorIndex === 36
    && MICROSOFT_TENANT_ID_PATTERN.test(tenantId)
    && subject
    ? subject
    : null;
}

async function getMicrosoftSigningKeys() {
  const now = Date.now();
  if (cachedKeys && cachedKeys.expiresAt > now) return cachedKeys.keys;

  let response: Response;
  try {
    response = await fetch(MICROSOFT_JWKS_URL, {
      signal: AbortSignal.timeout(MICROSOFT_JWKS_TIMEOUT_MS),
    });
  } catch {
    throw new ServiceUnavailableException('Microsoft sign-in could not be verified right now.');
  }

  let payload: { keys?: unknown };
  try {
    payload = await response.json() as { keys?: unknown };
  } catch {
    throw new ServiceUnavailableException('Microsoft sign-in could not be verified right now.');
  }

  if (!response.ok || !Array.isArray(payload.keys)) {
    throw new ServiceUnavailableException('Microsoft sign-in could not be verified right now.');
  }

  const keys = payload.keys.filter((key): key is MicrosoftJwk => Boolean(key && typeof key === 'object'));
  if (keys.length === 0) {
    throw new ServiceUnavailableException('Microsoft sign-in could not be verified right now.');
  }

  cachedKeys = { expiresAt: now + KEY_CACHE_LIFETIME_MS, keys };
  return keys;
}

function parseJwtSection<T>(section: string | undefined): T {
  if (!section || section.length > 12_000) throw invalidMicrosoftToken();

  try {
    return JSON.parse(Buffer.from(section, 'base64url').toString('utf8')) as T;
  } catch {
    throw invalidMicrosoftToken();
  }
}

function getMicrosoftEmail(payload: MicrosoftJwtPayload) {
  const candidate = getOptionalString(payload.email) ?? getOptionalString(payload.preferred_username);
  const normalized = candidate?.trim() ?? null;

  return normalized && normalized.length <= 320 && normalized.includes('@') ? normalized : null;
}

function getRequiredString(value: unknown) {
  const normalized = getOptionalString(value);
  if (!normalized || normalized.length > 512) throw invalidMicrosoftToken();

  return normalized;
}

function getRequiredMicrosoftTenantId(value: unknown) {
  const tenantId = getRequiredString(value);
  if (!MICROSOFT_TENANT_ID_PATTERN.test(tenantId)) throw invalidMicrosoftToken();

  return tenantId.toLowerCase();
}

function microsoftKeyIssuerMatches(
  keyIssuer: string | undefined,
  expectedIssuer: string,
  tenantId: string,
) {
  if (!keyIssuer) return false;

  return keyIssuer.replace(/\{tenantid\}/gi, tenantId) === expectedIssuer;
}

function getOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function invalidMicrosoftToken() {
  return new UnauthorizedException('Microsoft authentication token is invalid or expired.');
}
