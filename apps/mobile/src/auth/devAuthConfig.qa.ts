import { resolveDevAuthConfig } from './devAuthConfig';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEqual(actual: unknown, expected: unknown, message: string) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${message}\nactual=${JSON.stringify(actual)}\nexpected=${JSON.stringify(expected)}`);
}

const completeEnv = {
  emulatorHost: '127.0.0.1:9099',
  email: 'watchly.ui.review@example.com',
  password: 'local-test-password',
};

assertEqual(resolveDevAuthConfig(true, completeEnv), {
  emulatorUrl: 'http://127.0.0.1:9099',
  email: completeEnv.email,
  password: completeEnv.password,
}, 'Complete development config should enable local auth.');
assert(resolveDevAuthConfig(false, completeEnv) === null, 'Production must never auto-login.');
assert(
  resolveDevAuthConfig(true, { ...completeEnv, password: undefined }) === null,
  'Incomplete credentials must disable dev auto-login.',
);
assertEqual(resolveDevAuthConfig(true, { ...completeEnv, emulatorHost: 'http://localhost:9099' }), {
  emulatorUrl: 'http://localhost:9099',
  email: completeEnv.email,
  password: completeEnv.password,
}, 'Existing protocol should be preserved.');

console.log('Mobile dev auth config QA passed.');
