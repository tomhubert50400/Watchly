import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type * as ExpoDocumentPicker from 'expo-document-picker';
import { requireOptionalNativeModule } from 'expo';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { AlertCircle, CheckCircle2, ChevronRight, ExternalLink, ShieldCheck } from 'lucide-react-native';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import {
  confirmDataImport,
  ImportPreview,
  ImportPreviewItem,
  ImportResult,
  previewDataImport,
  SupportedImportSource,
} from '../api/imports';
import { useAuthSession } from '../auth/AuthSessionContext';
import {
  BottomActionSheet,
  BottomActionSheetScrollView,
} from '../components/BottomActionSheet';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { colors, radii, spacing, typography } from '../design/tokens';
import { hapticError, hapticSuccess } from '../feedback/haptics';

declare const require: (moduleName: 'expo-document-picker') => typeof ExpoDocumentPicker;

type ImportBrand = 'imdb' | 'letterboxd' | 'trakt' | 'tvtime';

type ImportSource = {
  body: string;
  brand: ImportBrand;
  exportLinks: readonly {
    label: string;
    url: string;
  }[];
  format: string;
  guide: readonly {
    body: string;
    title: string;
  }[];
  importSource?: SupportedImportSource;
  name: string;
};

export type ImportDataScreenHandle = {
  requestPendingImport: () => void;
};

type ImportDataScreenProps = {
  embedded?: boolean;
  onImportCompleted?: (completion: { importId: string; result: ImportResult }) => void;
  onPendingImportChange?: (readyTitleCount: number) => void;
  workingSourcesOnly?: boolean;
};

const importSources: readonly ImportSource[] = [
  {
    body: 'Watched films, planned films, series progress, and favorites',
    brand: 'tvtime',
    exportLinks: [],
    format: 'Official GDPR ZIP or supported CSV',
    guide: [
      {
        body: 'Find the original GDPR export you downloaded from your TV Time account.',
        title: 'Locate your export',
      },
      {
        body: 'Keep the ZIP or CSV unchanged. Do not rename or edit its files.',
        title: 'Keep the original file',
      },
      {
        body: 'Return here with the file. Watchly will show what can be recovered before importing anything.',
        title: 'Review in Watchly',
      },
    ],
    importSource: 'tv-time',
    name: 'TV Time',
  },
  {
    body: 'Ratings and watchlist',
    brand: 'imdb',
    exportLinks: [
      { label: 'Open Your Ratings', url: 'https://www.imdb.com/list/ratings/' },
      { label: 'Open your Watchlist', url: 'https://www.imdb.com/list/watchlist/' },
    ],
    format: 'CSV account export',
    guide: [
      {
        body: 'Open Your Ratings or your Watchlist in a signed-in web browser.',
        title: 'Choose what to export',
      },
      {
        body: 'Use the Export action in the top-right corner to download the CSV file.',
        title: 'Download the CSV',
      },
      {
        body: 'Import ratings and Watchlist files one at a time. Watchly combines them without replacing existing activity.',
        title: 'Import each file',
      },
    ],
    importSource: 'imdb',
    name: 'IMDb',
  },
  {
    body: 'Watched films, ratings, reviews, and watchlist',
    brand: 'letterboxd',
    exportLinks: [
      { label: 'Open Letterboxd export', url: 'https://letterboxd.com/user/exportdata/' },
    ],
    format: 'Official ZIP or CSV export',
    guide: [
      {
        body: 'Sign in to Letterboxd on the web and open the Export your data page.',
        title: 'Open your data settings',
      },
      {
        body: 'Select Export Data and wait for Letterboxd to prepare the ZIP file.',
        title: 'Download the export',
      },
      {
        body: 'Choose the original ZIP here. Watchly can also read a supported CSV from inside the export.',
        title: 'Choose the file',
      },
    ],
    importSource: 'letterboxd',
    name: 'Letterboxd',
  },
  {
    body: 'Watch history, ratings, reviews, and lists',
    brand: 'trakt',
    exportLinks: [
      { label: 'Open Trakt data settings', url: 'https://app.trakt.tv/settings/advanced' },
    ],
    format: 'Official ZIP with JSON files',
    guide: [
      {
        body: 'Sign in to Trakt on the web, open Settings, then choose the Data section.',
        title: 'Open Trakt settings',
      },
      {
        body: 'Select Export Trakt Data. Trakt will email you when the ZIP is ready.',
        title: 'Request your export',
      },
      {
        body: 'Download the ZIP and keep it unchanged. You do not need a VIP subscription for the complete JSON export.',
        title: 'Save the original ZIP',
      },
    ],
    name: 'Trakt',
  },
];

