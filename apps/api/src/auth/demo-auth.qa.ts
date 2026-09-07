import 'reflect-metadata';
import assert from 'node:assert/strict';
import { Module, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { initializeApp } from 'firebase-admin/app';
import { DecodedIdToken, getAuth, UserRecord } from 'firebase-admin/auth';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DemoAuthService } from './demo-auth.service';
import { DEMO_FIREBASE_UID, hashDemoPassword, verifyDemoPassword } from './demo-credentials';
import { ExternalOAuthService } from './external-oauth.service';
import { FirebaseTokenVerifier, verifyBearerTokenWithAuth } from './firebase-token-verifier.service';
import { ProxyAwareThrottlerGuard } from '../security/proxy-aware-throttler.guard';

async function main() {
  const password = 'qa-password-for-demo-access';
  const hash = await hashDemoPassword(password);
  assert.equal(await verifyDemoPassword(password, hash), true);
  assert.equal(await verifyDemoPassword('incorrect', hash), false);
  assert.equal(await verifyDemoPassword(password, 'malformed'), false);
  assert.notEqual(await hashDemoPassword(password), hash, 'Each password hash needs an independent salt.');

  initializeApp({ projectId: 'demo-auth-qa' });
  const firebase = getAuth();
  let tokenCount = 0;
  let suspended = false;
  let account = { uid: DEMO_FIREBASE_UID, disabled: false, customClaims: { watchlyDemo: true }, providerData: [] } as unknown as UserRecord;
  firebase.getUser = async (uid) => { assert.equal(uid, DEMO_FIREBASE_UID); return account; };
  firebase.createCustomToken = async (uid, claims) => {
    assert.equal(uid, DEMO_FIREBASE_UID, 'The caller must never choose another Firebase UID.');
    assert.equal((claims as Record<string, unknown>)?.watchlyProvider, 'DEMO');
    assert.equal((claims as Record<string, unknown>)?.watchlyDemo, true);
    tokenCount += 1;
    return 'test-custom-token';
  };
  const config = new ConfigService({ DEMO_AUTH_USERNAME: 'review', DEMO_AUTH_PASSWORD_HASH: hash });
  const authService = {
    assertActiveIdentity: async () => { if (suspended) throw new UnauthorizedException(); },
    getOrCreateUser: async () => ({}),
  } as unknown as AuthService;
  const service = new DemoAuthService(config, authService);
  const credentials = { username: 'review', password };
  for (const body of [{}, { username: 'review', password: 'wrong' }, { username: 'other', password }, { username: 'review', password: 'x'.repeat(257) }]) {
    await assert.rejects(service.signIn(body), UnauthorizedException);
  }
  await assert.rejects(new DemoAuthService(new ConfigService(), authService).signIn(credentials), UnauthorizedException);
  for (const patch of [{ disabled: true }, { customClaims: {} }, { customClaims: { watchlyDemo: true, admin: true } }]) {
    const previous = account;
    account = { ...account, ...patch } as UserRecord;
    await assert.rejects(service.signIn(credentials), UnauthorizedException);
    account = previous;
  }
  suspended = true;
  await assert.rejects(service.signIn(credentials), UnauthorizedException);
  suspended = false;
  const readAccount = firebase.getUser;
  firebase.getUser = async () => { throw Object.assign(new Error('Missing'), { code: 'auth/user-not-found' }); };
  await assert.rejects(service.signIn(credentials), UnauthorizedException);
  firebase.getUser = readAccount;
  assert.equal(tokenCount, 0, 'Rejected attempts must never mint a session.');
  assert.deepEqual(await service.signIn({ ...credentials, firebaseUid: 'another-user' }), { firebaseCustomToken: 'test-custom-token' });

  const token = {
    uid: DEMO_FIREBASE_UID,
    firebase: { sign_in_provider: 'custom', identities: {} },
    watchlyProvider: 'DEMO', watchlyProviderUserId: DEMO_FIREBASE_UID, watchlyDemo: true,
  } as unknown as DecodedIdToken;
  const verifier = (patch = {}) => ({ verifyIdToken: async () => ({ ...token, ...patch }) });
  const identity = await verifyBearerTokenWithAuth(verifier(), 'id-token', { demoEnabled: true });
  assert.equal(identity.provider, 'DEMO');
  assert.equal(identity.firebaseUid, DEMO_FIREBASE_UID);
  await assert.rejects(verifyBearerTokenWithAuth(verifier(), 'id-token'), UnauthorizedException);
  const linkedOAuth = { firebase: { sign_in_provider: 'google.com', identities: { 'google.com': ['review-google'] } } };
  assert.equal((await verifyBearerTokenWithAuth(verifier(linkedOAuth), 'linked-token', { demoEnabled: true })).firebaseUid, DEMO_FIREBASE_UID);
  await assert.rejects(verifyBearerTokenWithAuth(verifier(linkedOAuth), 'linked-token'), UnauthorizedException);
  for (const patch of [{ uid: 'someone-else' }, { watchlyProviderUserId: 'someone-else' }, { watchlyDemo: false }, { admin: true }]) {
    await assert.rejects(verifyBearerTokenWithAuth(verifier(patch), 'id-token', { demoEnabled: true }), UnauthorizedException);
  }
  await assert.rejects(verifyBearerTokenWithAuth({ verifyIdToken: async () => { throw new Error('Revoked'); } }, 'revoked', { demoEnabled: true }), UnauthorizedException);

  @Module({
    imports: [ThrottlerModule.forRoot([{ limit: 100, ttl: 60_000 }])],
    controllers: [AuthController],
    providers: [
      { provide: AuthService, useValue: authService },
      { provide: DemoAuthService, useValue: service },
      { provide: ExternalOAuthService, useValue: {} },
      { provide: FirebaseTokenVerifier, useValue: {} },
      { provide: APP_GUARD, useClass: ProxyAwareThrottlerGuard },
    ],
  })
  class TestModule {}
  const app = await NestFactory.create(TestModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  try {
    const url = `${await app.getUrl()}/auth/demo/sign-in`;
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'review', password: 'wrong' }) });
      assert.equal(response.status, 401);
    }
    const request = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) };
    const success = await fetch(url, request);
    assert.equal(success.status, 200);
    assert.equal(success.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await success.json(), { firebaseCustomToken: 'test-custom-token' });
    assert.equal((await fetch(url, request)).status, 429, 'The real route must stop a sixth attempt.');
  } finally {
    await app.close();
  }
  console.log('Demo auth QA passed: credentials, account isolation, revoked/disabled sessions and HTTP throttling.');
}

void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
