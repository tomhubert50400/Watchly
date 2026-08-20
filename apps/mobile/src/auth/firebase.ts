import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseOptions, getApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  AuthCredential,
  connectAuthEmulator,
  getAuth,
  getMultiFactorResolver,
  GoogleAuthProvider,
  initializeAuth,
  linkWithCredential,
  MultiFactorError,
  NextOrObserver,
  OAuthProvider,
  onIdTokenChanged,
  reauthenticateWithCredential,
  signInWithCredential,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signOut,
  TotpMultiFactorGenerator,
  User,
} from '@firebase/auth';
import * as FirebaseAuth from '@firebase/auth';
import { publicEnv } from '../config/publicEnv';
import { resolveDevAuthConfig } from './devAuthConfig';
import type { MicrosoftTokens } from './microsoftAuth';
import { selectTotpFactor } from './totpChallenge';

const firebaseConfigKeys = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
] as const;

const firebaseConfig = {
  EXPO_PUBLIC_FIREBASE_API_KEY: publicEnv.EXPO_PUBLIC_FIREBASE_API_KEY,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: publicEnv.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: publicEnv.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  EXPO_PUBLIC_FIREBASE_APP_ID: publicEnv.EXPO_PUBLIC_FIREBASE_APP_ID,
} satisfies Record<(typeof firebaseConfigKeys)[number], string | undefined>;

export type FirebaseSession = {
  displayName: string | null;
  email: string | null;
  firebaseIdToken: string;
};

export type FirebaseTotpChallenge = {
  displayName: string | null;
  verify: (oneTimePassword: string) => Promise<FirebaseSession>;
};

export type FirebaseCredentialProvider = 'apple' | 'google' | 'microsoft';

export type FirebaseProviderSignInResult =
  | { credential: AuthCredential; provider: FirebaseCredentialProvider; type: 'linkRequired' }
  | { session: FirebaseSession; type: 'signedIn' }
  | { challenge: FirebaseTotpChallenge; type: 'totpRequired' };

let authInstance: Auth | null = null;
let authEmulatorConnected = false;
const devAuthConfig = resolveDevAuthConfig(
  typeof __DEV__ !== 'undefined' && __DEV__,
  {
    emulatorHost: publicEnv.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST,
    email: publicEnv.EXPO_PUBLIC_UI_REVIEW_EMAIL,
    password: publicEnv.EXPO_PUBLIC_UI_REVIEW_PASSWORD,
  },
);
const reactNativeAuth = FirebaseAuth as typeof FirebaseAuth & {
  getReactNativePersistence: (storage: typeof AsyncStorage) => never;
};

export function getMissingFirebaseConfig(): string[] {
  return firebaseConfigKeys.filter((key) => !firebaseConfig[key]);
}

export async function signInWithGoogleIdToken(googleIdToken: string): Promise<FirebaseProviderSignInResult> {
  const credential = GoogleAuthProvider.credential(googleIdToken);

  return signInWithFirebaseCredential(credential, 'google');
}

export async function signInWithAppleIdentityToken(
  identityToken: string,
  rawNonce: string,
): Promise<FirebaseProviderSignInResult> {
  const provider = new OAuthProvider('apple.com');
  const credential = provider.credential({ idToken: identityToken, rawNonce });

  return signInWithFirebaseCredential(credential, 'apple');
}

export async function signInWithMicrosoftTokens(
  tokens: MicrosoftTokens,
): Promise<FirebaseProviderSignInResult> {
  return signInWithFirebaseCredential(createMicrosoftCredential(tokens), 'microsoft');
}

export async function signInWithWatchlyCustomToken(
  customToken: string,
): Promise<FirebaseSession> {
  const userCredential = await signInWithCustomToken(getAuthInstance(), customToken);

  return getFirebaseSessionFromUser(userCredential.user);
}

export async function linkWithAppleIdentityToken(
  identityToken: string,
  rawNonce: string,
): Promise<FirebaseSession> {
  const provider = new OAuthProvider('apple.com');
  const credential = provider.credential({ idToken: identityToken, rawNonce });

  return linkWithFirebaseCredential(credential);
}

export async function linkWithGoogleIdToken(googleIdToken: string): Promise<FirebaseSession> {
  return linkWithFirebaseCredential(GoogleAuthProvider.credential(googleIdToken));
}

export async function linkWithMicrosoftTokens(tokens: MicrosoftTokens): Promise<FirebaseSession> {
  return linkWithFirebaseCredential(createMicrosoftCredential(tokens));
}

export function linkWithPendingFirebaseCredential(credential: AuthCredential) {
  return linkWithFirebaseCredential(credential);
}