export const ImportDataScreen = forwardRef<ImportDataScreenHandle, ImportDataScreenProps>(function ImportDataScreen({
  embedded = false,
  onImportCompleted,
  onPendingImportChange,
  workingSourcesOnly = false,
}, ref) {
  const {
    firebaseIdToken,
    notifySocialChanged,
    notifyTrackingChanged,
  } = useAuthSession();
  const [activeSource, setActiveSource] = useState<ImportBrand | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [selectedSource, setSelectedSource] = useState<ImportSource | null>(null);
  const [status, setStatus] = useState<'confirming' | 'idle' | 'picking' | 'previewing'>('idle');
  const visibleSources = workingSourcesOnly
    ? importSources.filter((source) => source.importSource)
    : importSources;

  useEffect(() => {
    onPendingImportChange?.(preview?.summary.ready ?? 0);
  }, [onPendingImportChange, preview?.summary.ready]);

  useEffect(() => () => onPendingImportChange?.(0), [onPendingImportChange]);

  const chooseFile = async (source: ImportSource) => {
    if (status !== 'idle') return;

    if (!source.importSource) {
      showUnavailableSource(source);
      return;
    }

    if (!firebaseIdToken) {
      Alert.alert('Sign in required', 'Sign in before importing account data.');
      return;
    }

    try {
      if (!requireOptionalNativeModule('ExpoDocumentPicker')) {
        Alert.alert(
          'File picker unavailable',
          getMissingDocumentPickerMessage(),
        );
        hapticError();
        return;
      }

      setStatus('picking');
      const DocumentPicker = require('expo-document-picker');
      const selection = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: source.importSource === 'letterboxd' || source.importSource === 'tv-time'
          ? ['text/csv', 'application/zip', 'application/x-zip-compressed', 'application/octet-stream']
          : ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel'],
      });

      if (selection.canceled) return;

      setActiveSource(source.brand);
      setError(null);
      setPreview(null);
      setResult(null);
      setStatus('previewing');
      const nextPreview = await previewDataImport(
        firebaseIdToken,
        source.importSource,
        selection.assets[0],
      );
      setPreview(nextPreview);
      setSelectedSource(null);
    } catch (selectionError) {
      const rawMessage = selectionError instanceof Error ? selectionError.message : '';
      const message = rawMessage.includes("Cannot find native module 'ExpoDocumentPicker'")
        ? getMissingDocumentPickerMessage()
        : rawMessage || 'The import file could not be prepared.';
      setError(message);
      setSelectedSource(null);
      hapticError();
    } finally {
      setStatus('idle');
      setActiveSource(null);
    }
  };

  const confirmImport = async () => {
    if (!firebaseIdToken || !preview || status !== 'idle') return;

    setError(null);
    setStatus('confirming');
    try {
      const importResult = await confirmDataImport(firebaseIdToken, preview.importId);
      onImportCompleted?.({ importId: preview.importId, result: importResult });
      setResult(importResult);
      setPreview(null);
      notifySocialChanged();
      notifyTrackingChanged();
      hapticSuccess();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'The import could not be completed.');
      hapticError();
    } finally {
      setStatus('idle');
    }
  };

  const requestConfirmation = () => {
    if (!preview || preview.summary.ready === 0) return;

    Alert.alert(
      `Import ${preview.summary.ready} ${preview.summary.ready === 1 ? 'title' : 'titles'}?`,
      'Existing Watchly ratings and reviews will be kept. This import cannot be undone automatically.',
      [
        { style: 'cancel', text: 'Cancel' },
        { onPress: () => void confirmImport(), text: 'Import' },
      ],
    );
  };

  useImperativeHandle(ref, () => ({ requestPendingImport: requestConfirmation }), [requestConfirmation]);

  const content = (
    <>
      <View style={styles.page}>
        {!embedded ? (
          <>
            <View style={styles.intro}>
              <Text accessibilityRole="header" style={styles.title}>Import your library</Text>
              <Text style={styles.body}>
                Bring in your watch history, ratings, and reviews from another tracker.
              </Text>
            </View>

            <Text style={styles.instruction}>Choose a service to see how to export and import your data.</Text>
          </>
        ) : null}

        <View style={styles.sourceList}>
          {visibleSources.map((source) => (
            <ImportSourceRow
              busy={status === 'previewing' && activeSource === source.brand}
              disabled={status !== 'idle'}
              key={source.name}
              onPress={() => setSelectedSource(source)}
              showDescription={!embedded}
              source={source}
            />
          ))}
        </View>

        {error ? (
          <View accessibilityLiveRegion="polite" style={styles.errorPanel}>
            <AlertCircle color={colors.danger} size={20} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {preview ? (
          <ImportPreviewPanel
            confirming={status === 'confirming'}
            onConfirm={requestConfirmation}
            preview={preview}
            showAction={!embedded}
          />
        ) : null}

        {result ? <ImportResultPanel result={result} /> : null}

        {!embedded ? (
          <>
            <View style={styles.note}>
              <ShieldCheck color={colors.textSubtle} size={18} strokeWidth={2} />
              <Text style={styles.noteText}>
                Review every match before confirming. Original dates and privacy settings are preserved, and existing Watchly ratings or reviews are never overwritten.
              </Text>
            </View>

            <Text style={styles.disclaimer}>Watchly is not affiliated with these services.</Text>
          </>
        ) : null}
      </View>

      <ImportGuideSheet
        choosingFile={status === 'picking'}
        onChooseFile={(source) => void chooseFile(source)}
        onClose={() => setSelectedSource(null)}
        source={selectedSource}
      />
    </>
  );

  return embedded ? content : <Screen title="">{content}</Screen>;
});

