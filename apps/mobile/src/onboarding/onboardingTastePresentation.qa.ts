import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./OnboardingScreen.tsx', import.meta.url), 'utf8');

assert.match(source, /getOnboardingTasteOptions\(\)/, 'Taste must load dynamic TMDB popularity options');
assert.match(
  source,
  /getOnboardingTasteOptions\(selectedMovieGenreId\)/,
  'Taste must reload its movie cards from TMDB when a genre is selected',
);
assert.match(
  source,
  /<Text style=\{styles\.tasteHeading\}>Show us your taste<\/Text>[\s\S]*\{activeSelectionCount\}\/\{ONBOARDING_TASTE_LIMIT_PER_TYPE\}/,
  'Taste must show its title and active 5-item counter on one row',
);
assert.match(
  source,
  /\{ label: 'Movies', value: 'movie' \}[\s\S]*\{ label: 'TV Shows', value: 'series' \}/,
  'Taste must provide the requested Movies and TV Shows selector',
);
assert.match(
  source,
  /selectedType === 'movie'[\s\S]*styles\.genreTrigger[\s\S]*All genres[\s\S]*<BottomActionSheet[\s\S]*\.\.\.movieGenres\]\.map/,
  'Movies must expose an All genres dropdown backed by the TMDB movie genre list',
);
assert.match(
  source,
  /genreTrigger: \{[\s\S]*minHeight: touchTargets\.min[\s\S]*genreOption: \{[\s\S]*minHeight: touchTargets\.min/,
  'the genre dropdown and its options must keep accessible mobile touch targets',
);
assert.match(
  source,
  /if \(value\.trim\(\)\) \{[\s\S]*setSelectedMovieGenreId\(null\)/,
  'starting a title search must visibly reset the mutually exclusive genre filter',
);
assert.match(
  source,
  /const tasteCardWidth = Math\.floor\([\s\S]*\/ 3,\s*\)/,
  'Taste cards must calculate exactly three columns from the available width',
);
assert.match(
  source,
  /styles\.tasteSelectedOverlay[\s\S]*<CheckCircle2 color=\{colors\.success\}/,
  'selected cards must darken and show a green checkmark',
);
assert.match(
  source,
  /step === 'import' \|\| step === 'taste'[\s\S]*styles\.importBackAction[\s\S]*styles\.importPrimaryAction/,
  'Taste must reuse the one-third Back and two-thirds primary action layout',
);
assert.match(
  source,
  /disabled=\{step === 'taste' && tasteSelectionCount < 1\}/,
  'Taste Continue must remain disabled until at least one title is selected',
);

console.log('Onboarding taste presentation QA passed.');
