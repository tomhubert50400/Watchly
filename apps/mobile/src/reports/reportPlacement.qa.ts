import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function read(relativePath: string) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

const socialPost = read('../components/SocialReviewPost.tsx');
const feed = read('../feed/FeedScreen.tsx');
const home = read('../home/SocialActivityList.tsx');
const episodeCommunity = read('../catalogue/EpisodeCommunityPanel.tsx');
const publicProfile = read('../profile/PublicProfileScreen.tsx');
const sheet = read('./ReportSheet.tsx');

assert.match(socialPost, /accessibilityLabel=\{`Report \$\{visibleAuthor\}'s review`\}/);
assert.match(feed, /type: item\.type/);
assert.match(home, /type: item\.type/);
assert.match(episodeCommunity, /type: 'episodeReview'/);
assert.match(publicProfile, /accessibilityLabel="More profile actions"/);
assert.match(
  publicProfile,
  /title="Profile actions"[\s\S]*label="Block profile"[\s\S]*label="Report profile"[\s\S]*type: 'profile'/,
);
assert.doesNotMatch(publicProfile, /styles\.moderationActions/);
assert.match(sheet, /BottomActionSheetScrollView/);
assert.match(sheet, /Reports are private\./);
assert.match(sheet, /accessibilityRole="radiogroup"/);

console.log('Report placement QA passed.');