export async function reauthenticateAndRevokeApple(
  identityToken: string,
  rawNonce: string,
  authorizationCode: string,
) {
  const auth = getAuthInstance();
  const user = auth.currentUser;
  const apiKey = firebaseConfig.EXPO_PUBLIC_FIREBASE_API_KEY;

  if (!user) throw new Error('Sign in again before deleting your Watchly account.');
  if (!apiKey) throw new Error('Firebase is not configured for Apple token revocation.');

  const provider = new OAuthProvider('apple.com');
  const credential = provider.credential({ idToken: identityToken, rawNonce });
  const reauthenticated = await reauthenticateWithCredential(user, credential);
  const firebaseIdToken = await reauthenticated.user.getIdToken(true);
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v2/accounts:revokeToken?key=${encodeURIComponent(apiKey)}`,
    {
      body: JSON.stringify({
        idToken: firebaseIdToken,
        providerId: 'apple.com',
        token: authorizationCode,
        tokenType: 'CODE',
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  );

  if (!response.ok) {
    throw new Error('Apple authorization could not be revoked. Your account was not deleted.');
  }

  return firebaseIdToken;
}

async function signInWithFirebaseCredential(
  credential: AuthCredential,
  provider: FirebaseCredentialProvider,
): Promise<FirebaseProviderSignInResult> {
  const auth = getAuthInstance();

  try {
    const userCredential = await signInWithCredential(auth, credential);

    return {
      session: await getFirebaseSessionFromUser(userCredential.user),
      type: 'signedIn',
    };
  } catch (error) {
    if (isAccountExistsWithDifferentCredential(error)) {
      return { credential, provider, type: 'linkRequired' };
    }
    if (!isMultiFactorError(error)) throw error;

    const resolver = getMultiFactorResolver(auth, error);
    const hint = selectTotpFactor(resolver.hints);

    if (!hint) {
      throw new Error('This account requires a second-factor method that Watchly does not support yet.');
    }

    return {
      challenge: {
        displayName: hint.displayName ?? null,
        verify: async (oneTimePassword) => {
          const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, oneTimePassword);
          const userCredential = await resolver.resolveSignIn(assertion);

          return getFirebaseSessionFromUser(userCredential.user);
        },
      },
      type: 'totpRequired',
    };
  }
}

async function linkWithFirebaseCredential(credential: AuthCredential) {
  const user = getAuthInstance().currentUser;

  if (!user) {
    throw new Error('Sign in to your Watchly account before linking another provider.');
  }

  const linkedUser = await linkWithCredential(user, credential);

  return getFirebaseSessionFromUser(linkedUser.user, true);
}

function createMicrosoftCredential(tokens: MicrosoftTokens) {
  const provider = new OAuthProvider('microsoft.com');

  return provider.credential({
    accessToken: tokens.accessToken ?? undefined,
    idToken: tokens.idToken ?? undefined,
  });
}

export async function signInWithConfiguredDevAccount(): Promise<FirebaseSession | null> {
  if (!devAuthConfig) {
    return null;
  }

  const userCredential = await signInWithEmailAndPassword(
    getAuthInstance(),
    devAuthConfig.email,
    devAuthConfig.password,
  );

  return getFirebaseSessionFromUser(userCredential.user);
}

export function signOutFromFirebase(): Promise<void> {
  return signOut(getAuthInstance());
}

export function subscribeToFirebaseIdTokenState(callback: NextOrObserver<User>) {
  return onIdTokenChanged(getAuthInstance(), callback);
}

export async function getFreshFirebaseIdToken(): Promise<string | null> {
  const user = getAuthInstance().currentUser;

  if (!user) {
    return null;
  }

  return user.getIdToken();
}

export async function getFirebaseSessionFromUser(
  user: User,
  forceRefresh = false,
): Promise<FirebaseSession> {
  const firebaseIdToken = await user.getIdToken(forceRefresh);

  return {
    displayName: user.displayName,
    email: user.email,
    firebaseIdToken,
  };
}

function getAuthInstance() {
  if (authInstance) {
    return authInstance;
  }

  const missingConfig = getMissingFirebaseConfig();

  if (missingConfig.length > 0) {
    throw new Error(`Missing Firebase config: ${missingConfig.join(', ')}`);
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(getFirebaseConfig());

  try {
    authInstance = initializeAuth(app, {
      persistence: reactNativeAuth.getReactNativePersistence(AsyncStorage),
    });
  } catch {
    authInstance = getAuth(app);
  }

  if (devAuthConfig && !authEmulatorConnected) {
    connectAuthEmulator(authInstance, devAuthConfig.emulatorUrl, { disableWarnings: true });
    authEmulatorConnected = true;
  }

  return authInstance;
}

function getFirebaseConfig(): FirebaseOptions {
  return {
    apiKey: firebaseConfig.EXPO_PUBLIC_FIREBASE_API_KEY,
    appId: firebaseConfig.EXPO_PUBLIC_FIREBASE_APP_ID,
    authDomain: firebaseConfig.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: firebaseConfig.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  };
}

function isMultiFactorError(error: unknown): error is MultiFactorError {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && error.code === 'auth/multi-factor-auth-required',
  );
}

function isAccountExistsWithDifferentCredential(error: unknown) {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && error.code === 'auth/account-exists-with-different-credential',
  );
}
