// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';
import { launchTimeline, resolveLaunchRevealStart } from './launchAnimationModel';

assert.equal(launchTimeline.lettersEndMs - launchTimeline.lettersStartMs, 1_230);
assert.equal(launchTimeline.lettersStartMs - launchTimeline.deployEndMs, 100);
assert.equal(launchTimeline.dockStartMs - launchTimeline.lettersEndMs, 100);
assert.equal(resolveLaunchRevealStart(4_000), launchTimeline.dockEndMs);
assert.equal(resolveLaunchRevealStart(5_700), 5_700);
assert.equal(resolveLaunchRevealStart(null), launchTimeline.revealLatestStartMs);
assert.equal(resolveLaunchRevealStart(9_000), launchTimeline.revealLatestStartMs);
assert.equal(
  launchTimeline.revealLatestStartMs + launchTimeline.revealDurationMs,
  launchTimeline.minimumDurationMs,
);
assert.equal(
  launchTimeline.revealLatestStartMs - launchTimeline.dockEndMs,
  570,
  'the launch must not leave a multi-second black pause after docking',
);

const source = readFileSync(new URL('WatchlyLaunchGate.tsx', import.meta.url), 'utf8');

assert.match(source, /watchly-w-ui\.png/, 'launch must use the derived Watchly W');
assert.match(source, /watchly-popcorn-ui\.png/, 'launch must use the official popcorn layer');
assert.match(source, /watchly-letters-ui\.png/, 'launch must reveal the official atchly letters');
assert.match(
  source,
  /watchly-wordmark-ui\.png/,
  'launch and Home must hand off through the same official wordmark asset',
);
assert.match(source, /useNativeDriver: true/g, 'launch transforms must run on the native driver');
assert.match(source, /appReady \|\| latestRevealReached/, 'Application readiness must gate the content fade');
assert.match(
  source,
  /if \(!assetsReady\) return;/,
  'launch must wait for its raster layers before starting the timeline',
);
assert.match(
  source,
  /onLoad=\{\(\) => markAssetReady\('w'\)\}/,
  'the W layer must report when it is ready to render',
);
assert.match(
  source,
  /onLoad=\{\(\) => markAssetReady\('wordmark'\)\}/,
  'the final official wordmark must load before the launch starts',
);
assert.match(
  source,
  /loadedAssetsRef\.current\.size === 4/,
  'all four launch assets must be ready before the timeline starts',
);
assert.match(
  source,
  /setTimeout\(\(\) => setAssetsReady\(true\), LAUNCH_ASSET_WAIT_MS\)/,
  'a missing native image event must not leave the launch screen black forever',
);
assert.match(
  source,
  /logoLayer: \{[\s\S]*?position: 'absolute',[\s\S]*?zIndex: 2,/,
  'the W must render above the popcorn fill',
);
assert.match(
  source,
  /kernel: \{[\s\S]*?zIndex: 3,/,
  'falling kernels must stay above the W until they land',
);
assert.match(
  source,
  /const deployedIconCenterY =\s+largeWordmarkTop \+ largeWordmarkHeight \* WORDMARK_W_CENTER_Y_RATIO;/,
  'the large W and letters must share the official wordmark vertical alignment',
);
assert.match(
  source,
  /const deployedIconSize =\s+largeWordmarkWidth \* WORDMARK_W_WIDTH_RATIO;/,
  'the large W must use the official wordmark width',
);
assert.match(
  source,
  /const targetIconSize =\s+targetWordmarkWidth \* WORDMARK_W_WIDTH_RATIO;/,
  'the docked W must keep the same official wordmark width',
);
assert.match(
  source,
  /transform: \[\{ scaleY: WORDMARK_W_ASPECT_CORRECTION \}\]/,
  'the W must use the official wordmark height from the first frame',
);
assert.match(
  source,
  /transform: \[\{ translateX: letterRevealTranslateX \}\]/,
  'the letters must move out from their origin inside the W',
);
assert.match(
  source,
  /letterCurtainFeather/,
  'the moving reveal edge must be feathered',
);
assert.doesNotMatch(
  source,
  /scaleX: letterRevealScaleX/,
  'the launch must not compress the letters into a visible red line',
);
assert.match(
  source,
  /const finalWordmarkOpacity = dock\.interpolate/,
  'the official wordmark must take over before the backdrop disappears',
);
assert.doesNotMatch(
  source,
  /const logoOpacity = contentReveal\.interpolate/,
  'content reveal must not replace the final logo',
);

console.log('Watchly launch animation QA passed.');