function ImportSourceRow({
  busy,
  disabled,
  onPress,
  showDescription,
  source,
}: {
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
  showDescription: boolean;
  source: ImportSource;
}) {
  return (
    <Pressable
      accessibilityHint="Opens a step-by-step export guide."
      accessibilityLabel={`Import from ${source.name}. ${source.body}.`}
      accessibilityRole="button"
      accessibilityState={{ busy, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.sourceRow,
        pressed ? styles.sourceRowPressed : null,
        disabled && !busy ? styles.sourceRowDisabled : null,
      ]}
    >
      <BrandLogo brand={source.brand} />
      <View style={styles.sourceCopy}>
        <Text style={styles.sourceName}>{source.name}</Text>
        {showDescription ? <Text style={styles.sourceBody}>{source.body}</Text> : null}
      </View>
      {busy
        ? <ActivityIndicator color={colors.accentText} size="small" />
        : <ChevronRight color={colors.textSubtle} size={23} strokeWidth={2} />}
    </Pressable>
  );
}

function ImportGuideSheet({
  choosingFile,
  onChooseFile,
  onClose,
  source,
}: {
  choosingFile: boolean;
  onChooseFile: (source: ImportSource) => void;
  onClose: () => void;
  source: ImportSource | null;
}) {
  const footer = source ? (
    <Button
      disabled={!source.importSource}
      fullWidth
      label={source.importSource ? `Choose ${source.format}` : 'Import support coming soon'}
      loading={choosingFile}
      onPress={() => onChooseFile(source)}
    />
  ) : null;

  return (
    <BottomActionSheet
      footer={footer}
      onClose={onClose}
      title={source ? `Import from ${source.name}` : 'Import data'}
      visible={source !== null}
    >
      {source ? (
        <BottomActionSheetScrollView contentContainerStyle={styles.guideContent}>
          <View style={styles.guideHero}>
            <BrandLogo brand={source.brand} />
            <View style={styles.guideHeroCopy}>
              <Text style={styles.guideService}>{source.name}</Text>
              <Text style={styles.guideFormat}>{source.format}</Text>
            </View>
          </View>

          <View style={styles.guideSteps}>
            {source.guide.map((step, index) => (
              <View key={step.title} style={styles.guideStep}>
                <View style={styles.guideStepNumber}>
                  <Text style={styles.guideStepNumberText}>{index + 1}</Text>
                </View>
                <View style={styles.guideStepCopy}>
                  <Text style={styles.guideStepTitle}>{step.title}</Text>
                  <Text style={styles.guideStepBody}>{step.body}</Text>
                </View>
              </View>
            ))}
          </View>

          {source.exportLinks.length > 0 ? (
            <View style={styles.exportLinks}>
              {source.exportLinks.map((link) => (
                <Pressable
                  accessibilityHint="Opens the official service website."
                  accessibilityLabel={link.label}
                  accessibilityRole="link"
                  key={link.url}
                  onPress={() => void openExportLink(link.url)}
                  style={({ pressed }) => [styles.exportLink, pressed ? styles.exportLinkPressed : null]}
                >
                  <Text style={styles.exportLinkText}>{link.label}</Text>
                  <ExternalLink color={colors.accentText} size={17} strokeWidth={2} />
                </Pressable>
              ))}
            </View>
          ) : null}

          {!source.importSource ? (
            <View style={styles.guideAvailability}>
              <AlertCircle color={colors.textSubtle} size={18} strokeWidth={2} />
              <Text style={styles.guideAvailabilityText}>
                The export guide is ready. File import will activate after Watchly validates a real {source.name} export.
              </Text>
            </View>
          ) : null}

          <View style={styles.guidePrivacy}>
            <ShieldCheck color={colors.textSubtle} size={18} strokeWidth={2} />
            <Text style={styles.guidePrivacyText}>
              Your export is uploaded only when you choose it. You will review every match before confirming.
            </Text>
          </View>
        </BottomActionSheetScrollView>
      ) : null}
    </BottomActionSheet>
  );
}

