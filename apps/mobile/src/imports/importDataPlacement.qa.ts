// Node types are intentionally not part of the Expo runtime TypeScript configuration.
// @ts-expect-error QA executes under tsx/Node, where this built-in module is available.
import { readFileSync } from 'node:fs';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const appSource = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
const importScreenSource = readFileSync(new URL('./ImportDataScreen.tsx', import.meta.url), 'utf8');
const importApiSource = readFileSync(new URL('../api/imports.ts', import.meta.url), 'utf8');
const onboardingSource = readFileSync(new URL('../onboarding/OnboardingScreen.tsx', import.meta.url), 'utf8');
const settingsSource = readFileSync(new URL('../profile/SettingsScreen.tsx', import.meta.url), 'utf8');

assert(
  settingsSource.includes("label=\"Import your data\"") &&
    settingsSource.includes("navigation.navigate('ImportData')"),
  'Settings must expose the import entry point.',
);
assert(
  appSource.includes('component={ImportDataScreen} name="ImportData"'),
  'The import destination must be registered in the root stack.',
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
  importScreenSource.includes('Review matches') && importScreenSource.includes('Existing Watchly ratings and reviews will be kept.'),
  'The user must review matches and overwrite behavior before importing.',
);
assert(
  onboardingSource.includes('<ImportDataScreen') &&
    onboardingSource.includes('workingSourcesOnly') &&
    onboardingSource.includes("setStep(importSatisfied ? 'notifications' : 'taste')"),
  'Onboarding must expose only working imports and skip Taste after a successful import.',
);

console.log('Import data placement QA passed.');
