export type AppEnvironment = 'development' | 'production' | 'staging';

type PublicEnvironmentConfig = {
  apiUrl?: string;
  errorTrackingDsn?: string;
  firebaseApiKey?: string;
  firebaseAppId?: string;
  firebaseAuthDomain?: string;
  firebaseAuthEmulatorHost?: string;
  firebaseProjectId?: string;
  uiReviewEmail?: string;
  uiReviewPassword?: string;
};

const appEnvironments = new Set<AppEnvironment>(['development', 'staging', 'production']);

export function resolveAppEnvironment(value: string | undefined): AppEnvironment {
  const environment = value?.trim() || 'development';

  if (!appEnvironments.has(environment as AppEnvironment)) {
    throw new Error(`Invalid EXPO_PUBLIC_APP_ENV: ${environment}.`);
  }

  return environment as AppEnvironment;
}

export function validatePublicEnvironment(
  environment: AppEnvironment,
  config: PublicEnvironmentConfig,
) {
  if (environment === 'development') return;

  const requiredValues = [
    ['EXPO_PUBLIC_API_URL', config.apiUrl],
    ['EXPO_PUBLIC_ERROR_TRACKING_DSN', config.errorTrackingDsn],
    ['EXPO_PUBLIC_FIREBASE_API_KEY', config.firebaseApiKey],
    ['EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', config.firebaseAuthDomain],
    ['EXPO_PUBLIC_FIREBASE_PROJECT_ID', config.firebaseProjectId],
    ['EXPO_PUBLIC_FIREBASE_APP_ID', config.firebaseAppId],
  ] as const;
  const missingValues = requiredValues
    .filter(([, value]) => !value?.trim())
    .map(([name]) => name);

  if (missingValues.length > 0) {
    throw new Error(`${environment} is missing public configuration: ${missingValues.join(', ')}.`);
  }

  const apiUrl = new URL(config.apiUrl!);
  const errorTrackingDsn = new URL(config.errorTrackingDsn!);

  if (apiUrl.protocol !== 'https:') {
    throw new Error(`${environment} must use an HTTPS API URL.`);
  }

  if (isLocalHostname(apiUrl.hostname)) {
    throw new Error(`${environment} cannot use a local API URL.`);
  }

  if (errorTrackingDsn.protocol !== 'https:' || isLocalHostname(errorTrackingDsn.hostname)) {
    throw new Error(`${environment} must use a public HTTPS error tracking DSN.`);
  }

  if (
    config.firebaseAuthEmulatorHost?.trim()
    || config.uiReviewEmail?.trim()
    || config.uiReviewPassword?.trim()
  ) {
    throw new Error(`${environment} cannot include development authentication configuration.`);
  }
}

function isLocalHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (
    normalized === 'localhost'
    || normalized === '0.0.0.0'
    || normalized === '::1'
    || normalized.endsWith('.local')
  ) {
    return true;
  }

  const octets = normalized.split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) return false;

  return (
    octets[0] === 10
    || octets[0] === 127
    || (octets[0] === 169 && octets[1] === 254)
    || (octets[0] === 172 && octets[1]! >= 16 && octets[1]! <= 31)
    || (octets[0] === 192 && octets[1] === 168)
  );
}
