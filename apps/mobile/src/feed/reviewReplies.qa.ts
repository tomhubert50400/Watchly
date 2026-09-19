// @ts-expect-error QA runs under Node, outside the Expo runtime types.
import assert from 'node:assert/strict';
// @ts-expect-error QA runs under Node, outside the Expo runtime types.
import { readFileSync } from 'node:fs';
import { flattenReviewReplies } from './reviewThreadModel';

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
assert.match(screen, /<SynopsisPanel[\s\S]*revealLabel="Reveal reply"[\s\S]*variant="inline"/);
assert.match(screen, /Spoiler-protected discussion/);
assert.match(screen, /Alert\.alert\('Delete reply\?'/);
assert.match(screen, /type: 'reviewReply'/);
assert.match(screen, /onEndReachedThreshold=\{0\.8\}/);
assert.match(screen, /styles\.composer/);
assert.doesNotMatch(screen, /BottomActionSheet/);
assert.match(screen, /Replying to \{replyingTo\.author\}/);
assert.match(screen, /Math\.min\(row\.depth, 4\)/);
assert.match(screen, /ancestorHasNextSibling[\s\S]*styles\.threadLine[\s\S]*styles\.threadElbowArm/);
assert.match(screen, />Spoiler<\/Text>/);
assert.doesNotMatch(screen, /backgroundColor: 'rgba\(15, 19, 29, 0\.72\)'/);

const reply = (id: string, parentReplyId: string | null) => ({
  author: { avatarUrl: null, displayName: id, id },
  body: id,
  containsSpoilers: false,
  createdAt: '2026-09-19T00:00:00.000Z',
  id,
  ownedByViewer: false,
  parentReplyId,
});
const threaded = flattenReviewReplies([
  reply('root', null),
  reply('child', 'root'),
  reply('sibling', 'root'),
  reply('other', null),
  reply('grandchild', 'child'),
]);
assert.deepEqual(threaded.map((item) => [item.reply.id, item.depth]), [
  ['root', 0], ['child', 1], ['grandchild', 2], ['sibling', 1], ['other', 0],
]);
assert.deepEqual(threaded.map((item) => [item.reply.id, item.ancestorHasNextSibling, item.isLastChild]), [
  ['root', [], false],
  ['child', [], false],
  ['grandchild', [true], true],
  ['sibling', [], true],
  ['other', [], true],
]);

console.log('Review replies mobile QA passed: branched threads, synopsis spoiler blur, composer, moderation and pagination.');
