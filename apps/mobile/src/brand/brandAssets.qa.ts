// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { existsSync, readFileSync } from 'node:fs';

const appConfigUrl = new URL('../../app.json', import.meta.url);
const appConfig = JSON.parse(readFileSync(appConfigUrl, 'utf8')).expo;

assert.equal(appConfig.icon, './assets/icon.png');
assert.deepEqual(appConfig.splash, {
  backgroundColor: '#090C13',
  image: './assets/splash-icon.png',
  resizeMode: 'contain',
});
assert.equal(appConfig.android.adaptiveIcon.backgroundColor, '#090C13');
assert.equal(appConfig.android.adaptiveIcon.foregroundImage, './assets/android-icon-foreground.png');
assert.equal(appConfig.android.adaptiveIcon.backgroundImage, './assets/android-icon-background.png');
assert.equal(appConfig.android.adaptiveIcon.monochromeImage, './assets/android-icon-monochrome.png');
assert.equal(appConfig.web.favicon, './assets/favicon.png');

for (const [file, width, height] of [
  ['../../assets/watchly-logo-transparent.png', 1254, 1254],
  ['../../assets/watchly-logo-ui.png', 256, 256],
  ['../../assets/watchly-wordmark-transparent.png', 1774, 887],
  ['../../assets/watchly-wordmark-ui.png', 512, 189],
  ['../../assets/icon.png', 1024, 1024],
  ['../../assets/splash-icon.png', 1024, 1024],
  ['../../assets/favicon.png', 48, 48],
  ['../../assets/android-icon-foreground.png', 512, 512],
  ['../../assets/android-icon-background.png', 512, 512],
  ['../../assets/android-icon-monochrome.png', 432, 432],
] as const) {
  const url = new URL(file, import.meta.url);
  assert.ok(existsSync(url), `${file} must exist`);
  const png = readFileSync(url);
  assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG', `${file} must be a PNG`);
  assert.equal(png.readUInt32BE(16), width, `${file} must have the expected width`);
  assert.equal(png.readUInt32BE(20), height, `${file} must have the expected height`);
}

const brandLogoSource = readFileSync(new URL('BrandLogo.tsx', import.meta.url), 'utf8');
const brandWordmarkSource = readFileSync(new URL('BrandWordmark.tsx', import.meta.url), 'utf8');
const appHeaderSource = readFileSync(new URL('../components/AppHeader.tsx', import.meta.url), 'utf8');
const authSource = readFileSync(new URL('../auth/ProfileAuthCard.tsx', import.meta.url), 'utf8');
const homeSource = readFileSync(new URL('../home/HomeScreen.tsx', import.meta.url), 'utf8');
const screenSource = readFileSync(new URL('../components/Screen.tsx', import.meta.url), 'utf8');

assert.match(brandLogoSource, /watchly-logo-ui\.png/, 'runtime UI must use the optimized logo asset');
assert.doesNotMatch(brandLogoSource, /watchly-logo-transparent\.png/, 'runtime UI must not decode the full source logo');
assert.match(brandLogoSource, /accessible=\{false\}/, 'decorative brand marks must not repeat nearby accessible text');
assert.match(brandLogoSource, /alignSelf: 'center'/, 'the sign-in brand mark must stay centered');
assert.match(brandWordmarkSource, /watchly-wordmark-ui\.png/, 'Home must use the optimized wordmark asset');
assert.doesNotMatch(brandWordmarkSource, /watchly-wordmark-transparent\.png/, 'Home must not decode the full wordmark source');
assert.match(brandWordmarkSource, /accessible=\{false\}/, 'the visual wordmark must not duplicate its header label');
assert.match(brandWordmarkSource, /accessibilityLabel="Watchly"/, 'the wordmark must preserve the Home heading label');
assert.match(brandWordmarkSource, /accessibilityRole="header"/, 'the wordmark must remain a semantic heading');
assert.match(authSource, /<BrandLogo size=\{76\}/, 'sign-in must use the official Watchly mark');
assert.doesNotMatch(authSource, /logoText/, 'the placeholder W must be removed');
assert.equal((homeSource.match(/<BrandWordmark height=\{44\} \/>/g) ?? []).length, 3, 'all Home states must use the Watchly wordmark');
assert.doesNotMatch(homeSource, /title="Watchly"/, 'the Home wordmark must replace the text title');
assert.match(appHeaderSource, /\{title \? \(/, 'empty visual headers must not render an empty text title');
assert.match(screenSource, /leading\?: ReactNode/, 'Screen must expose the existing AppHeader leading slot');

console.log('Watchly brand asset QA passed.');
