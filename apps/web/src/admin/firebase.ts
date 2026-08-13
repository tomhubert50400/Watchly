'use client';

import { FirebaseOptions, getApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  browserLocalPersistence,
  getAuth,
  setPersistence,
} from 'firebase/auth';

let authPromise: Promise<Auth> | null = null;

export function getAdminAuth(): Promise<Auth> {
  if (authPromise) return authPromise;

  authPromise = initializeAdminAuth();
  return authPromise;
}

async function initializeAdminAuth() {
  const config = getFirebaseConfig();
  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing Firebase configuration: ${missing.join(', ')}`);
  }

  const app = getApps().some((candidate) => candidate.name === 'watchly-admin')
    ? getApp('watchly-admin')
    : initializeApp(config, 'watchly-admin');
  const auth = getAuth(app);

  await setPersistence(auth, browserLocalPersistence);

  return auth;
}

function getFirebaseConfig(): FirebaseOptions {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  };
}
