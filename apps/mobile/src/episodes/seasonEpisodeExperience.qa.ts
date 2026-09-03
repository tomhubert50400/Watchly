// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

const seasonListSource = source('./SeasonEpisodeList.tsx');
const episodeDetailSource = source('../catalogue/EpisodeDetailScreen.tsx');
const synopsisSource = source('../catalogue/SynopsisPanel.tsx');
const communitySource = source('../catalogue/EpisodeCommunityPanel.tsx');
const headerInfoSource = source('../catalogue/HeaderInfoPills.tsx');
const opinionSheetSource = source('../opinions/OpinionSheet.tsx');
const seriesDetailSource = source('../catalogue/SeriesDetailScreen.tsx');
const starRatingSource = source('../components/StarRatingDisplay.tsx');

assert.match(
  seriesDetailSource,
  /horizontal[\s\S]*setSelected\(item\.seasonNumber\)/,
  'series episodes must expose the horizontal quick season selector',
);
assert.doesNotMatch(
  seriesDetailSource,
  /Choose season|Open Season|navigation\.push\('SeasonDetail'/,
  'series episodes must not retain the season dropdown or route to a duplicate screen',
);
assert.match(
  seasonListSource,
  /model\.isSignedIn && releasedEpisodes\.length > 0 && !releasedComplete[\s\S]*label="Mark season watched"/,
  'series episodes must only expose the season completion action while work remains',
);
assert.doesNotMatch(
  seasonListSource,
  /All released episodes watched|You are caught up|caughtUpPanel/,
  'completed seasons must not render a disabled action or a caught-up panel',
);
assert.match(
  seasonListSource,
  /<SynopsisPanel overview=\{model\.season\.overview\} \/>[\s\S]*<ComputedRatingSummary/,
  'the merged series episodes view must preserve the selected season synopsis and computed rating',
);
assert.match(
  seasonListSource,
  /const nextEpisode = releasedEpisodes\.find/,
  'the next episode feature must ignore unreleased episodes',
);
assert.match(seasonListSource, />Up next</, 'the next useful episode must be visually prioritized');
assert.doesNotMatch(
  seasonListSource,
  /episode\.overview/,
  'long season rows must omit synopsis copy for scan speed and spoiler safety',
);
assert.match(
  seasonListSource,
  />First aired</,
  'the episode list header must retain the approved ordering label',
);
assert.doesNotMatch(
  seasonListSource,
  /displayRating|episode\.voteAverage/,
  'compact episode rows must not add ratings absent from the approved visual',
);
const navigationIndex = episodeDetailSource.indexOf('<AdjacentEpisodeButton');
const synopsisIndex = episodeDetailSource.indexOf('<SynopsisPanel');
const activityIndex = episodeDetailSource.indexOf('style={styles.personalSection}');
const communityIndex = episodeDetailSource.indexOf('<EpisodeCommunityPanel');
const castIndex = episodeDetailSource.indexOf('title="Cast"');

assert(navigationIndex >= 0, 'episode detail must expose adjacent episode navigation');
assert(
  navigationIndex < synopsisIndex && synopsisIndex < activityIndex && activityIndex < communityIndex && communityIndex < castIndex,
  'episode detail hierarchy must flow from navigation to synopsis, activity, community, and credits',
);
assert.match(
  episodeDetailSource,
  /navigation\.replace\('EpisodeDetail'/,
  'adjacent navigation must replace the current episode instead of growing the stack',
);
assert.match(
  episodeDetailSource,
  /const episodeCode = episode \? `S\$\{episode\.seasonNumber\} EP\$\{episode\.episodeNumber\}`[\s\S]*!previous && episodeCode[\s\S]*navigationLabel[\s\S]*previous && episodeCode/,
  'previous and next navigation must show the season and episode code beside each direction label',
);
assert.match(
  episodeDetailSource,
  /navigationCode: \{[\s\S]*color: colors\.textMuted/,
  'adjacent episode codes must use the same muted grey as the hero date metadata',
);
assert.match(
  episodeDetailSource,
  /navigationMeta: \{[\s\S]*alignSelf: 'stretch'[\s\S]*justifyContent: 'space-between'/,
  'direction labels and episode codes must sit at opposite edges of each navigation cell',
);
assert.match(
  episodeDetailSource,
  /<SynopsisPanel[\s\S]*spoilerProtected[\s\S]*<EpisodeCommunityPanel[\s\S]*spoilerProtected/,
  'episode synopsis and community review copy must remain protected until explicitly revealed',
);
assert.match(
  episodeDetailSource,
  /Tracking will be available after this episode is released/,
  'future episodes must not expose contradictory tracking actions',
);
assert.match(
  synopsisSource,
  /spoilerProtected && !isSpoilerRevealed[\s\S]*Reveal synopsis/,
  'protected synopsis text must require an explicit reveal',
);
assert.match(
  synopsisSource,
  /style=\{styles\.synopsisContent\}[\s\S]*numberOfLines=\{isExpanded \? undefined : collapsedLineCount\}[\s\S]*\{synopsis\}[\s\S]*<BlurView/,
  'the protected synopsis must render the real text in flow before its blur overlay',
);
assert.match(
  synopsisSource,
  /intensity=\{isSpoilerRevealed \? 0 : 80\}[\s\S]*style=\{\[[\s\S]*styles\.spoilerOverlay/,
  'the spoiler overlay must remain mounted and reveal the same synopsis by reducing blur to zero',
);
assert.match(
  synopsisSource,
  /overflow: 'hidden',[\s\S]*spoilerOverlay: \{[\s\S]*\.\.\.StyleSheet\.absoluteFillObject/,
  'the spoiler blur must match the clipped card dimensions without exposing an internal rectangle',
);
assert.match(
  synopsisSource,
  /cardBlurred: \{[\s\S]*borderColor: 'transparent'[\s\S]*spoilerOverlay: \{[\s\S]*borderCurve: 'continuous'[\s\S]*borderRadius: radii\.lg[\s\S]*spoilerOverlayHidden: \{[\s\S]*borderColor: colors\.border/,
  'the hidden synopsis must draw one shared rounded contour instead of stacking two mismatched borders',
);
assert.doesNotMatch(
  synopsisSource,
  /spoilerCopy|spoilerFeather|minHeight: 142/,
  'the synopsis must not use a fixed-height duplicate or a separate feather layer',
);
assert.doesNotMatch(
  synopsisSource,
  /placeholderLine/,
  'the protected synopsis must not regress to generic placeholder bars',
);
assert.match(
  episodeDetailSource,
  /<SynopsisPanel[\s\S]*variant="card"/,
  'episode synopsis must use the bordered card treatment from the approved visual',
);
assert.match(
  episodeDetailSource,
  /<EpisodeProgressControl[\s\S]*variant="activity"[\s\S]*<ViewingCountControl[\s\S]*variant="activity"[\s\S]*activityHorizontalDivider[\s\S]*<EpisodeReviewEditor[\s\S]*variant="activity"/,
  'episode activity must use the approved two-row card composition',
);
assert.match(
  opinionSheetSource,
  /Your rating[\s\S]*onResponderGrant=\{beginActivityRatingGesture\}[\s\S]*onResponderMove=\{selectActivityRatingAtTouch\}[\s\S]*onResponderRelease=\{saveActivityRatingAtRelease\}[\s\S]*StarRatingDisplay[\s\S]*Write a review/,
  'the activity card must preview a sliding rating and save it on release while keeping review separate',
);
assert.match(
  opinionSheetSource,
  /onResponderTerminationRequest=\{\(\) => false\}/,
  'the activity rating must keep its responder when the surrounding scroll view requests control',
);
assert.match(
  opinionSheetSource,
  /importantForAccessibility="no-hide-descendants"\s+pointerEvents="none"\s+style=\{styles\.activityStarDisplay\}/,
  'the activity rating must calculate from the full track instead of a touched star child',
);
assert.match(
  opinionSheetSource,
  /StarRatingDisplay rating=\{opinion\.draftRating \?\? 0\} size=\{26\} spread[\s\S]*activityStars: \{[\s\S]*alignSelf: 'stretch'/,
  'the activity stars must be larger and span the same cell width as the watched control above',
);
assert.match(
  starRatingSource,
  /spread && styles\.starsSpread[\s\S]*starsSpread: \{[\s\S]*justifyContent: 'space-between'/,
  'the shared rating display must distribute enlarged stars across the available track width',
);
assert.match(
  opinionSheetSource,
  /activityRatingCell: \{ flex: 1,[\s\S]*activityReviewCell: \{[\s\S]*flex: 1/,
  'the rating and review cells must share one aligned center divider',
);
assert.match(
  headerInfoSource,
  /CalendarDays[\s\S]*Clock3[\s\S]*Star/,
  'episode metadata must retain the calendar, runtime, and rating icon hierarchy',
);
assert.match(
  episodeDetailSource,
  /width \* 0\.78/,
  'episode detail must preserve the approved compact hero ratio',
);
assert.match(
  episodeDetailSource,
  /SvgLinearGradient id="episodeHeroFade"[\s\S]*stopOpacity=\{stop\.opacity\}/,
  'episode detail must blend its hero continuously into the page background',
);
assert.doesNotMatch(
  episodeDetailSource,
  /SpotlightAtmosphere/,
  'episode detail must not reintroduce a hard atmosphere seam below the hero',
);
assert.match(
  communitySource,
  /Review contains spoilers[\s\S]*Reveal review/,
  'protected community reviews must require an explicit reveal',
);

console.log('Season and episode experience QA passed.');