function getMissingDocumentPickerMessage() {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient
    ? 'Expo Go is missing its native document picker. Update or reinstall Expo Go, then reload Watchly.'
    : 'This Watchly build is missing its native document picker. Rebuild and reinstall Watchly, then reload the app.';
}

async function openExportLink(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Could not open the export page', 'Open the service website in your browser and go to its data or export settings.');
  }
}

function ImportPreviewPanel({
  confirming,
  onConfirm,
  preview,
  showAction,
}: {
  confirming: boolean;
  onConfirm: () => void;
  preview: ImportPreview;
  showAction: boolean;
}) {
  return (
    <View style={styles.previewPanel}>
      <View style={styles.previewHeading}>
        <View style={styles.previewHeadingCopy}>
          <Text accessibilityRole="header" style={styles.previewTitle}>Review matches</Text>
          <Text numberOfLines={1} style={styles.previewFileName}>{preview.fileName}</Text>
        </View>
        <View style={styles.readyBadge}>
          <Text style={styles.readyBadgeText}>{preview.summary.ready} READY</Text>
        </View>
      </View>

      <View style={styles.summaryRow}>
        {preview.source === 'tv-time' ? (
          <>
            <SummaryValue label="Watched" value={preview.summary.watched} />
            <SummaryValue label="Watching" value={preview.summary.watching} />
            <SummaryValue label="Planned" value={preview.summary.watchlisted} />
          </>
        ) : (
          <>
            <SummaryValue label="Ratings" value={preview.summary.ratings} />
            <SummaryValue label="Reviews" value={preview.summary.reviews} />
            <SummaryValue label="Watched" value={preview.summary.watched} />
          </>
        )}
        <SummaryValue label="Attention" value={preview.summary.needsAttention} warning />
      </View>

      <View style={styles.matchList}>
        {preview.items.slice(0, PREVIEW_ITEM_LIMIT).map((item, index) => (
          <ImportMatchRow item={item} key={`${item.sourceTitle}:${item.sourceYear ?? ''}:${index}`} />
        ))}
        {preview.items.length > PREVIEW_ITEM_LIMIT ? (
          <Text style={styles.moreMatches}>
            +{preview.items.length - PREVIEW_ITEM_LIMIT} more titles included in this preview
          </Text>
        ) : null}
      </View>

      {preview.summary.needsAttention > 0 ? (
        <Text style={styles.previewWarning}>
          {preview.summary.needsAttention} unmatched or unsupported {preview.summary.needsAttention === 1 ? 'row will' : 'rows will'} be skipped.
        </Text>
      ) : null}

      {showAction ? (
        <Button
          disabled={preview.summary.ready === 0}
          fullWidth
          label={`Import ${preview.summary.ready} ${preview.summary.ready === 1 ? 'title' : 'titles'}`}
          loading={confirming}
          onPress={onConfirm}
        />
      ) : null}
    </View>
  );
}

