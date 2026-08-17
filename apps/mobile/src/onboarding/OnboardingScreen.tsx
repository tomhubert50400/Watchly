import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FocusEvent,
  InputAccessoryView,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  BellRing,
  Camera,
  CheckCircle2,
  ChevronDown,
  Database,
  ShieldCheck,
} from 'lucide-react-native';
import {
  CatalogueSearchItem,
  CatalogueSearchType,
  searchCatalogue,
} from '../api/catalogue';
import {
  completeOnboarding,
  getHandleAvailability,
  getProfile,
} from '../api/profile';
import { useAuthSession } from '../auth/AuthSessionContext';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { LoadingState } from '../components/LoadingState';
import { MediaPoster } from '../components/MediaPoster';
import { Screen } from '../components/Screen';
import { TextInput } from '../components/TextInput';
import { UserAvatar } from '../components/UserAvatar';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import { hapticError, hapticSuccess } from '../feedback/haptics';
import { ImportDataScreen } from '../imports/ImportDataScreen';
import {
  enableAllPushFromOnboarding,
  ReleasePushSetupResult,
} from '../notifications/nativePushNotifications';
import {
  copyRemoteProfileAvatar,
  chooseAndUploadProfileAvatar,
} from '../profile/uploadProfileAvatar';
import {
  getProfileHandleError,
  normalizeProfileHandleInput,
} from '../profile/profileHandle';
import {
  clearOnboardingDraft,
  OnboardingDraft,
  OnboardingStep,
  OnboardingTasteItem,
  readOnboardingDraft,
  writeOnboardingDraft,
} from './onboardingDraft';

const steps: readonly OnboardingStep[] = ['profile', 'import', 'taste', 'notifications'];
const filters: { label: string; type: CatalogueSearchType }[] = [
  { label: 'All', type: 'all' },
  { label: 'Films', type: 'movie' },
  { label: 'Series', type: 'series' },
];
const ONBOARDING_INPUT_ACCESSORY_ID = 'onboarding-profile-keyboard-accessory';
const ONBOARDING_KEYBOARD_ACCESSORY_HEIGHT = 38;

