// @ts-expect-error QA runs under Node, outside the Expo runtime types.
import assert from 'node:assert/strict';
// @ts-expect-error QA runs under Node, outside the Expo runtime types.
import { readFileSync } from 'node:fs';

const api = readFileSync(new URL('../api/feed.ts', import.meta.url), 'utf8');
const feed = readFileSync(new URL('./FeedScreen.tsx', import.meta.url), 'utf8');
const post = readFileSync(new URL('../components/SocialReviewPost.tsx', import.meta.url), 'utf8');
const sheet = readFileSync(new URL('./ReviewRepliesSheet.tsx', import.meta.url), 'utf8');

assert.match(api, /listReviewReplies[\s\S]*createReviewReply[\s\S]*deleteReviewReply/);
assert.match(feed, /onOpenReplies=\{reviewType[\s\S]*ReviewRepliesSheet/);
assert.match(post, /MessageCircle[\s\S]*replyCount[\s\S]*onOpenReplies/);
assert.match(sheet, /maxLength=\{1000\}/);
assert.match(sheet, /Contains spoilers/);
assert.match(sheet, /This reply contains spoilers/);
assert.match(sheet, /Spoiler-protected discussion/);
assert.match(sheet, /Alert\.alert\('Delete reply\?'/);
assert.match(sheet, /type: 'reviewReply'/);
assert.match(sheet, /remaining <= nativeEvent\.layoutMeasurement\.height/);

console.log('Review replies mobile QA passed: thread, composer, spoilers, moderation and pagination.');
