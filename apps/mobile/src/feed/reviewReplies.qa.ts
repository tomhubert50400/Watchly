// @ts-expect-error QA runs under Node, outside the Expo runtime types.
import assert from 'node:assert/strict';
// @ts-expect-error QA runs under Node, outside the Expo runtime types.
import { readFileSync } from 'node:fs';

const api = readFileSync(new URL('../api/feed.ts', import.meta.url), 'utf8');
const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
const feed = readFileSync(new URL('./FeedScreen.tsx', import.meta.url), 'utf8');
const post = readFileSync(new URL('../components/SocialReviewPost.tsx', import.meta.url), 'utf8');
const expandable = readFileSync(new URL('../components/ExpandableReviewText.tsx', import.meta.url), 'utf8');
const screen = readFileSync(new URL('./ReviewRepliesScreen.tsx', import.meta.url), 'utf8');

assert.match(api, /listReviewReplies[\s\S]*createReviewReply[\s\S]*deleteReviewReply/);
assert.match(app, /<Stack\.Screen component=\{ReviewRepliesScreen\} name="ReviewReplies"/);
assert.match(feed, /onOpenReplies=\{reviewType[\s\S]*navigation\.navigate\('ReviewReplies'/);
assert.match(post, /MessageCircle[\s\S]*replyCount[\s\S]*onOpenReplies/);
assert.match(post, /ExpandableReviewText[\s\S]*onPress=\{variant === 'community' \? onOpenReplies : undefined\}/);
assert.match(expandable, /accessibilityLabel="Open review discussion"[\s\S]*onPress=\{onPress\}/);
assert.match(screen, /<SocialReviewPost[\s\S]*<Text style=\{styles\.repliesTitle\}>Replies<\/Text>/);
assert.match(screen, /<SpotlightAtmosphere blurRadius=\{24\} imageUrl=\{review\.backgroundUrl\}/);
assert.match(screen, /maxLength=\{1000\}/);
assert.match(screen, /accessibilityLabel=\{containsSpoilers \? 'Remove spoiler warning' : 'Mark reply as containing spoilers'\}/);
assert.match(screen, /This reply contains spoilers/);
assert.match(screen, /Spoiler-protected discussion/);
assert.match(screen, /Alert\.alert\('Delete reply\?'/);
assert.match(screen, /type: 'reviewReply'/);
assert.match(screen, /onEndReachedThreshold=\{0\.8\}/);
assert.match(screen, /styles\.composer/);
assert.doesNotMatch(screen, /BottomActionSheet/);

console.log('Review replies mobile QA passed: dedicated thread screen, composer, spoilers, moderation and pagination.');