export function OnboardingScreen() {
  const {
    currentUser,
    firebaseIdToken,
    notifySocialChanged,
    notifyTrackingChanged,
    refreshCurrentUser,
  } = useAuthSession();
  const isHandleClaim = Boolean(currentUser?.onboardingCompleted && !currentUser.handle);
  const [avatarUploadsEnabled, setAvatarUploadsEnabled] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentUser?.photoUrl ?? null);
  const [avatarStatus, setAvatarStatus] = useState<'idle' | 'saving'>('idle');
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const [completedImportIds, setCompletedImportIds] = useState<string[]>([]);
  const [displayName, setDisplayName] = useState(currentUser?.displayName ?? '');
  const [draftReady, setDraftReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handle, setHandle] = useState(currentUser?.handle ?? '');
  const [handleTouched, setHandleTouched] = useState(false);
  const [importSatisfied, setImportSatisfied] = useState(false);
  const [isCheckingHandle, setIsCheckingHandle] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isProfileEditing, setIsProfileEditing] = useState(false);
  const [notificationOutcome, setNotificationOutcome] = useState<ReleasePushSetupResult | null>(null);
  const [notificationStatus, setNotificationStatus] = useState<'idle' | 'requesting'>('idle');
  const [step, setStep] = useState<OnboardingStep>('profile');
  const [tasteItems, setTasteItems] = useState<OnboardingTasteItem[]>([]);
  const copyAttempted = useRef(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!currentUser) return;

    let active = true;
    copyAttempted.current = false;
    setAvatarUrl(currentUser.photoUrl);

    void Promise.all([
      readOnboardingDraft(currentUser.id).catch(() => null),
      firebaseIdToken ? getProfile(firebaseIdToken).catch(() => null) : Promise.resolve(null),
    ]).then(async ([draft, profile]) => {
      if (!active) return;

      setAvatarUploadsEnabled(Boolean(profile?.avatarUploadsEnabled));
      setAvatarUrl(profile?.avatarUrl ?? draft?.avatarUrl ?? currentUser.photoUrl);
      setCompletedImportIds(draft?.completedImportIds ?? []);
      setDisplayName(draft?.displayName ?? currentUser.displayName ?? '');
      setHandle(draft?.handle ?? currentUser.handle ?? '');
      setImportSatisfied(draft?.importSatisfied ?? false);
      setStep(isHandleClaim ? 'profile' : normalizeDraftStep(draft));
      setTasteItems(draft?.tasteItems ?? []);
      setDraftReady(true);

      if (
        !isHandleClaim
        && firebaseIdToken
        && currentUser.photoUrl
        && profile?.avatarUploadsEnabled
        && !profile.avatarUrl
        && !copyAttempted.current
      ) {
        copyAttempted.current = true;
        setAvatarStatus('saving');

        try {
          const savedProfile = await copyRemoteProfileAvatar(firebaseIdToken, currentUser.photoUrl);
          if (!active) return;
          setAvatarUrl(savedProfile.avatarUrl);
          notifySocialChanged();
        } catch {
          if (!active) return;
          setAvatarMessage('We could not copy your sign-in photo. Choose another photo or continue without one.');
        } finally {
          if (active) setAvatarStatus('idle');
        }
      }
    });

    return () => {
      active = false;
    };
  }, [
    currentUser?.displayName,
    currentUser?.handle,
    currentUser?.id,
    currentUser?.photoUrl,
    firebaseIdToken,
    isHandleClaim,
  ]);

  useEffect(() => {
    if (!currentUser || !draftReady || isHandleClaim) return;

    const draft: OnboardingDraft = {
      avatarUrl,
      completedImportIds,
      displayName,
      handle,
      importSatisfied,
      step,
      tasteItems,
      version: 1,
    };

    void writeOnboardingDraft(currentUser.id, draft);
  }, [
    avatarUrl,
    completedImportIds,
    currentUser,
    displayName,
    draftReady,
    handle,
    importSatisfied,
    isHandleClaim,
    step,
    tasteItems,
  ]);

  if (!currentUser || !draftReady) {
    return (
      <Screen title="">
        <LoadingState label="Preparing your profile" />
      </Screen>
    );
  }

  const handleError = getProfileHandleError(handle);
  const focusProfileField = (event: FocusEvent) => {
    setIsProfileEditing(true);
    scrollViewRef.current?.scrollResponderScrollNativeHandleToKeyboard(
      event.target,
      ONBOARDING_KEYBOARD_ACCESSORY_HEIGHT + spacing.xl,
      true,
    );
  };

  async function continueProfile() {
    if (!firebaseIdToken || isCheckingHandle) return;

    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setError('Enter a display name to continue.');
      return;
    }

    if (handleError) {
      setHandleTouched(true);
      setError(handleError);
      return;
    }

    setError(null);
    setIsCheckingHandle(true);

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

      setStep('import');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not check this handle.');
    } finally {
      setIsCheckingHandle(false);
    }
  }

  async function changeAvatar() {
    if (!firebaseIdToken || !avatarUploadsEnabled || avatarStatus === 'saving') return;

    setAvatarStatus('saving');
    setAvatarMessage(null);

    try {
      const profile = await chooseAndUploadProfileAvatar(firebaseIdToken);
      if (!profile) return;

      setAvatarUrl(profile.avatarUrl);
      notifySocialChanged();
      hapticSuccess();
    } catch (caughtError) {
      setAvatarMessage(
        caughtError instanceof Error ? caughtError.message : 'Could not update your profile photo.',
      );
      hapticError();
    } finally {
      setAvatarStatus('idle');
    }
  }

  function continueImport() {
    setError(null);
    setStep(importSatisfied ? 'notifications' : 'taste');
  }

  function continueTaste() {
    if (tasteItems.length < 1 || tasteItems.length > 3) {
      setError('Choose 1 to 3 titles you have already watched.');
      return;
    }

    setError(null);
    setStep('notifications');
  }

  function goBack() {
    setError(null);
    if (step === 'import') setStep('profile');
    if (step === 'taste') setStep('import');
    if (step === 'notifications') setStep(importSatisfied ? 'import' : 'taste');
  }

  async function allowNotifications() {
    if (!firebaseIdToken || !currentUser || notificationStatus === 'requesting' || isFinishing) return;

    setNotificationStatus('requesting');
    setNotificationOutcome(null);
    setError(null);

    try {
      const outcome = await enableAllPushFromOnboarding(firebaseIdToken, currentUser.id);
      setNotificationOutcome(outcome);

      if (outcome.status === 'enabled') {
        await finishOnboarding();
      }
    } catch (caughtError) {
      setNotificationOutcome({
        message: caughtError instanceof Error
          ? caughtError.message
          : 'Notifications are unavailable in this build.',
        status: 'unavailable',
      });
      hapticError();
    } finally {
      setNotificationStatus('idle');
    }
  }

  async function finishOnboarding() {
    if (!firebaseIdToken || !currentUser || isFinishing) return;

    setIsFinishing(true);
    setError(null);

    try {
      await completeOnboarding(firebaseIdToken, {
        completedImportIds,
        displayName: displayName.trim(),
        handle: normalizeProfileHandleInput(handle),
        tasteItems: importSatisfied
          ? []
          : tasteItems.map((item) => ({
            contentType: item.contentType,
            tmdbId: item.tmdbId,
          })),
      });
      await clearOnboardingDraft(currentUser.id);
      if (!importSatisfied && tasteItems.length > 0) notifyTrackingChanged();
      await refreshCurrentUser();
    } catch (caughtError) {
      const message = caughtError instanceof Error
        ? caughtError.message
        : 'Could not finish onboarding. Try again.';

      if (message.toLowerCase().includes('handle')) {
        setHandleTouched(true);
        setStep('profile');
      }

      setError(message);
      setIsFinishing(false);
      hapticError();
    }
  }

  async function finishHandleClaim() {
    if (!firebaseIdToken || !currentUser || isFinishing) return;

    setHandleTouched(true);
    setError(null);

    if (handleError) {
      setError(handleError);
      return;
    }

    setIsFinishing(true);

    try {
      await completeOnboarding(firebaseIdToken, {
        displayName: currentUser.displayName,
        handle: normalizeProfileHandleInput(handle),
      });
      await clearOnboardingDraft(currentUser.id);
      await refreshCurrentUser();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not save your handle.');
      setIsFinishing(false);
    }
  }

  if (isHandleClaim) {
    return (
      <View style={styles.root}>
        <Screen
          eyebrow="Profile identity"
          footer={
            isProfileEditing ? undefined : (
              <Button
                fullWidth
                label="Save permanent handle"
                loading={isFinishing}
                onPress={() => void finishHandleClaim()}
              />
            )
          }
          nativeKeyboardInsetsOnly
          scrollViewRef={scrollViewRef}
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
                inputAccessoryViewID={ONBOARDING_INPUT_ACCESSORY_ID}
                onBlur={() => setIsProfileEditing(false)}
                onChange={(value) => {
                  setHandle(value.toLowerCase().replace(/^@/, ''));
                  setHandleTouched(true);
                  setError(null);
                }}
                onFocus={focusProfileField}
              />
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        </Screen>
        <OnboardingKeyboardAccessory onDismiss={() => setIsProfileEditing(false)} />
      </View>
    );
  }

  const stepIndex = steps.indexOf(step);

  return (
    <View style={styles.root}>
      <Screen
        eyebrow={`Onboarding ${stepIndex + 1} / ${steps.length}`}
        footer={
          isProfileEditing ? undefined : (
            <OnboardingFooter
              error={error}
              importSatisfied={importSatisfied}
              isCheckingHandle={isCheckingHandle}
              isFinishing={isFinishing}
              notificationOutcome={notificationOutcome}
              notificationStatus={notificationStatus}
              onAllowNotifications={() => void allowNotifications()}
              onBack={goBack}
              onContinue={() => {
                if (step === 'profile') void continueProfile();
                if (step === 'import') continueImport();
                if (step === 'taste') continueTaste();
              }}
              onFinishWithoutNotifications={() => void finishOnboarding()}
              step={step}
            />
          )
        }
        key={step}
        nativeKeyboardInsetsOnly
        scrollViewRef={scrollViewRef}
        title={getStepTitle(step)}
      >
        <View style={styles.content}>
          <View
            accessibilityLabel={`Step ${stepIndex + 1} of ${steps.length}`}
            style={styles.progressTrack}
          >
            {steps.map((item, index) => (
              <View
                key={item}
                style={[styles.progressSegment, index <= stepIndex ? styles.progressSegmentActive : null]}
              />
            ))}
          </View>

          <StepHero step={step} />

          {step === 'profile' ? (
            <ProfileStep
              avatarStatus={avatarStatus}
              avatarUploadsEnabled={avatarUploadsEnabled}
              avatarUrl={avatarUrl}
              displayName={displayName}
              handle={handle}
              handleError={handleTouched ? handleError : null}
              inputAccessoryViewID={ONBOARDING_INPUT_ACCESSORY_ID}
              message={avatarMessage}
              onChangeAvatar={() => void changeAvatar()}
              onChangeDisplayName={(value) => {
                setDisplayName(value);
                setError(null);
              }}
              onChangeHandle={(value) => {
                setHandle(value.toLowerCase().replace(/^@/, ''));
                setHandleTouched(true);
                setError(null);
              }}
              onFieldBlur={() => setIsProfileEditing(false)}
              onFieldFocus={focusProfileField}
            />
          ) : null}

          {step === 'import' ? (
            <View style={styles.importCard}>
              <Text style={styles.importLead}>
                Import as many files as you need. If at least one title is added, Watchly will skip Taste.
              </Text>
              {importSatisfied ? (
                <View style={styles.successPanel}>
                  <CheckCircle2 color={colors.success} size={20} />
                  <Text style={styles.successText}>Your profile has enough titles to get started.</Text>
                </View>
              ) : null}
              <ImportDataScreen
                embedded
                onImportCompleted={({ importId, result }) => {
                  if (result.titlesProcessed < 1) return;
                  setCompletedImportIds((current) => current.includes(importId) ? current : [...current, importId]);
                  setImportSatisfied(true);
                  setError(null);
                }}
                workingSourcesOnly
              />
            </View>
          ) : null}

          {step === 'taste' ? (
            <TasteStep
              onChange={(items) => {
                setTasteItems(items);
                setError(null);
              }}
              selected={tasteItems}
            />
          ) : null}

          {step === 'notifications' ? (
            <NotificationsStep outcome={notificationOutcome} />
          ) : null}
        </View>
      </Screen>
      <OnboardingKeyboardAccessory onDismiss={() => setIsProfileEditing(false)} />
    </View>
  );
}

