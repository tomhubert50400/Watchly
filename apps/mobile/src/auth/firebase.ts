import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseOptions, getApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  connectAuthEmulator,
  getAuth,
  getMultiFactorResolver,
  GoogleAuthProvider,
  initializeAuth,
  MultiFactorError,
  NextOrObserver,
  onIdTokenChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  TotpMultiFactorGenerator,
  User,
} from '@firebase/auth';
import * as FirebaseAuth from '@firebase/auth';
import { publicEnv } from '../config/publicEnv';
import { resolveDevAuthConfig } from './devAuthConfig';
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

export type FirebaseGoogleSignInResult =
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

export async function signInWithGoogleIdToken(googleIdToken: string): Promise<FirebaseGoogleSignInResult> {
  const credential = GoogleAuthProvider.credential(googleIdToken);
  const auth = getAuthInstance();

  try {
    const userCredential = await signInWithCredential(auth, credential);

    return {
      session: await getFirebaseSessionFromUser(userCredential.user),
      type: 'signedIn',
    };
  } catch (error) {
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

export async function getFirebaseSessionFromUser(user: User): Promise<FirebaseSession> {
  const firebaseIdToken = await user.getIdToken();

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
