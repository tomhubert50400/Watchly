import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';
import {
  CatalogueSearchItem,
  CatalogueSearchType,
  searchCatalogue,
} from '../api/catalogue';
import { completeOnboarding, getHandleAvailability, updateProfile } from '../api/profile';
import { upsertTrackingState } from '../api/tracking';
import { useAuthSession } from '../auth/AuthSessionContext';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { LoadingState } from '../components/LoadingState';
import { MediaPoster } from '../components/MediaPoster';
import { Screen } from '../components/Screen';
import { TextInput } from '../components/TextInput';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import {
  getProfileHandleError,
  normalizeProfileHandleInput,
} from '../profile/profileHandle';

type OnboardingStep = 0 | 1 | 2;

const filters: { label: string; type: CatalogueSearchType }[] = [
  { label: 'All', type: 'all' },
  { label: 'Films', type: 'movie' },
  { label: 'Series', type: 'series' },
];

export function OnboardingScreen() {
  const {
    currentUser,
    firebaseIdToken,
    notifyTrackingChanged,
    refreshCurrentUser,
  } = useAuthSession();
  const [displayName, setDisplayName] = useState(currentUser?.displayName ?? '');
  const [handle, setHandle] = useState(currentUser?.handle ?? '');
  const [handleTouched, setHandleTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingHandle, setIsCheckingHandle] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [items, setItems] = useState<CatalogueSearchItem[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<CatalogueSearchItem[]>([]);
  const [selectedType, setSelectedType] = useState<CatalogueSearchType>('all');
  const [step, setStep] = useState<OnboardingStep>(0);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const trimmedQuery = query.trim();
  const handleError = getProfileHandleError(handle);
  const isHandleClaim = Boolean(currentUser?.onboardingCompleted && !currentUser.handle);
  const progress = useMemo(() => `${step + 1} / 3`, [step]);

  useEffect(() => {
    if (trimmedQuery.length < 2) {
      setItems([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }

    let isCurrent = true;
    const handle = setTimeout(() => {
      setSearchError(null);
      setSearchLoading(true);

      searchCatalogue(trimmedQuery, selectedType)
        .then((response) => {
          if (isCurrent) {
            setItems(response.items);
          }
        })
        .catch((caughtError) => {
          if (isCurrent) {
            setItems([]);
            setSearchError(
              caughtError instanceof Error ? caughtError.message : 'Catalogue search failed.',
            );
          }
        })
        .finally(() => {
          if (isCurrent) {
            setSearchLoading(false);
          }
        });
    }, 350);

    return () => {
      isCurrent = false;
      clearTimeout(handle);
    };
  }, [selectedType, trimmedQuery]);

  function toggleSelected(item: CatalogueSearchItem) {
    setSelected((current) => {
      const exists = current.some(
        (selectedItem) =>
          selectedItem.mediaType === item.mediaType && selectedItem.tmdbId === item.tmdbId,
      );

      if (exists) {
        return current.filter(
          (selectedItem) =>
            selectedItem.mediaType !== item.mediaType || selectedItem.tmdbId !== item.tmdbId,
        );
      }

      return [...current, item];
    });
  }

  async function continueOnboarding() {
    if (step === 0 && handleError) {
      setHandleTouched(true);
      setError(handleError);
      return;
    }

    if (step === 0) {
      if (!firebaseIdToken || isCheckingHandle) return;

      setIsCheckingHandle(true);
      setError(null);

      try {
        const availability = await getHandleAvailability(
          firebaseIdToken,
          normalizeProfileHandleInput(handle),
        );

        if (!availability.available) {
          setHandleTouched(true);
          setError('This handle is already taken.');
          return;
        }
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Could not check this handle. Try again.',
        );
        return;
      } finally {
        setIsCheckingHandle(false);
      }
    }

    setError(null);
    setStep((current) => (current + 1) as OnboardingStep);
  }

  async function finishOnboarding() {
    if (!firebaseIdToken || isFinishing) {
      return;
    }

    setError(null);
    setIsFinishing(true);

    try {
      if (handleError) {
        setHandleTouched(true);
        setStep(0);
        throw new Error(handleError);
      }

      const trimmedDisplayName = displayName.trim();

      await updateProfile(firebaseIdToken, {
        displayName: trimmedDisplayName.length > 0 ? trimmedDisplayName : null,
      });

      await Promise.all(
        selected.map((item) =>
          upsertTrackingState(firebaseIdToken, {
            contentType: item.mediaType,
            status: 'watchlisted',
            tmdbId: item.tmdbId,
          }),
        ),
      );

      if (selected.length > 0) {
        notifyTrackingChanged();
      }

      await completeOnboarding(firebaseIdToken, normalizeProfileHandleInput(handle));
      await refreshCurrentUser();
    } catch (caughtError) {
      const message = caughtError instanceof Error
        ? caughtError.message
        : 'Could not finish onboarding. Try again.';

      if (message.toLowerCase().includes('handle')) {
        setStep(0);
        setHandleTouched(true);
      }

      setError(message);
      setIsFinishing(false);
    }
  }

  async function finishHandleClaim() {
    if (!firebaseIdToken || isFinishing) return;

    setHandleTouched(true);
    setError(null);

    if (handleError) {
      setError(handleError);
      return;
    }

    setIsFinishing(true);

    try {
      await completeOnboarding(firebaseIdToken, normalizeProfileHandleInput(handle));
      await refreshCurrentUser();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not save your handle. Try again.',
      );
      setIsFinishing(false);
    }
  }

  if (isHandleClaim) {
    return (
      <Screen
        eyebrow="Profile identity"
        footer={(
          <Button
            fullWidth
            label="Save permanent handle"
            loading={isFinishing}
            onPress={() => void finishHandleClaim()}
          />
        )}
        title="Choose your @handle"
      >
        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>One permanent identifier</Text>
            <Text style={styles.bodyText}>
              Your display name can keep changing. Your handle uniquely identifies your profile
              and cannot be changed after you save it.
            </Text>
            <HandleField
              error={handleTouched ? handleError : null}
              handle={handle}
              onChange={(value) => {
                setHandle(value.toLowerCase().replace(/^@/, ''));
                setHandleTouched(true);
                setError(null);
              }}
            />
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      </Screen>
    );
  }

  return (
      <Screen
        eyebrow={`Onboarding ${progress}`}
        footer={(
          <>
            <View style={styles.actions}>
              {step > 0 ? (
                <Button
                  accessibilityLabel="Go back"
                  disabled={isFinishing}
                  label="Back"
                  onPress={() => setStep((current) => (current - 1) as OnboardingStep)}
                  variant="secondary"
                />
              ) : null}
              {step < 2 ? (
                <Button
                  accessibilityLabel="Continue onboarding"
                  loading={step === 0 && isCheckingHandle}
                  label="Continue"
                  onPress={() => void continueOnboarding()}
                />
              ) : (
                <Button
                  accessibilityLabel={
                    selected.length > 0 ? 'Finish onboarding' : 'Skip starter interests and finish'
                  }
                  disabled={isFinishing}
                  label={selected.length > 0 ? 'Finish onboarding' : 'Skip and finish'}
                  onPress={finishOnboarding}
                />
              )}
            </View>
            {isFinishing ? (
              <View style={styles.savingRow}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.mutedText}>Saving onboarding.</Text>
              </View>
            ) : null}
          </>
        )}
        title={getStepTitle(step)}
      >
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.content}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.progressTrack}>
            {[0, 1, 2].map((index) => (
              <View
                key={index}
                style={[styles.progressSegment, index <= step ? styles.progressSegmentActive : null]}
              />
            ))}
          </View>
          <OnboardingHero selected={selected} step={step} />

          {step === 0 ? (
            <ProfileBasicsStep
              displayName={displayName}
              handle={handle}
              handleError={handleTouched ? handleError : null}
              onChangeDisplayName={setDisplayName}
              onChangeHandle={(value) => {
                setHandle(value.toLowerCase().replace(/^@/, ''));
                setHandleTouched(true);
                setError(null);
              }}
            />
          ) : null}

          {step === 1 ? <PrivacyDefaultsStep /> : null}

          {step === 2 ? (
            <StarterInterestsStep
              items={items}
              onChangeQuery={setQuery}
              onChangeType={setSelectedType}
              onToggleSelected={toggleSelected}
              query={query}
              searchError={searchError}
              searchLoading={searchLoading}
              selected={selected}
              selectedType={selectedType}
            />
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

        </ScrollView>
      </Screen>
  );
}

