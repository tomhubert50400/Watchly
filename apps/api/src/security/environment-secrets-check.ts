import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const apiRequiredEnv = [
  'APP_ENV',
  'NODE_ENV',
  'PORT',
  'CORS_ORIGIN',
  'DATABASE_URL',
  'FIREBASE_PROJECT_ID',
  'RATE_LIMIT_TTL_MS',
  'RATE_LIMIT_MAX_REQUESTS',
  'TMDB_ACCESS_TOKEN',
];

const mobileAllowedEnvPrefixes = ['EXPO_PUBLIC_'];
const backendOnlyNames = ['DATABASE_URL', 'TMDB_ACCESS_TOKEN', 'FIREBASE_AUTH_EMULATOR_HOST'];

function main() {
  const repoRoot = join(process.cwd(), '..', '..');
  const mobileRoot = join(repoRoot, 'apps', 'mobile');
  const apiEnvExample = readFileSync(join(process.cwd(), '.env.example'), 'utf8');
  const mobileEnvExample = readFileSync(join(mobileRoot, '.env.example'), 'utf8');
  const mobileSource = readMobileSource(mobileRoot);
  const apiModule = readFileSync(join(process.cwd(), 'src', 'app.module.ts'), 'utf8');

  const failures = [
    ...assertApiEnvExample(apiEnvExample),
    ...assertConfigValidation(apiModule),
    ...assertMobileEnvExample(mobileEnvExample),
    ...assertNoBackendSecretsInMobile(mobileEnvExample, mobileSource),
  ];

  if (failures.length > 0) {
    throw new Error(`Environment and secrets check failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`);
  }

  console.log('Environment and secrets check passed.');
}

function assertApiEnvExample(contents: string) {
  return apiRequiredEnv.flatMap((name) =>
    hasEnvName(contents, name) ? [] : [`apps/api/.env.example must document ${name}.`],
  );
}

function assertConfigValidation(contents: string) {
  return apiRequiredEnv.flatMap((name) =>
    contents.includes(`${name}:`) ? [] : [`AppModule config validation must include ${name}.`],
  );
}

function assertMobileEnvExample(contents: string) {
  const names = parseEnvNames(contents);

  return names.flatMap((name) =>
    mobileAllowedEnvPrefixes.some((prefix) => name.startsWith(prefix))
      ? []
      : [`apps/mobile/.env.example must not expose non-public variable ${name}.`],
  );
}

function assertNoBackendSecretsInMobile(envExample: string, source: string) {
  const envNames = parseEnvNames(envExample);

  return backendOnlyNames.flatMap((name) =>
    envNames.includes(name) || containsExactEnvName(source, name)
      ? [`Mobile app must not reference backend-only secret ${name}.`]
      : [],
  );
}

function containsExactEnvName(contents: string, name: string) {
  return new RegExp(`(^|[^A-Z0-9_])${name}([^A-Z0-9_]|$)`).test(contents);
}

function parseEnvNames(contents: string) {
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => line.split('=')[0]?.trim())
    .filter((name): name is string => Boolean(name));
}

function hasEnvName(contents: string, name: string) {
  return parseEnvNames(contents).includes(name);
}

function readMobileSource(mobileRoot: string) {
  const paths = [join(mobileRoot, 'App.tsx'), ...listTypeScriptFiles(join(mobileRoot, 'src'))];

  return paths.map((path) => readFileSync(path, 'utf8')).join('\n');
}

function listTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      return listTypeScriptFiles(fullPath);
    }

    return entry.endsWith('.ts') || entry.endsWith('.tsx') ? [fullPath] : [];
  });
}

main();