function OnboardingKeyboardAccessory({ onDismiss }: { onDismiss: () => void }) {
  if (Platform.OS !== 'ios') return null;

  return (
    <InputAccessoryView nativeID={ONBOARDING_INPUT_ACCESSORY_ID}>
      <View style={styles.keyboardAccessory}>
        <Pressable
          accessibilityLabel="Dismiss keyboard"
          accessibilityRole="button"
          hitSlop={6}
          onPress={() => {
            onDismiss();
            Keyboard.dismiss();
          }}
          style={({ pressed }) => [styles.keyboardDismiss, pressed ? styles.pressed : null]}
        >
          <ChevronDown color={colors.text} size={18} strokeWidth={2.25} />
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

function OnboardingFooter({
  error,
  importSatisfied,
  isCheckingHandle,
  isFinishing,
  notificationOutcome,
  notificationStatus,
  onAllowNotifications,
  onBack,
  onContinue,
  onFinishWithoutNotifications,
  step,
}: {
  error: string | null;
  importSatisfied: boolean;
  isCheckingHandle: boolean;
  isFinishing: boolean;
  notificationOutcome: ReleasePushSetupResult | null;
  notificationStatus: 'idle' | 'requesting';
  onAllowNotifications: () => void;
  onBack: () => void;
  onContinue: () => void;
  onFinishWithoutNotifications: () => void;
  step: OnboardingStep;
}) {
  const notificationBlocked = notificationOutcome?.status === 'denied'
    || notificationOutcome?.status === 'unavailable';

  return (
    <View style={styles.footer}>
      {error ? <Text accessibilityLiveRegion="polite" style={styles.errorText}>{error}</Text> : null}
      {step === 'notifications' ? (
        <>
          {notificationBlocked ? (
            <View style={styles.actions}>
              <Button disabled={isFinishing} label="Back" onPress={onBack} variant="secondary" />
              <Button
                label="Continue without notifications"
                loading={isFinishing}
                onPress={onFinishWithoutNotifications}
              />
            </View>
          ) : (
            <>
              <View style={styles.actions}>
                <Button disabled={isFinishing} label="Back" onPress={onBack} variant="secondary" />
                <Button
                  label="Allow notifications"
                  loading={notificationStatus === 'requesting' || isFinishing}
                  onPress={onAllowNotifications}
                />
              </View>
              <Button
                disabled={notificationStatus === 'requesting' || isFinishing}
                fullWidth
                label="Not now"
                onPress={onFinishWithoutNotifications}
                variant="ghost"
              />
            </>
          )}
        </>
      ) : (
        <View style={styles.actions}>
          {step !== 'profile' ? (
            <Button label="Back" onPress={onBack} variant="secondary" />
          ) : null}
          <Button
            label={step === 'import' && !importSatisfied ? 'Continue to Taste' : 'Continue'}
            loading={step === 'profile' && isCheckingHandle}
            onPress={onContinue}
          />
        </View>
      )}
    </View>
  );
}

function ProfileStep({
  avatarStatus,
  avatarUploadsEnabled,
  avatarUrl,
  displayName,
  handle,
  handleError,
  inputAccessoryViewID,
  message,
  onChangeAvatar,
  onChangeDisplayName,
  onChangeHandle,
  onFieldBlur,
  onFieldFocus,
}: {
  avatarStatus: 'idle' | 'saving';
  avatarUploadsEnabled: boolean;
  avatarUrl: string | null;
  displayName: string;
  handle: string;
  handleError: string | null;
  inputAccessoryViewID: string;
  message: string | null;
  onChangeAvatar: () => void;
  onChangeDisplayName: (value: string) => void;
  onChangeHandle: (value: string) => void;
  onFieldBlur: () => void;
  onFieldFocus: (event: FocusEvent) => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.avatarRow}>
        <View>
          <UserAvatar avatarUrl={avatarUrl} displayName={displayName} size={88} />
          {avatarStatus === 'saving' ? (
            <View style={styles.avatarBusy}>
              <ActivityIndicator color={colors.accentText} size="small" />
            </View>
          ) : null}
        </View>
        <View style={styles.avatarCopy}>
          <Text style={styles.sectionTitle}>Your Watchly profile</Text>
          <Text style={styles.bodyText}>
            We start with your sign-in photo. You can replace it now or anytime in Settings.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !avatarUploadsEnabled || avatarStatus === 'saving' }}
            disabled={!avatarUploadsEnabled || avatarStatus === 'saving'}
            onPress={onChangeAvatar}
            style={({ pressed }) => [styles.photoAction, pressed ? styles.pressed : null]}
          >
            <Camera color={colors.accentText} size={17} />
            <Text style={styles.photoActionText}>
              {avatarUploadsEnabled ? 'Change photo' : 'Photo changes unavailable'}
            </Text>
          </Pressable>
        </View>
      </View>

      {message ? <Text style={styles.warningText}>{message}</Text> : null}

      <TextInput
        autoCapitalize="words"
        helperText="You can change this later."
        inputAccessoryViewID={inputAccessoryViewID}
        label="Display name"
        maxLength={80}
        onBlur={onFieldBlur}
        onChangeText={onChangeDisplayName}
        onFocus={onFieldFocus}
        value={displayName}
      />
      <HandleField
        error={handleError}
        handle={handle}
        inputAccessoryViewID={inputAccessoryViewID}
        onBlur={onFieldBlur}
        onChange={onChangeHandle}
        onFocus={onFieldFocus}
      />
    </View>
  );
}

