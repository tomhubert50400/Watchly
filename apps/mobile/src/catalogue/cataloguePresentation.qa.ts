// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import assert from 'node:assert/strict';
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';
import { formatCatalogueRating } from './catalogueRatingModel';

assert.equal(formatCatalogueRating(null), null);
assert.equal(formatCatalogueRating(8), '8.0/10');
assert.equal(formatCatalogueRating(5.24), '5.2/10');

const ratingSource = readFileSync(new URL('CatalogueRating.tsx', import.meta.url), 'utf8');
const exploreCardSource = readFileSync(new URL('ExploreMediaCard.tsx', import.meta.url), 'utf8');
const exploreDiscoverySource = readFileSync(new URL('ExploreDiscoveryScreen.tsx', import.meta.url), 'utf8');
const exploreSource = readFileSync(new URL('ExploreScreen.tsx', import.meta.url), 'utf8');
const discoverSource = readFileSync(new URL('DiscoverScreen.tsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
assert.match(discoverSource, /<TextInput[\s\S]*?onChangeText=\{setQuery\}/, 'Discover must accept search text directly');
assert.match(discoverSource, /isSearching \? <DiscoverSearchResults/, 'Discover must display search results inline');
assert.doesNotMatch(discoverSource, /navigate\('CatalogueSearch'/, 'search must not push a separate screen');
assert.doesNotMatch(appSource, /name="CatalogueSearch"/, 'the obsolete Search route must not remain registered');
assert.match(discoverSource, /refreshControl=\{<RefreshControl/, 'the native scroll content must stay mounted when search starts, preserving input focus');
const episodeDetailSource = readFileSync(new URL('EpisodeDetailScreen.tsx', import.meta.url), 'utf8');
const catalogueDetailSectionsSource = readFileSync(new URL('CatalogueDetailSections.tsx', import.meta.url), 'utf8');
const detailFactsSource = readFileSync(new URL('DetailFacts.tsx', import.meta.url), 'utf8');
const filmDetailSource = readFileSync(new URL('FilmDetailScreen.tsx', import.meta.url), 'utf8');
const seriesDetailSource = readFileSync(new URL('SeriesDetailScreen.tsx', import.meta.url), 'utf8');
const atmosphereSource = readFileSync(new URL('../components/SpotlightAtmosphere.tsx', import.meta.url), 'utf8');
const mediaHeroSource = readFileSync(new URL('../components/MediaHero.tsx', import.meta.url), 'utf8');
const homeHeroSource = readFileSync(new URL('../home/HomeHero.tsx', import.meta.url), 'utf8');
const homeSource = readFileSync(new URL('../home/HomeScreen.tsx', import.meta.url), 'utf8');
const librarySource = readFileSync(new URL('../library/LibraryScreen.tsx', import.meta.url), 'utf8');
const opinionSheetSource = readFileSync(new URL('../opinions/OpinionSheet.tsx', import.meta.url), 'utf8');
const seriesProgressSource = readFileSync(new URL('../tracking/SeriesProgressSummary.tsx', import.meta.url), 'utf8');
const trackingControlsSource = readFileSync(new URL('../tracking/TrackingControls.tsx', import.meta.url), 'utf8');
const screenSource = readFileSync(new URL('../components/Screen.tsx', import.meta.url), 'utf8');
const atmosphereStyle = atmosphereSource.match(/atmosphere: \{([\s\S]*?)\n  \},/)?.[1];
const homeHeroCopyStyle = homeHeroSource.match(/copy: \{([\s\S]*?)\n  \},/)?.[1];
const homeHeroEyebrowStyle = homeHeroSource.match(/eyebrow: \{([\s\S]*?)\n  \},/)?.[1];
const homeHeroLogoStyle = homeHeroSource.match(/logo: \{([\s\S]*?)\n  \},/)?.[1];
const homeHeroLogoFrameStyle = homeHeroSource.match(/logoFrame: \{([\s\S]*?)\n  \},/)?.[1];
const mediaHeroActionBarStyle = mediaHeroSource.match(/actionBar: \{([\s\S]*?)\n  \},/)?.[1];
const mediaHeroActionFadeStyle = mediaHeroSource.match(/actionBarFade: \{([\s\S]*?)\n  \},/)?.[1];
const mediaHeroLogoStyle = mediaHeroSource.match(/logo: \{([\s\S]*?)\n  \},/)?.[1];
const mediaHeroLogoFrameStyle = mediaHeroSource.match(/logoFrame: \{([\s\S]*?)\n  \},/)?.[1];
const episodeCommunityIndex = episodeDetailSource.indexOf('<EpisodeCommunityPanel');
const episodeCastIndex = episodeDetailSource.indexOf('title="Cast"');
const episodeCrewIndex = episodeDetailSource.indexOf('title="Crew"');
const filmSynopsisIndex = filmDetailSource.indexOf('<SynopsisPanel');
const filmFactsIndex = filmDetailSource.indexOf('<DetailFacts');
const filmVideoIndex = filmDetailSource.indexOf('<CatalogueVideoRail');
const filmStreamingIndex = filmDetailSource.indexOf('<StreamingAvailabilityPanel');
const filmCastIndex = filmDetailSource.indexOf('<CatalogueCastRail');
const filmKeywordIndex = filmDetailSource.indexOf('<CatalogueKeywordList');
const filmRelatedIndex = filmDetailSource.indexOf('<CatalogueRelatedRail');
const seriesSynopsisIndex = seriesDetailSource.indexOf('<SynopsisPanel');
const seriesFactsIndex = seriesDetailSource.indexOf('<DetailFacts');
const seriesVideoIndex = seriesDetailSource.indexOf('<CatalogueVideoRail');
const seriesStreamingIndex = seriesDetailSource.indexOf('<StreamingAvailabilityPanel');
const seriesCastIndex = seriesDetailSource.indexOf('<CatalogueCastRail');
const seriesKeywordIndex = seriesDetailSource.indexOf('<CatalogueKeywordList');
const seriesRelatedIndex = seriesDetailSource.indexOf('<CatalogueRelatedRail');

assert.match(ratingSource, /color: colors\.rating/, 'catalogue ratings must use Watchly pink');
assert.match(
  ratingSource,
  /<Star color=\{colors\.rating\} fill=\{colors\.rating\}/,
  'catalogue ratings must include the pink star icon',
);
assert.match(exploreCardSource, /<Text numberOfLines=\{1\} style=\{styles\.title\}>/);
assert.match(homeSource, /<Text numberOfLines=\{1\} style=\{styles\.posterTitle\}>/);
assert(atmosphereStyle, 'Home must define the Spotlight atmosphere layer');
assert.match(
  atmosphereStyle,
  /\.\.\.StyleSheet\.absoluteFillObject/,
  'the Spotlight atmosphere must fill the available screen',
);
assert.doesNotMatch(
  atmosphereStyle,
  /\bheight:/,
  'the Spotlight atmosphere must not stop at a fixed height',
);
assert.doesNotMatch(
  atmosphereSource,
  /spotlightAtmosphereFade/,
  'the Spotlight backdrop must not fade completely to the solid page background',
);
assert.match(
  homeSource,
  /const atmosphereUrl = catalogue\.data\?\.hero\?\.posterUrl \?\? catalogue\.data\?\.hero\?\.backdropUrl \?\? null;/,
  'Home must prefer the vertical Spotlight poster and fall back to its backdrop',
);
assert.match(
  homeSource,
  /background=\{atmosphereUrl \? <SpotlightAtmosphere/,
  'Home must mount the Spotlight artwork at screen level',
);
assert.match(
  homeHeroSource,
  /item\.logoUrl \?/,
  'the Home Spotlight must prefer the TMDB title logo when one is available',
);
assert.match(
  homeHeroSource,
  /<Pressable[\s\S]*accessibilityRole="button"[\s\S]*onPress=\{onOpen\}/,
  'the complete Home Spotlight card must open its film details',
);
assert.doesNotMatch(
  homeHeroSource,
  /label="View details"/,
  'the Home Spotlight must not keep a redundant View details button',
);
assert(homeHeroCopyStyle, 'the Home Spotlight must define its centered identity block');
assert.match(homeHeroCopyStyle, /alignItems: 'center'/);
assert.match(homeHeroCopyStyle, /justifyContent: 'flex-end'/);
assert(homeHeroLogoFrameStyle, 'the Home Spotlight must define its title-logo frame');
assert.match(homeHeroLogoFrameStyle, /alignSelf: 'center'/);
assert(homeHeroEyebrowStyle, 'the Home Spotlight must define its feature label');
assert.match(homeHeroEyebrowStyle, /fontSize: 14/);
assert.match(homeHeroEyebrowStyle, /left: spacing\.lg/);
assert.match(homeHeroEyebrowStyle, /position: 'absolute'/);
assert.match(homeHeroEyebrowStyle, /top: spacing\.lg/);
assert.match(
  filmDetailSource,
  /logoUrl=\{movie\.logoUrl\}/,
  'film details must pass the TMDB title logo into the shared hero',
);
assert.match(
  seriesDetailSource,
  /logoUrl=\{series\.logoUrl\}/,
  'series details must pass the TMDB title logo into the shared hero',
);
assert.match(
  trackingControlsSource,
  /containerStyle=\{styles\.statusControl\}/,
  'detail activity controls must opt into the translucent interactive surface',
);
for (const [source, label] of [
  [trackingControlsSource, 'activity control'],
  [opinionSheetSource, 'opinion panel'],
  [seriesProgressSource, 'continue-watching panel'],
  [seriesDetailSource, 'series view switch'],
] as const) {
  assert.match(
    source,
    /backgroundColor: colors\.interactiveSurface/,
    `the ${label} must reveal the adaptive artwork through a stronger translucent surface`,
  );
}
assert.match(
  filmDetailSource,
  /const infoItems = \['Film', releaseYear,/,
  'film details must place the media type before the release year',
);
assert.match(
  seriesDetailSource,
  /const infoItems = \[\s*'Series',\s*series\.firstAirDate/,
  'series details must place the media type before the first-air year',
);
assert.doesNotMatch(
  `${filmDetailSource}\n${seriesDetailSource}`,
  /\beyebrow=/,
  'detail heroes must not reserve a separate row for the media type',
);
assert.match(
  mediaHeroSource,
  /logoUrl \?/,
  'the shared hero must retain a text-title fallback when no logo exists',
);
assert.doesNotMatch(
  mediaHeroSource,
  /MediaPoster/,
  'film and series details must use one immersive artwork instead of a floating poster card',
);
assert.match(
  mediaHeroSource,
  /Math\.min\(Math\.max\(width \* 1\.08, 390\), 480\)/,
  'the shared detail artwork must scale into a cinematic mobile hero',
);
assert.doesNotMatch(
  mediaHeroSource,
  /mediaHeroFadeColors\.map|styles\.fadeBand/,
  'the detail hero fade must not expose individually rasterized color bands',
);
assert.match(
  mediaHeroSource,
  /LinearGradient as SvgLinearGradient/,
  'the detail hero must use one continuous vector gradient',
);
assert.match(
  mediaHeroSource,
  /bottom: -1/,
  'the detail hero fade must overlap the artwork edge to prevent an iOS seam',
);
assert(mediaHeroActionBarStyle, 'the detail hero must define its action row');
assert.match(
  mediaHeroActionBarStyle,
  /backgroundColor: 'transparent'/,
  'the detail action row must reveal the adaptive atmosphere instead of drawing a full-width color band',
);
assert(mediaHeroActionFadeStyle, 'the detail action row must define a transition layer');
assert.match(
  mediaHeroActionFadeStyle,
  /\.\.\.StyleSheet\.absoluteFillObject/,
  'the action transition must cover the full seam between hero and page atmosphere',
);
assert.match(
  mediaHeroSource,
  /id="mediaHeroActionFade"[\s\S]*offset="0"[\s\S]*stopOpacity=\{1\}[\s\S]*offset="1"[\s\S]*stopOpacity=\{0\}/,
  'the action transition must fade from the opaque hero edge to the transparent poster atmosphere',
);
assert(homeHeroLogoStyle, 'the Home Spotlight must define its title-logo image');
assert(mediaHeroLogoStyle, 'the film detail hero must define its title-logo image');
assert(mediaHeroLogoFrameStyle, 'the detail hero must define its title-logo frame');
assert.doesNotMatch(
  homeHeroLogoStyle,
  /width: '100%'/,
  'the Home title logo must not be centered inside a forced full-width image',
);
assert.doesNotMatch(
  mediaHeroLogoStyle,
  /width: '100%'/,
  'the detail title logo must not be centered inside a forced full-width image',
);
assert.match(
  homeHeroSource,
  /aspectRatio: item\.logoAspectRatio/,
  'the Home title logo must use its intrinsic TMDB aspect ratio',
);
assert.match(
  mediaHeroSource,
  /aspectRatio: logoAspectRatio/,
  'the detail title logo must use its intrinsic TMDB aspect ratio',
);
assert.match(
  mediaHeroLogoFrameStyle,
  /height: 86/,
  'the immersive detail hero must give official title artwork a prominent frame',
);
assert.match(
  mediaHeroSource,
  /fontSize: 40/,
  'the text-title fallback must grow with the title logo',
);
assert.match(
  detailFactsSource,
  /visibleItems = items\.filter/,
  'technical details must omit unavailable catalogue facts instead of inventing values',
);
assert.match(
  filmDetailSource,
  /const atmosphereUrl = movie\?\.posterUrl \?\? movie\?\.backdropUrl \?\? null;/,
  'film details must derive their screen atmosphere from real title artwork',
);
assert.match(
  seriesDetailSource,
  /const atmosphereUrl = series\?\.posterUrl \?\? series\?\.backdropUrl \?\? null;/,
  'series details must derive their screen atmosphere from real title artwork',
);
assert.match(
  `${filmDetailSource}\n${seriesDetailSource}`,
  /<SpotlightAtmosphere blurRadius=\{28\} imageUrl=\{atmosphereUrl\} \/>/,
  'film and series details must mount the shared adaptive artwork atmosphere',
);
assert(
  filmSynopsisIndex >= 0 && filmFactsIndex > filmSynopsisIndex && filmStreamingIndex > filmFactsIndex,
  'film details must flow from synopsis to technical facts to streaming availability',
);
assert(
  seriesSynopsisIndex >= 0 && seriesFactsIndex > seriesSynopsisIndex && seriesStreamingIndex > seriesFactsIndex,
  'series details must flow from synopsis to technical facts to streaming availability',
);
assert(
  filmFactsIndex < filmVideoIndex
    && filmVideoIndex < filmStreamingIndex
    && filmStreamingIndex < filmCastIndex
    && filmCastIndex < filmKeywordIndex
    && filmKeywordIndex < filmRelatedIndex,
  'film lower-page information must follow the intended cinematic hierarchy',
);
assert(
  seriesFactsIndex < seriesVideoIndex
    && seriesVideoIndex < seriesStreamingIndex
    && seriesStreamingIndex < seriesCastIndex
    && seriesCastIndex < seriesKeywordIndex
    && seriesKeywordIndex < seriesRelatedIndex,
  'series lower-page information must follow the intended cinematic hierarchy',
);
assert.match(catalogueDetailSectionsSource, /title="Teasers & trailers"/);
assert.match(catalogueDetailSectionsSource, /title="Cast"/);
assert.match(catalogueDetailSectionsSource, /title="Discover by keyword"/);
assert.match(catalogueDetailSectionsSource, /title="More like this"/);
assert.match(
  catalogueDetailSectionsSource,
  /https:\/\/www\.youtube\.com\/watch\?v=/,
  'trailer cards must open the real TMDB YouTube video key',
);
assert.match(
  filmDetailSource,
  /label: 'Release date', value: formatDetailDate\(movie\.releaseDate\)/,
  'film details must show the real catalogue release date',
);
assert.match(
  seriesDetailSource,
  /label: 'Episodes', value: series\.numberOfEpisodes/,
  'series details must show the real catalogue episode count',
);
assert(episodeCommunityIndex >= 0, 'episode details must render community reviews');
assert(
  episodeCastIndex > episodeCommunityIndex,
  'the credited episode cast must render below community reviews',
);
assert(
  episodeCrewIndex > episodeCastIndex,
  'the credited episode crew must render below the cast',
);
assert.match(
  episodeDetailSource,
  /horizontal\s+showsHorizontalScrollIndicator=\{false\}/,
  'episode cast must use a compact horizontal rail',
);
assert.match(
  atmosphereSource,
  /blurRadius = 8/,
  'the shared Spotlight atmosphere must keep its recognizable default blur',
);
assert.match(
  atmosphereSource,
  /blurRadius=\{blurRadius\}/,
  'screen-specific atmospheres must be able to soften artwork into a color wash',
);
assert.match(
  exploreSource,
  /const atmosphereUrl = discoveryItems\[0\]\?\.posterUrl \?\? null;/,
  'Explore must use the selected section feature poster for its atmosphere',
);
assert.match(
  exploreSource,
  /<SpotlightAtmosphere imageUrl=\{atmosphereUrl\} \/>/,
  'Explore must render the shared atmosphere behind its content',
);
assert.match(
  exploreSource,
  /getCachedMovie\(featured\.tmdbId\)/,
  'Explore must reuse its preloaded movie details for the featured title',
);
assert.match(
  exploreSource,
  /logoUrl=\{featuredDetails\?\.logoUrl \?\? null\}/,
  'Explore must pass the cached TMDB title logo into its Spotlight',
);
assert.match(
  exploreSource,
  /logoUrl \?/,
  'Explore Spotlights must retain the catalogue title as a text fallback',
);
assert.match(
  exploreSource,
  /\{ label: 'Trending', value: 'trending' \}/,
  'Explore must keep Trending in the top discovery selector',
);
assert.match(
  exploreSource,
  /\{ label: 'Coming soon', value: 'announced' \}/,
  'Explore must keep Coming soon in the top discovery selector',
);
assert.match(
  exploreSource,
  /<ExploreFeature[\s\S]*title="Movies"[\s\S]*title="TV Shows"/,
  'the selected section must show one feature followed by Movies and TV Shows rails',
);
assert.match(
  exploreSource,
  /onViewMore\(activeSection, 'movie'\)/,
  'the Movies rail must open the selected section movie catalogue',
);
assert.match(
  exploreSource,
  /onViewMore\(activeSection, 'series'\)/,
  'the TV Shows rail must open the selected section series catalogue',
);
assert.match(
  exploreDiscoverySource,
  /groupDiscoveryItemsByGenre\(items\)/,
  'extended Explore discovery must classify catalogue titles by genre',
);
assert.match(
  exploreDiscoverySource,
  /group\.items\.map/,
  'each extended discovery genre must render its own media rail',
);
assert.match(
  exploreDiscoverySource,
  /getCatalogueDiscovery\(route\.params\.section, route\.params\.mediaType\)/,
  'View more must preserve both the selected discovery section and media rail',
);
assert.match(
  exploreDiscoverySource,
  /showReleaseAlert=\{route\.params\.section === 'announced'\}/,
  'Coming soon View more cards must show release metadata instead of zero ratings',
);
assert.match(
  librarySource,
  /const lastWatchedItem = getLastWatchedLibraryItem\(data\?\.items \?\? \[\]\);/,
  'Library must resolve its atmosphere from the last watched item',
);
assert.match(
  librarySource,
  /const atmosphereUrl = lastWatchedItem\?\.posterUrl \?\? lastWatchedItem\?\.backdropUrl \?\? null;/,
  'Library must prefer the last watched poster and fall back to its backdrop',
);
assert.match(
  librarySource,
  /background=\{atmosphereUrl \? <SpotlightAtmosphere imageUrl=\{atmosphereUrl\} \/> : null\}/,
  'Library must mount the last watched artwork at screen level',
);
assert.match(screenSource, /background\?: ReactNode/, 'Screen must expose a background layer');
assert.match(
  screenSource,
  /background \? styles\.transparentHeader/,
  'the Home header must reveal the screen-level backdrop',
);

for (const [file, source] of [
  ['ExploreMediaCard.tsx', exploreCardSource],
  ['ExploreScreen.tsx', exploreSource],
  ['HomeScreen.tsx', homeSource],
] as const) {
  assert.match(source, /<CatalogueRating\b/, `${file} must use the shared pink rating`);
  assert.doesNotMatch(source, /TMDB \$\{.*voteAverage/, `${file} must not prefix ratings with TMDB`);
}

console.log('Catalogue presentation QA passed.');
