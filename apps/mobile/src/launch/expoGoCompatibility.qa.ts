// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';

const appConfig = JSON.parse(
  readFileSync(new URL('../../app.json', import.meta.url), 'utf8'),
) as { expo?: { newArchEnabled?: boolean } };

assert.equal(
  appConfig.expo?.newArchEnabled,
  true,
  'Expo Go only supports the React Native New Architecture',
);

async function main() {
  const avatarUploadModule = await import('../profile/uploadProfileAvatar');

  assert.equal(
    typeof avatarUploadModule.chooseAndUploadProfileAvatar,
    'function',
    'Profile avatar upload must be importable before optional native modules are used',
  );

  console.log('Expo Go compatibility QA passed.');
}

void main();