function ProfileBasicsStep({
  displayName,
  handle,
  handleError,
  onChangeDisplayName,
  onChangeHandle,
}: {
  displayName: string;
  handle: string;
  handleError: string | null;
  onChangeDisplayName: (value: string) => void;
  onChangeHandle: (value: string) => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Make the profile readable</Text>
      <Text style={styles.bodyText}>
        Keep the display name from sign-in or choose a short name people will recognize.
      </Text>
      <TextInput
        autoCapitalize="words"
        helperText="You can edit this whenever you want."
        label="Display name"
        onChangeText={onChangeDisplayName}
        value={displayName}
      />
      <HandleField error={handleError} handle={handle} onChange={onChangeHandle} />
    </View>
  );
}

function HandleField({
  error,
  handle,
  onChange,
}: {
  error: string | null;
  handle: string;
  onChange: (value: string) => void;
}) {
  return (
    <TextInput
      autoCapitalize="none"
      autoCorrect={false}
      error={error ?? undefined}
      helperText="Shown as @handle. Use 3-20 letters, numbers, or underscores. This cannot be changed later."
      label="Permanent handle"
      maxLength={21}
      onChangeText={onChange}
      placeholder="cinema_fan"
      value={handle}
    />
  );
}

function PrivacyDefaultsStep() {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Privacy starts conservative</Text>
      <PrivacyFact label="Public by default" value="Profile and written reviews" />
      <PrivacyFact
        label="Private by default"
        value="Viewing history, episode progress, standalone ratings, and personal watchlists"
      />
      <PrivacyFact label="Member-only by default" value="Shared watchlists and votes" />
      <Text style={styles.bodyText}>
        You can change these later from Profile settings. This step only explains the defaults.
      </Text>
    </View>
  );
}

