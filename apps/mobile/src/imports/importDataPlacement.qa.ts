// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const appSource = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
const importScreenSource = readFileSync(new URL('./ImportDataScreen.tsx', import.meta.url), 'utf8');
const importMatchesSource = readFileSync(new URL('./ImportMatchesScreen.tsx', import.meta.url), 'utf8');
const importReviewModelSource = readFileSync(new URL('./importReviewModel.ts', import.meta.url), 'utf8');
const importApiSource = readFileSync(new URL('../api/imports.ts', import.meta.url), 'utf8');
const onboardingSource = readFileSync(new URL('../onboarding/OnboardingScreen.tsx', import.meta.url), 'utf8');
const settingsSource = readFileSync(new URL('../profile/SettingsScreen.tsx', import.meta.url), 'utf8');
const onboardingConditionalEnd = appSource.indexOf('\n        )}\n', appSource.indexOf('{needsOnboarding ?'));
const importReviewRoute = appSource.indexOf('<Stack.Screen component={ImportMatchesScreen}');

assert(
  settingsSource.includes("label=\"Import your data\"") &&
    settingsSource.includes("navigation.navigate('ImportData')"),
  'Settings must expose the import entry point.',
);
assert(
  appSource.includes('component={ImportDataScreen} name="ImportData"'),
  'The import destination must be registered in the root stack.',
);
assert(
  appSource.includes('component={ImportMatchesScreen} name="ImportMatches"') &&
    appSource.includes("title: 'Review imports'") &&
    importReviewRoute > onboardingConditionalEnd,
  'Import previews must register a dedicated review screen during and after onboarding.',
);
for (const sourceName of ['Letterboxd', 'IMDb', 'Trakt', 'TV Time']) {
  assert(importScreenSource.includes(`name: '${sourceName}'`), `${sourceName} must appear in the import source list.`);
}
for (const brand of ['letterboxd', 'imdb', 'trakt', 'tvtime']) {
  assert(importScreenSource.includes(`brand: '${brand}'`), `${brand} must use its branded import mark.`);
}
assert(
  (importScreenSource.match(/guide: \[/g) ?? []).length === 4 &&
    importScreenSource.includes('<BottomActionSheet') &&
    importScreenSource.includes('<BottomActionSheetScrollView'),
  'Every import source must open a scrollable step-by-step guide.',
);
for (const exportDestination of [
  'https://www.imdb.com/list/ratings/',
  'https://www.imdb.com/list/watchlist/',
  'https://letterboxd.com/user/exportdata/',
  'https://app.trakt.tv/settings/advanced',
]) {
  assert(
    importScreenSource.includes(exportDestination),
    `${exportDestination} must be available from its official export guide.`,
  );
}
assert(
  importScreenSource.includes('Import support coming soon') &&
    importScreenSource.includes('validates a real {source.name} export'),
  'Unsupported file formats must remain honest while still exposing their export tutorial.',
);
assert(
  importScreenSource.includes("importSource: 'letterboxd'") &&
    importScreenSource.includes("importSource: 'imdb'") &&
    importScreenSource.includes("importSource: 'tv-time'") &&
    /requireOptionalNativeModule\('ExpoDocumentPicker'\)[\s\S]*require\('expo-document-picker'\)/.test(importScreenSource) &&
    importScreenSource.includes('ExecutionEnvironment.StoreClient') &&
    importScreenSource.includes('Rebuild and reinstall Watchly') &&
    !importScreenSource.includes("import('expo-document-picker')"),
  'Letterboxd, IMDb, and TV Time must guard the native picker and identify which client needs updating.',
);
const documentPickerCall = importScreenSource.indexOf('await DocumentPicker.getDocumentAsync');
const previewUploadCall = importScreenSource.indexOf('await previewDataImport', documentPickerCall);
const sheetCloseAfterPreview = importScreenSource.indexOf('setSelectedSource(null);', previewUploadCall);
assert(
  importScreenSource.includes("setStatus('picking')") &&
    importScreenSource.includes("choosingFile={status === 'picking'}") &&
    !/onChooseFile=\{\(source\) => \{\s*setSelectedSource\(null\);\s*void chooseFile\(source\)/.test(importScreenSource) &&
    documentPickerCall >= 0 &&
    previewUploadCall > documentPickerCall &&
    sheetCloseAfterPreview > previewUploadCall,
  'The native picker must open above the guide before the guide sheet is dismissed.',
);
assert(
  importApiSource.includes('/preview') && importApiSource.includes('/confirm'),
  'The mobile import API must support preview and confirmation.',
);
assert(
  importScreenSource.includes('label="Review imports"') &&
    importScreenSource.includes("navigation.navigate('ImportMatches', { matchedItems, skippedItems })") &&
    importScreenSource.includes('disabled={preview.summary.total === 0}') &&
    importScreenSource.includes('label="Skipped"') &&
    importScreenSource.includes('titles could not be matched and will not be imported.') &&
    !importScreenSource.includes('function ImportMatchRow') &&
    importScreenSource.includes('Existing Watchly ratings and reviews will be kept.'),
  'The user must open the dedicated match review screen before importing.',
);
assert(
  importMatchesSource.includes('const MATCH_COLUMNS = 3') &&
    importMatchesSource.includes('numColumns={MATCH_COLUMNS}') &&
    importMatchesSource.includes('<MediaPoster') &&
    importMatchesSource.includes('item.rating') &&
    !importMatchesSource.includes('fileName') &&
    !importMatchesSource.includes('Check the artwork') &&
    importMatchesSource.includes('accessibilityRole="tablist"') &&
    importMatchesSource.includes('accessibilityRole="tab"') &&
    importMatchesSource.includes('Matched ${matchedItems.length}') &&
    importMatchesSource.includes('Skipped ${skippedItems.length}') &&
    importMatchesSource.includes('<SkippedTitleRow item={item} />') &&
    !importMatchesSource.includes('item.issues') &&
    importReviewModelSource.includes('item.actions.sourceRating') &&
    importReviewModelSource.includes('getImportSkippedTitles') &&
    importReviewModelSource.includes('new Map<string, ImportReviewMatch>()'),
  'Import review must separate matched posters and skipped titles without exposing technical reasons.',
);
assert(
  importScreenSource.includes('useState<ImportPreview[]>([])') &&
    importScreenSource.includes('combineImportPreviews(previews)') &&
    importScreenSource.includes('for (const preview of previews)') &&
    importReviewModelSource.includes('function mergePreviewItems') &&
    importReviewModelSource.includes("return `${item.match.contentType}:${item.match.tmdbId}`"),
  'Imports from several platforms must share one deduplicated preview and confirm every prepared import.',
);
assert(
  onboardingSource.includes('<ImportDataScreen') &&
    onboardingSource.includes('workingSourcesOnly') &&
    onboardingSource.includes("moveToStep(importSatisfied ? 'notifications' : 'taste')"),
  'Onboarding must expose only working imports and skip Taste after a successful import.',
);
assert(
  onboardingSource.includes('<Text style={styles.importHeading}>Bring in your tastes</Text>') &&
    /importHeading: \{\s*\.\.\.typography\.title,\s*color: colors\.accentText,\s*\}/.test(onboardingSource) &&
    !onboardingSource.includes('Bring your history') &&
    !onboardingSource.includes('Bring your tastes'),
  'The import step must show Bring in your tastes in pink below the progress bars.',
);
assert(
  !onboardingSource.includes('Import as many files as you need.') &&
    !onboardingSource.includes('Your profile has enough titles to get started.'),
  'The import step must not repeat explanatory or success copy above the providers.',
);
assert(
  onboardingSource.includes('pendingImportTitleCount > 0') &&
    onboardingSource.includes('importDataRef.current?.requestPendingImport()') &&
    onboardingSource.includes("`Import ${pendingImportTitleCount} ${pendingImportTitleCount === 1 ? 'title' : 'titles'}`") &&
    /importBackAction: \{\s*flex: 1,\s*\}/.test(onboardingSource) &&
    /importPrimaryAction: \{\s*flex: 2,\s*\}/.test(onboardingSource),
  'The import actions must replace Skip with the pending title count and trigger that import.',
);
assert(
  /\{!embedded \? \([\s\S]*Import your library[\s\S]*Choose a service[\s\S]*\) : null\}/.test(importScreenSource) &&
    importScreenSource.includes('showDescription={!embedded}') &&
    /\{showDescription \? <Text style=\{styles\.sourceBody\}>\{source\.body\}<\/Text> : null\}/.test(importScreenSource) &&
    /\{!embedded \? \([\s\S]*styles\.note[\s\S]*styles\.disclaimer[\s\S]*\) : null\}/.test(importScreenSource),
  'Embedded onboarding imports must leave only the provider boxes before functional feedback appears.',
);
assert(
  importScreenSource.includes('showAction={!embedded}') &&
    /\{showAction \? \([\s\S]*label=\{`Import \$\{preview\.summary\.ready\}/.test(importScreenSource),
  'Embedded onboarding imports must use the screen footer instead of rendering a duplicate import button.',
);

console.log('Import data placement QA passed.');
