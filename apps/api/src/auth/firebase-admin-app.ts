import { AppOptions, cert, getApps, initializeApp } from 'firebase-admin/app';

type FirebaseServiceAccount = {
  clientEmail: string;
  privateKey: string;
  projectId: string;
};

export function initializeFirebaseAdmin(
  projectId: string,
  serviceAccountJson: string | undefined,
) {
  if (getApps().length > 0) return;

  initializeApp(getFirebaseAdminOptions(projectId, serviceAccountJson));
}

export function getFirebaseAdminOptions(
  projectId: string,
  serviceAccountJson: string | undefined,
): AppOptions {
  const serviceAccount = parseFirebaseServiceAccount(serviceAccountJson, projectId);

  return serviceAccount
    ? { credential: cert(serviceAccount), projectId }
    : { projectId };
}

export function parseFirebaseServiceAccount(
  serviceAccountJson: string | undefined,
  expectedProjectId: string,
): FirebaseServiceAccount | null {
  if (!serviceAccountJson?.trim()) return null;

  let parsed: unknown;

  try {
    parsed = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must contain valid JSON.');
  }

  if (!isRecord(parsed)) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must contain a service account object.');
  }

  const projectId = readRequiredString(parsed, 'project_id');

  if (projectId !== expectedProjectId) {
    throw new Error('The Firebase service account project does not match FIREBASE_PROJECT_ID.');
  }

  return {
    clientEmail: readRequiredString(parsed, 'client_email'),
    privateKey: readRequiredString(parsed, 'private_key'),
    projectId,
  };
}

function readRequiredString(value: Record<string, unknown>, key: string) {
  const field = value[key];

  if (typeof field !== 'string' || !field.trim()) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT_JSON is missing ${key}.`);
  }

  return field;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
