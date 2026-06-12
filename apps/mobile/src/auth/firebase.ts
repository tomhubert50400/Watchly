import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseOptions, getApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  getAuth,
  GoogleAuthProvider,
  initializeAuth,
  NextOrObserver,
  onAuthStateChanged,
  signInWithCredential,
  signOut,
  User,
} from '@firebase/auth';
import * as FirebaseAuth from '@firebase/auth';

const firebaseConfigKeys = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
] as const;

export type FirebaseSession = {
  displayName: string | null;
  email: string | null;
  firebaseIdToken: string;
};

let authInstance: Auth | null = null;
const reactNativeAuth = FirebaseAuth as typeof FirebaseAuth & {
  getReactNativePersistence: (storage: typeof AsyncStorage) => never;
};

export function getMissingFirebaseConfig(): string[] {
  return firebaseConfigKeys.filter((key) => !process.env[key]);
}

export async function signInWithGoogleIdToken(googleIdToken: string): Promise<FirebaseSession> {
  const credential = GoogleAuthProvider.credential(googleIdToken);
  const userCredential = await signInWithCredential(getAuthInstance(), credential);

  return getFirebaseSessionFromUser(userCredential.user);
}

export function signOutFromFirebase(): Promise<void> {
  return signOut(getAuthInstance());
}

export function subscribeToFirebaseAuthState(callback: NextOrObserver<User>) {
  return onAuthStateChanged(getAuthInstance(), callback);
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

  return authInstance;
}

function getFirebaseConfig(): FirebaseOptions {
  return {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  };
}
