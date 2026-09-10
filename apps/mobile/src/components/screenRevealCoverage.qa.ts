import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const sources = new Map<string, string>();
function collect(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collect(path);
    else if (entry.name.endsWith('.tsx')) sources.set(basename(entry.name, '.tsx'), readFileSync(path, 'utf8'));
  }
}
collect(root);
const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
const routes = new Set([...app.matchAll(/component=\{(\w+Screen)\}/g)].map(match => match[1]));
routes.delete('ExploreTabScreen');
routes.add('DiscoverScreen');
routes.add('ExploreScreen');

// These pages use an existing shared composition or their own onboarding transition.
const shared: Record<string, string> = {
  PersonalWatchlistScreen: 'WatchlistSection',
  ProfileScreen: 'ProfileBody',
  PublicProfileScreen: 'ProfileBody',
  OnboardingScreen: 'stepTrackTranslateX',
};
for (const route of routes) {
  const source = sources.get(route);
  assert(source, `Missing source for ${route}`);
  assert(source.includes(shared[route] ?? '<ScreenReveal'), `${route} must reveal its content, not only its loading shell`);
}
assert.match(sources.get('ProfileBody')!, /<ScreenReveal/);
assert.match(sources.get('WatchlistDetailLayout')!, /function WatchlistSection[\s\S]*<ScreenReveal/);
assert.match(sources.get('ActorDetailScreen')!, /contentReady=\{Boolean\(actor\)\}/);
assert.match(sources.get('SettingsScreen')!, /contentReady=\{Boolean\(savedSettings\)/);
assert.match(sources.get('SettingsScreen')!, /function SettingsSection[\s\S]*<ScreenReveal delay=\{delay\}/);
assert.match(sources.get('ProfileReviewsScreen')!, /ready=\{!loading && \(results.length > 0 \|\| !indexing\)\}/);
const reveal = sources.get('ScreenReveal')!;
assert.match(reveal, /if \(!canReveal \|\| reduceMotion === null\) return/);
assert.match(reveal, /RevealReadyContext.Provider value=\{canReveal\}/);
assert.match(reveal, /if \(!focused \|\| started.current\) return/);
assert.match(reveal, /animation.stop\(\);\s*progress.setValue\(1\)/);

console.log(`Page reveal coverage QA passed for ${routes.size} pages, including legacy Explore.`);