function SummaryValue({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return (
    <View style={styles.summaryValue}>
      <Text style={[styles.summaryNumber, warning && value > 0 ? styles.summaryNumberWarning : null]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function ImportMatchRow({ item }: { item: ImportPreviewItem }) {
  const match = item.status === 'ready' ? item.match : null;
  const ready = match !== null;
  const actionLabels = [
    item.actions.rating !== null ? `${item.actions.rating}/5` : null,
    item.actions.hasReview ? 'Review' : null,
    item.actions.watched ? 'Watched' : null,
    item.actions.watching ? 'Watching' : null,
    item.actions.watchlisted ? 'Want to watch' : null,
    item.actions.favorite ? 'Favorite' : null,
  ].filter((label): label is string => Boolean(label));

  return (
    <View style={styles.matchRow}>
      {ready
        ? <CheckCircle2 color={colors.success} size={19} />
        : <AlertCircle color={colors.danger} size={19} />}
      <View style={styles.matchCopy}>
        <Text numberOfLines={1} style={styles.matchTitle}>{item.sourceTitle}</Text>
        <Text numberOfLines={2} style={styles.matchMeta}>
          {match
            ? `Matched to ${match.title}${match.releaseDate ? ` (${match.releaseDate.slice(0, 4)})` : ''}`
            : item.issues[0] ?? 'This row cannot be imported.'}
        </Text>
        {ready && actionLabels.length > 0 ? (
          <Text style={styles.matchActions}>{actionLabels.join(' · ')}</Text>
        ) : null}
      </View>
    </View>
  );
}

function ImportResultPanel({ result }: { result: ImportResult }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.resultPanel}>
      <CheckCircle2 color={colors.success} size={24} />
      <View style={styles.resultCopy}>
        <Text accessibilityRole="header" style={styles.resultTitle}>Import complete</Text>
        <Text style={styles.resultBody}>
          {result.titlesProcessed} titles processed, {result.ratingsCreated} ratings, {result.reviewsCreated} reviews, and {result.viewingEventsCreated} viewing entries added.
        </Text>
        {result.preservedExisting > 0 ? (
          <Text style={styles.resultMeta}>{result.preservedExisting} existing Watchly entries were kept.</Text>
        ) : null}
      </View>
    </View>
  );
}

function showUnavailableSource(source: ImportSource) {
  Alert.alert(
    'Trakt sample needed',
    'Send one real Trakt ZIP export so its JSON files can be mapped without risking incorrect history.',
  );
}

const PREVIEW_ITEM_LIMIT = 8;

function BrandLogo({ brand }: { brand: ImportBrand }) {
  if (brand === 'tvtime') {
    return (
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.logoFrame, styles.tvTimeLogo]}>
        <View style={styles.tvTimeTop} />
        <View style={styles.tvTimeStem} />
      </View>
    );
  }

  if (brand === 'imdb') {
    return (
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.logoFrame, styles.imdbLogo]}>
        <Text style={styles.imdbWordmark}>IMDb</Text>
      </View>
    );
  }

  if (brand === 'letterboxd') {
    return (
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.logoFrame}>
        <Svg height={46} viewBox="0 0 46 46" width={46}>
          <Circle cx={23} cy={23} fill="#202830" r={23} />
          <Circle cx={15} cy={23} fill="#FF8000" r={7} />
          <Circle cx={23} cy={23} fill="#00E054" r={7} />
          <Circle cx={31} cy={23} fill="#40BCF4" r={7} />
          <Path d="M18.8 17.4a7 7 0 0 1 0 11.2 7 7 0 0 1 0-11.2Z" fill="#556677" />
          <Path d="M27.2 17.4a7 7 0 0 0 0 11.2 7 7 0 0 0 0-11.2Z" fill="#556677" />
        </Svg>
      </View>
    );
  }

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.logoFrame}>
      <Svg height={46} viewBox="0 0 48 48" width={46}>
        <Defs>
          <LinearGradient id="traktGradient" x1="1" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor="#9F42C6" />
            <Stop offset="0.58" stopColor="#B4339A" />
            <Stop offset="1" stopColor="#F50613" />
          </LinearGradient>
        </Defs>
        <Rect fill="url(#traktGradient)" height={48} rx={11} width={48} />
        <Path
          d="M13.62 17.97l7.92 7.92 1.47-1.47-7.92-7.92-1.47 1.47Zm14.39 14.4 1.47-1.46-2.16-2.16L47.64 8.43c-.19-.75-.46-1.46-.79-2.14L24.39 28.75l3.62 3.62Zm-15.09-13.7-1.46 1.46 14.4 14.4 1.46-1.47-4.32-4.31L46.35 5.4c-.36-.6-.78-1.16-1.25-1.68L21.54 27.28l-8.62-8.61Zm34.95-9.09L28.7 28.75l1.47 1.46L48 12.38v-1.12c0-.57-.04-1.14-.13-1.68ZM25.16 22.27l-7.92-7.92-1.47 1.47 7.92 7.92 1.47-1.47Zm16.16 12.85c0 3.42-2.78 6.2-6.2 6.2H12.88c-3.42 0-6.2-2.78-6.2-6.2V12.88c0-3.42 2.78-6.21 6.2-6.21h20.78V4.6H12.88c-4.56 0-8.28 3.71-8.28 8.28v22.24c0 4.56 3.71 8.28 8.28 8.28h22.24c4.56 0 8.28-3.71 8.28-8.28v-3.51h-2.07v3.51Z"
          fill="#FFFFFF"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    ...typography.body,
    color: colors.textMuted,
    maxWidth: 560,
  },
  errorPanel: {
    alignItems: 'flex-start',
    backgroundColor: colors.dangerBackground,
    borderColor: colors.dangerBorder,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
    flex: 1,
  },
  disclaimer: {
    ...typography.meta,
    color: colors.textSubtle,
    textAlign: 'center',
  },
  exportLink: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  exportLinkPressed: {
    opacity: 0.76,
  },
  exportLinkText: {
    color: colors.accentText,
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  exportLinks: {
    gap: spacing.sm,
  },
  guideAvailability: {
    alignItems: 'flex-start',
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  guideAvailabilityText: {
    ...typography.meta,
    color: colors.textMuted,
    flex: 1,
    fontWeight: '500',
  },
  guideContent: {
    gap: spacing.lg,
    paddingBottom: spacing.lg,
  },
  guideFormat: {
    ...typography.meta,
    color: colors.textSubtle,
    marginTop: 2,
  },
  guideHero: {
    alignItems: 'center',
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  guideHeroCopy: {
    flex: 1,
    minWidth: 0,
  },
  guidePrivacy: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  guidePrivacyText: {
    ...typography.meta,
    color: colors.textSubtle,
    flex: 1,
    fontWeight: '500',
  },
  guideService: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '900',
    lineHeight: 24,
  },
  guideStep: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
  },
  guideStepBody: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: 3,
  },
  guideStepCopy: {
    flex: 1,
    minWidth: 0,
    paddingTop: 2,
  },
  guideStepNumber: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  guideStepNumberText: {
    color: colors.accentText,
    fontSize: 13,
    fontWeight: '900',
  },
  guideSteps: {
    gap: spacing.lg,
  },
  guideStepTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  imdbLogo: {
    backgroundColor: '#F5C518',
    borderRadius: 7,
  },
  imdbWordmark: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -1,
  },
  instruction: {
    ...typography.body,
    color: colors.textSubtle,
  },
  intro: {
    gap: spacing.sm,
  },
  logoFrame: {
    alignItems: 'center',
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  matchActions: {
    ...typography.meta,
    color: colors.accentText,
    marginTop: 3,
  },
  matchCopy: {
    flex: 1,
    minWidth: 0,
  },
  matchList: {
    borderBottomColor: colors.border,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  matchMeta: {
    color: colors.textSubtle,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  matchRow: {
    alignItems: 'flex-start',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  matchTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  moreMatches: {
    ...typography.meta,
    color: colors.textSubtle,
    paddingVertical: spacing.sm,
    textAlign: 'center',
  },
  note: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  noteText: {
    ...typography.meta,
    color: colors.textSubtle,
    flex: 1,
    fontWeight: '500',
  },
  page: {
    gap: spacing.lg,
    paddingTop: spacing.lg,
  },
  previewFileName: {
    ...typography.meta,
    color: colors.textSubtle,
  },
  previewHeading: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
  },
  previewHeadingCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  previewPanel: {
    backgroundColor: colors.panel,
    borderColor: colors.borderStrong,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  previewTitle: {
    ...typography.title,
    color: colors.text,
  },
  previewWarning: {
    ...typography.meta,
    color: colors.danger,
  },
  readyBadge: {
    backgroundColor: colors.successBackground,
    borderColor: colors.successBorder,
    borderRadius: radii.xs,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  readyBadgeText: {
    ...typography.meta,
    color: colors.success,
  },
  resultBody: {
    ...typography.body,
    color: colors.textMuted,
  },
  resultCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  resultMeta: {
    ...typography.meta,
    color: colors.textSubtle,
  },
  resultPanel: {
    alignItems: 'flex-start',
    backgroundColor: colors.successBackground,
    borderColor: colors.successBorder,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  resultTitle: {
    ...typography.title,
    color: colors.text,
  },
  sourceBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  sourceCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  sourceList: {
    gap: spacing.md,
  },
  sourceName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 23,
  },
  sourceRow: {
    alignItems: 'center',
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 92,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  sourceRowPressed: {
    backgroundColor: colors.panelSoft,
    opacity: 0.86,
  },
  sourceRowDisabled: {
    opacity: 0.48,
  },
  summaryLabel: {
    ...typography.meta,
    color: colors.textSubtle,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  summaryNumber: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '900',
  },
  summaryNumberWarning: {
    color: colors.danger,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  summaryValue: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderRadius: radii.sm,
    flex: 1,
    gap: 1,
    paddingVertical: spacing.sm,
  },
  title: {
    ...typography.heading,
    color: colors.text,
  },
  tvTimeLogo: {
    backgroundColor: '#25272D',
    borderRadius: radii.sm,
  },
  tvTimeStem: {
    backgroundColor: '#FFD400',
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    height: 22,
    position: 'absolute',
    top: 12,
    width: 8,
  },
  tvTimeTop: {
    backgroundColor: '#FFD400',
    borderRadius: 2,
    height: 8,
    position: 'absolute',
    top: 10,
    width: 27,
  },
});