function HandleField({
  error,
  handle,
  inputAccessoryViewID,
  onBlur,
  onChange,
  onFocus,
}: {
  error: string | null;
  handle: string;
  inputAccessoryViewID: string;
  onBlur: () => void;
  onChange: (value: string) => void;
  onFocus: (event: FocusEvent) => void;
}) {
  return (
    <TextInput
      autoCapitalize="none"
      autoCorrect={false}
      error={error ?? undefined}
      helperText="Use 3-20 letters, numbers, or underscores. Your @handle is permanent."
      inputAccessoryViewID={inputAccessoryViewID}
      label="Permanent handle"
      maxLength={21}
      onBlur={onBlur}
      onChangeText={onChange}
      onFocus={onFocus}
      placeholder="cinema_fan"
      value={handle}
    />
  );
}

function TasteStep({
  onChange,
  selected,
}: {
  onChange: (items: OnboardingTasteItem[]) => void;
  selected: OnboardingTasteItem[];
}) {
  const [items, setItems] = useState<CatalogueSearchItem[]>([]);
  const [query, setQuery] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<CatalogueSearchType>('all');
  const trimmedQuery = query.trim();

  useEffect(() => {
    if (trimmedQuery.length < 2) {
      setItems([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }

    let active = true;
    const timeout = setTimeout(() => {
      setSearchLoading(true);
      setSearchError(null);

      void searchCatalogue(trimmedQuery, selectedType)
        .then((response) => {
          if (active) setItems(response.items);
        })
        .catch((caughtError) => {
          if (!active) return;
          setItems([]);
          setSearchError(caughtError instanceof Error ? caughtError.message : 'Catalogue search failed.');
        })
        .finally(() => {
          if (active) setSearchLoading(false);
        });
    }, 350);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [selectedType, trimmedQuery]);

  function toggle(item: CatalogueSearchItem) {
    const existing = selected.some((selectedItem) =>
      selectedItem.contentType === item.mediaType && selectedItem.tmdbId === item.tmdbId
    );

    if (existing) {
      onChange(selected.filter((selectedItem) =>
        selectedItem.contentType !== item.mediaType || selectedItem.tmdbId !== item.tmdbId
      ));
      return;
    }

    if (selected.length >= 3) {
      setSearchError('You can choose up to 3 titles. Remove one to add another.');
      return;
    }

    onChange([...selected, {
      contentType: item.mediaType,
      posterUrl: item.posterUrl,
      title: item.title,
      tmdbId: item.tmdbId,
    }]);
  }

  return (
    <View style={styles.card}>
      <View style={styles.tasteNotice}>
        <ShieldCheck color={colors.accentText} size={20} />
        <Text style={styles.tasteNoticeText}>
          Choose 1 to 3 titles you have already seen. They will be added as Watched, without an invented viewing date.
        </Text>
      </View>

      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        label="Search"
        onChangeText={setQuery}
        placeholder="Search a film or series"
        returnKeyType="search"
        value={query}
      />

      <View style={styles.filters}>
        {filters.map((filter) => {
          const active = selectedType === filter.type;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              key={filter.type}
              onPress={() => setSelectedType(filter.type)}
              style={({ pressed }) => [
                styles.filter,
                active ? styles.filterSelected : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={[styles.filterLabel, active ? styles.filterLabelSelected : null]}>
                {filter.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Chip label={`${selected.length} of 3 selected`} tone={selected.length > 0 ? 'success' : 'accent'} />

      {selected.length > 0 ? (
        <View style={styles.selectedStrip}>
          {selected.map((item) => (
            <Pressable
              accessibilityLabel={`Remove ${item.title}`}
              accessibilityRole="button"
              key={`${item.contentType}:${item.tmdbId}`}
              onPress={() => onChange(selected.filter((selectedItem) =>
                selectedItem.contentType !== item.contentType || selectedItem.tmdbId !== item.tmdbId
              ))}
              style={({ pressed }) => [styles.selectedPoster, pressed ? styles.pressed : null]}
            >
              <MediaPoster posterUrl={item.posterUrl} style={styles.selectedPosterImage} />
              <View style={styles.selectedCheck}>
                <CheckCircle2 color={colors.success} size={18} />
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      {searchLoading && items.length === 0 ? <LoadingState label="Searching TMDB" /> : null}
      {searchError ? <Text style={styles.errorText}>{searchError}</Text> : null}

      {items.map((item) => (
        <TasteResult
          item={item}
          key={item.id}
          onPress={() => toggle(item)}
          selected={selected.some((selectedItem) =>
            selectedItem.contentType === item.mediaType && selectedItem.tmdbId === item.tmdbId
          )}
        />
      ))}
    </View>
  );
}

function TasteResult({
  item,
  onPress,
  selected,
}: {
  item: CatalogueSearchItem;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={`${selected ? 'Remove' : 'Add'} ${item.title}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.resultCard,
        selected ? styles.resultCardSelected : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <MediaPoster posterUrl={item.posterUrl} style={styles.poster} />
      <View style={styles.resultCopy}>
        <Text numberOfLines={2} style={styles.resultTitle}>{item.title}</Text>
        <Text style={styles.resultMeta}>
          {item.mediaType === 'movie' ? 'Film' : 'Series'}
          {item.releaseDate ? ` / ${item.releaseDate.slice(0, 4)}` : ''}
        </Text>
      </View>
      {selected ? <CheckCircle2 color={colors.success} size={22} /> : null}
    </Pressable>
  );
}

function NotificationsStep({ outcome }: { outcome: ReleasePushSetupResult | null }) {
  const blocked = outcome?.status === 'denied' || outcome?.status === 'unavailable';

  return (
    <View style={styles.card}>
      <View style={styles.permissionIcon}>
        <BellRing color={colors.accentText} size={30} />
      </View>
      <Text style={styles.sectionTitle}>One permission, all useful updates</Text>
      <Text style={styles.bodyText}>
        Allow Watchly notifications to receive release, social, and system updates, including future functional notification types. Promotional messages stay separate.
      </Text>
      <View style={styles.factList}>
        <PermissionFact label="Release alerts for titles you follow" />
        <PermissionFact label="Social and shared-list activity" />
        <PermissionFact label="Important Watchly system updates" />
      </View>
      <Text style={styles.settingsHint}>
        If you choose Not now, you can enable them later in Profile, Settings, Notifications.
      </Text>

      {blocked ? (
        <View style={styles.warningPanel}>
          <Text style={styles.warningText}>{outcome.message}</Text>
          {outcome.status === 'denied' ? (
            <Button
              fullWidth
              label="Open device settings"
              onPress={() => void Linking.openSettings()}
              variant="secondary"
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function PermissionFact({ label }: { label: string }) {
  return (
    <View style={styles.factRow}>
      <CheckCircle2 color={colors.success} size={19} />
      <Text style={styles.factText}>{label}</Text>
    </View>
  );
}

function StepHero({ step }: { step: OnboardingStep }) {
  const Icon = step === 'profile'
    ? Camera
    : step === 'import'
      ? Database
      : step === 'taste'
        ? CheckCircle2
        : BellRing;

  return (
    <View style={styles.heroCard}>
      <View style={styles.heroIcon}>
        <Icon color={colors.accentText} size={27} />
      </View>
      <View style={styles.heroCopy}>
        <Text style={styles.heroTitle}>{getStepTitle(step)}</Text>
        <Text style={styles.heroBody}>{getStepSubtitle(step)}</Text>
      </View>
    </View>
  );
}

function normalizeDraftStep(draft: OnboardingDraft | null): OnboardingStep {
  if (!draft) return 'profile';
  if (draft.importSatisfied && draft.step === 'taste') return 'notifications';
  return steps.includes(draft.step) ? draft.step : 'profile';
}

function getStepTitle(step: OnboardingStep) {
  if (step === 'profile') return 'Make it yours';
  if (step === 'import') return 'Bring your history';
  if (step === 'taste') return 'Start your Taste';
  return 'Stay in the loop';
}

function getStepSubtitle(step: OnboardingStep) {
  if (step === 'profile') return 'Set the identity people will recognize across Watchly.';
  if (step === 'import') return 'Move titles from a tracker you already used.';
  if (step === 'taste') return 'Give your new profile a first signal from titles you know.';
  return 'Choose whether Watchly can reach you outside the app.';
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  avatarBusy: {
    alignItems: 'center',
    backgroundColor: 'rgba(8, 10, 14, 0.72)',
    borderRadius: 44,
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  avatarCopy: {
    flex: 1,
    gap: spacing.sm,
    minWidth: 0,
  },
  avatarRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.lg,
  },
  bodyText: {
    ...typography.body,
    color: colors.textMuted,
  },
  card: {
    ...shadows.panel,
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.lg,
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
  factList: {
    gap: spacing.md,
  },
  factRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  factText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    fontWeight: '700',
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
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  filterLabelSelected: {
    color: colors.accentText,
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
  },
  footer: {
    gap: spacing.sm,
  },
  heroBody: {
    ...typography.body,
    color: colors.textMuted,
  },
  heroCard: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderColor: colors.borderStrong,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  heroCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  heroTitle: {
    ...typography.title,
    color: colors.text,
  },
  importCard: {
    gap: spacing.md,
  },
  importLead: {
    ...typography.body,
    color: colors.textMuted,
    paddingHorizontal: spacing.xs,
  },
  keyboardAccessory: {
    alignItems: 'flex-end',
    backgroundColor: '#101116',
    height: ONBOARDING_KEYBOARD_ACCESSORY_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  keyboardDismiss: {
    alignItems: 'center',
    backgroundColor: colors.panelElevated,
    borderColor: colors.borderStrong,
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  permissionIcon: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
    borderRadius: 30,
    borderWidth: 1,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
  photoAction: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 40,
  },
  photoActionText: {
    color: colors.accentText,
    fontSize: 14,
    fontWeight: '800',
  },
  poster: {
    height: 84,
    width: 56,
  },
  pressed: {
    opacity: 0.76,
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
  root: {
    flex: 1,
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
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
  resultTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
  },
  selectedCheck: {
    backgroundColor: colors.panel,
    borderRadius: 10,
    position: 'absolute',
    right: 4,
    top: 4,
  },
  selectedPoster: {
    borderRadius: radii.sm,
  },
  selectedPosterImage: {
    height: 96,
    width: 64,
  },
  selectedStrip: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  settingsHint: {
    ...typography.meta,
    color: colors.textSubtle,
  },
  successPanel: {
    alignItems: 'center',
    backgroundColor: colors.successBackground,
    borderColor: colors.successBorder,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  successText: {
    ...typography.body,
    color: colors.success,
    flex: 1,
    fontWeight: '700',
  },
  tasteNotice: {
    alignItems: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  tasteNoticeText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  warningPanel: {
    backgroundColor: colors.dangerBackground,
    borderColor: colors.dangerBorder,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  warningText: {
    ...typography.body,
    color: colors.danger,
    fontWeight: '600',
  },
});
