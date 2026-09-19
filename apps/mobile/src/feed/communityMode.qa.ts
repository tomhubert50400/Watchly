// @ts-expect-error QA runs under Node, outside the Expo runtime types.
import assert from 'node:assert/strict';
// @ts-expect-error QA runs under Node, outside the Expo runtime types.
import { readFileSync } from 'node:fs';
// @ts-expect-error QA runs under Node, outside the Expo runtime types.
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('./FeedScreen.tsx', import.meta.url), 'utf8');
const socialPostSource = readFileSync(new URL('../components/SocialReviewPost.tsx', import.meta.url), 'utf8');
const keySource = source.slice(source.indexOf('export function getCommunityFeedKey'), source.indexOf('export async function loadCommunityFeed'));
const exported: Record<string, any> = {};
runInNewContext(ts.transpileModule(keySource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exported });
assert.notEqual(exported.getCommunityFeedKey('a', 'for-you'), exported.getCommunityFeedKey('a', 'following'));
assert.notEqual(exported.getCommunityFeedKey('a', 'following'), exported.getCommunityFeedKey('b', 'following'));
assert.equal(exported.getCommunityFeedKey('a'), exported.getCommunityFeedKey('a', 'for-you'));
assert.match(source, /background=\{atmosphereUrl \? <SpotlightAtmosphere imageUrl=\{atmosphereUrl\} \/> : null\}/);
assert.match(source, /variant="community"/);
assert.doesNotMatch(source.slice(source.indexOf('function communityLabel')), /Discover|Following/);
assert.match(source, /contentContext=\{item\.content\.contentType === 'episode' && item\.seriesTitle \? `\$\{item\.seriesTitle\} · S\$\{item\.content\.seasonNumber\} E\$\{item\.content\.episodeNumber\}` : null\}/);
assert.match(source, /const media = item\.content\.contentType === 'movie' \? 'Movie' : 'Series'/);
assert.match(source, /return media;/);
assert.doesNotMatch(source.slice(source.indexOf('function communityLabel')), /Review|Rating/);
assert.match(socialPostSource, /variant !== 'community' \? \(\s*<Text style=\{styles\.openLabel\}>Open content<\/Text>/);
assert.match(socialPostSource, /backgroundColor: 'rgba\(15, 19, 29, 0\.62\)'/);
assert.match(socialPostSource, /StarRatingDisplay rating=\{rating\} showValue size=\{22\}/);
assert.match(socialPostSource, /communityRating: \{[\s\S]*?alignItems: 'flex-start',[\s\S]*?alignSelf: 'stretch'/);
assert.match(socialPostSource, /communityPoster: \{\s*height: 112,\s*width: 75,/);
assert.match(socialPostSource, /styles\.actions,\s*variant === 'community' \? styles\.communityActions : null/);
assert.match(socialPostSource, /variant === 'community' \? \(\s*<View style=\{styles\.communityHeaderMeta\}>[\s\S]*?\{reportButton\}[\s\S]*?<Text style=\{styles\.date\}>/);
assert.match(socialPostSource, /variant !== 'community' \? reportButton : null/);
assert.match(socialPostSource, /likeState\.likedByViewer \? 'You liked this review' : 'Like this review'/);
assert.match(socialPostSource, /communityActions: \{[\s\S]*?justifyContent: 'space-between',[\s\S]*?marginTop: spacing\.xs,/);
assert.match(socialPostSource, /communityPost: \{[\s\S]*?paddingBottom: spacing\.xs,/);
const pagination = source.slice(source.indexOf('  async function loadMore()'), source.indexOf('  const openContent'));
async function run() {
  for (const fail of [false, true]) {
    let finish!: () => void;
    let saved = 0;
    let errors = 0;
    let loadingCleared = 0;
    const base: unknown[] = [];
    const pageScope = { current: { key: 'for-you', version: 0 } };
    const pagePending = { current: false };
    const context = {
      firebaseIdToken: 'test', nextCursor: 'cursor', resource: { data: base },
      baseRef: { current: base }, pageScope, pagePending, items: [], extraItems: [],
      mode: 'for-you', refreshMovie: () => {}, refreshSeries: () => {},
      setLoadingPage: (value: boolean) => { if (!value) loadingCleared++; },
      setPageError: (value: unknown) => { if (value) errors++; },
      setExtra: () => { saved++; },
      loadCommunityFeed: (...args: unknown[]) => {
        assert.equal(args[5], 'for-you', 'pagination must send its tab mode');
        return new Promise((resolve, reject) => { finish = () => fail ? reject(new Error('late failure')) : resolve([{ id: 'old', nextCursor: null }]); });
      },
    };
    const load = runInNewContext(pagination + '\nloadMore', context);
    const request = load();
    pageScope.current = { key: 'following', version: 1 };
    pagePending.current = true;
    finish();
    await request;
    assert.equal(saved, 0, 'late pages from another tab must be discarded');
    assert.equal(errors, 0, 'late errors must not appear in the new tab');
    assert.equal(loadingCleared, 0, 'the old request must not stop the new tab loader');
    assert.equal(pagePending.current, true);
  }
  console.log('Community mode QA passed: isolated caches and late pagination results.');
}
void run();
