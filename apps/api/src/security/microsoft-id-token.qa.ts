import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { verifyMicrosoftIdentityWithKeys } from '../auth/microsoft-id-token';

const now = 2_000_000_000;
const tenantId = '11111111-2222-3333-4444-555555555555';
const clientId = 'watchly-microsoft-client';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = {
  ...publicKey.export({ format: 'jwk' }),
  alg: 'RS256',
  kid: 'watchly-key',
  use: 'sig',
};

const token = createIdToken({
  aud: clientId,
  email: 'person@example.com',
  exp: now + 300,
  iss: `https://login.microsoftonline.com/${tenantId}/v2.0`,
  name: 'Watchly Person',
  nbf: now - 10,
  sub: 'microsoft-subject',
  tid: tenantId,
  ver: '2.0',
});
const identity = verifyMicrosoftIdentityWithKeys(token, clientId, [publicJwk], now);

assert.deepEqual(identity, {
  displayName: 'Watchly Person',
  email: 'person@example.com',
  emailVerified: true,
  photoUrl: null,
  provider: 'MICROSOFT',
  providerUserId: 'microsoft-subject',
});
assert.throws(
  () => verifyMicrosoftIdentityWithKeys(token, 'another-client', [publicJwk], now),
  UnauthorizedException,
  'a token issued to another Microsoft application must be rejected',
);
assert.throws(
  () => {
    const [header, payload, signature] = token.split('.');
    const alteredSignature = `${signature.startsWith('A') ? 'B' : 'A'}${signature.slice(1)}`;

    return verifyMicrosoftIdentityWithKeys(
      `${header}.${payload}.${alteredSignature}`,
      clientId,
      [publicJwk],
      now,
    );
  },
  UnauthorizedException,
  'a token with a modified signature must be rejected',
);

function createIdToken(payload: Record<string, unknown>) {
  const header = encode({ alg: 'RS256', kid: 'watchly-key', typ: 'JWT' });
  const body = encode(payload);
  const signature = sign('RSA-SHA256', Buffer.from(`${header}.${body}`), privateKey).toString('base64url');

  return `${header}.${body}.${signature}`;
}

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

console.log('Microsoft ID token QA passed.');