function PrivacyFact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.factRow}>
      <CheckCircle2 color={colors.success} size={20} strokeWidth={2} />
      <View style={styles.factCopy}>
        <Text style={styles.factLabel}>{label}</Text>
        <Text style={styles.mutedText}>{value}</Text>
      </View>
    </View>
  );
}

function StarterInterestsStep({
  items,
  onChangeQuery,
  onChangeType,
  onToggleSelected,
  query,
  searchError,
  searchLoading,
  selected,
  selectedType,
}: {
  items: CatalogueSearchItem[];
  onChangeQuery: (value: string) => void;
  onChangeType: (value: CatalogueSearchType) => void;
  onToggleSelected: (item: CatalogueSearchItem) => void;
  query: string;
  searchError: string | null;
  searchLoading: boolean;
  selected: CatalogueSearchItem[];
  selectedType: CatalogueSearchType;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Start with a few titles</Text>
      <Text style={styles.bodyText}>
        Search films or series you already want to track. Selected titles will start in My TV as
        watchlisted.
      </Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        label="Search"
        onChangeText={onChangeQuery}
        placeholder="Search a film or series"
        returnKeyType="search"
        value={query}
      />
      <View style={styles.filters}>
        {filters.map((filter) => {
          const isSelected = selectedType === filter.type;

          return (
            <Pressable
              accessibilityLabel={`Show ${filter.label}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              key={filter.type}
              onPress={() => onChangeType(filter.type)}
              style={({ pressed }) => [
                styles.filter,
                isSelected ? styles.filterSelected : null,
                pressed ? styles.filterPressed : null,
              ]}
            >
              <Text style={[styles.filterLabel, isSelected ? styles.filterLabelSelected : null]}>
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selected.length > 0 ? (
        <Chip label={`${selected.length} selected for My TV`} tone="success" />
      ) : null}

      {searchLoading && items.length === 0 ? (
        <LoadingState label="Searching TMDB" />
      ) : null}

      {searchError ? <Text style={styles.errorText}>{searchError}</Text> : null}

      {items.map((item) => (
        <StarterResultCard
          isSelected={selected.some(
            (selectedItem) =>
              selectedItem.mediaType === item.mediaType && selectedItem.tmdbId === item.tmdbId,
          )}
          item={item}
          key={item.id}
          onPress={() => onToggleSelected(item)}
        />
      ))}
    </View>
  );
}

function StarterResultCard({
  isSelected,
  item,
  onPress,
}: {
  isSelected: boolean;
  item: CatalogueSearchItem;
  onPress: () => void;
}) {
  const year = item.releaseDate ? item.releaseDate.slice(0, 4) : null;
  const mediaLabel = item.mediaType === 'movie' ? 'Film' : 'Series';

  return (
    <Pressable
      accessibilityLabel={`${isSelected ? 'Remove' : 'Add'} ${item.title}`}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.resultCard,
        isSelected ? styles.resultCardSelected : null,
        pressed ? styles.resultCardPressed : null,
      ]}
    >
      <MediaPoster
        accessibilityLabel={`${item.title} poster`}
        posterUrl={item.posterUrl}
        style={styles.poster}
      />
      <View style={styles.resultCopy}>
        <Text numberOfLines={2} style={styles.resultTitle}>
          {item.title}
        </Text>
        <Text style={styles.resultMeta}>
          {mediaLabel}
          {year ? ` / ${year}` : ''}
        </Text>
      </View>
      {isSelected ? <CheckCircle2 color={colors.success} size={22} strokeWidth={2} /> : null}
    </Pressable>
  );
}

function OnboardingHero({
  selected,
  step,
}: {
  selected: CatalogueSearchItem[];
  step: OnboardingStep;
}) {
  const heroItems = selected.slice(0, 3);

  return (
    <View style={styles.heroCard}>
      <View style={styles.posterStack}>
        {[0, 1, 2].map((index) => (
          <MediaPoster
            accessibilityLabel={
              heroItems[index] ? `${heroItems[index].title} poster` : 'Starter media poster slot'
            }
            key={index}
            posterUrl={heroItems[index]?.posterUrl ?? null}
            style={[
              styles.heroPoster,
              index === 1 ? styles.heroPosterRaised : null,
              index === 2 ? styles.heroPosterDimmed : null,
            ]}
          />
        ))}
      </View>
      <View style={styles.heroCopy}>
        <Chip label={`Step ${step + 1} of 3`} tone="accent" />
        <Text style={styles.heroTitle}>{getStepTitle(step)}</Text>
        <Text style={styles.heroBody}>{getStepSubtitle(step)}</Text>
      </View>
    </View>
  );
}

function getStepTitle(step: OnboardingStep) {
  if (step === 0) {
    return 'Profile basics';
  }

  if (step === 1) {
    return 'Privacy defaults';
  }

  return 'Starter watch interests';
}

function getStepSubtitle(step: OnboardingStep) {
  if (step === 0) {
    return 'Give your public reviews a readable byline before the library fills in.';
  }

  if (step === 1) {
    return 'Keep tracking private by default while your public review profile stays readable.';
  }

  return 'Choose a few posters to anchor My TV before you start browsing.';
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  bodyText: {
    ...typography.body,
    color: colors.muted,
  },
  card: {
    ...shadows.panel,
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
    fontWeight: '700',
  },
  factCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  factLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
  },
  factRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
  },
  filter: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  filterLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
  },
  filterLabelSelected: {
    color: colors.accentText,
  },
  filterPressed: {
    opacity: 0.76,
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
  },
  heroBody: {
    ...typography.body,
    color: colors.muted,
  },
  heroCard: {
    ...shadows.panel,
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderColor: colors.borderStrong,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.lg,
    padding: spacing.lg,
  },
  heroCopy: {
    flex: 1,
    gap: spacing.sm,
    minWidth: 0,
  },
  heroPoster: {
    height: 116,
    width: 76,
  },
  heroPosterDimmed: {
    marginLeft: -spacing.xl,
    opacity: 0.64,
  },
  heroPosterRaised: {
    marginLeft: -spacing.xl,
    marginTop: -spacing.md,
  },
  heroTitle: {
    ...typography.title,
    color: colors.text,
  },
  posterStack: {
    flexDirection: 'row',
    paddingLeft: spacing.sm,
  },
  mutedText: {
    ...typography.body,
    color: colors.muted,
  },
  poster: {
    height: 84,
    width: 56,
  },
  progressSegment: {
    backgroundColor: colors.border,
    borderRadius: radii.sm,
    flex: 1,
    height: 5,
  },
  progressSegmentActive: {
    backgroundColor: colors.accent,
  },
  progressTrack: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  resultCard: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  resultCardPressed: {
    opacity: 0.78,
  },
  resultCardSelected: {
    backgroundColor: colors.successBackground,
    borderColor: colors.successBorder,
  },
  resultCopy: {
    flex: 1,
    minWidth: 0,
  },
  resultMeta: {
    color: colors.accentText,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
  resultTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 21,
  },
  savingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
  },
});
