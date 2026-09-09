import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  FocusEvent,
  InputAccessoryView,
  Keyboard,
  Linking,
  PixelRatio,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  BellOff,
  BellRing,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react-native';
import {
  CatalogueSearchItem,
  getOnboardingTasteOptions,
  searchCatalogue,
} from '../api/catalogue';
import {
  completeOnboarding,
  getHandleAvailability,
  getProfile,
} from '../api/profile';
import { useAuthSession } from '../auth/AuthSessionContext';
import { notifyUserDataChanged } from '../sync/userDataEvents';
import { BrandWordmark } from '../brand/BrandWordmark';
import {
  BottomActionSheet,
  BottomActionSheetScrollView,
} from '../components/BottomActionSheet';
import { Button } from '../components/Button';
import { LoadingState } from '../components/LoadingState';
import { MediaPoster } from '../components/MediaPoster';
import { Screen } from '../components/Screen';
import { TextInput } from '../components/TextInput';
import { UserAvatar } from '../components/UserAvatar';
import { colors, radii, shadows, spacing, touchTargets, typography } from '../design/tokens';
import { hapticError, hapticSuccess } from '../feedback/haptics';
import { ImportDataScreen, ImportDataScreenHandle } from '../imports/ImportDataScreen';
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
import {
  canAddOnboardingTasteItem,
  getOnboardingTasteCount,
  isOnboardingTasteSelectionValid,
  ONBOARDING_TASTE_LIMIT_PER_TYPE,
} from './onboardingTaste';

const steps: readonly OnboardingStep[] = ['profile', 'import', 'taste', 'notifications'];
const tasteMediaOptions: { label: string; value: 'movie' | 'series' }[] = [
  { label: 'Movies', value: 'movie' },
  { label: 'TV Shows', value: 'series' },
];
const notificationPreviews: {
  fallbackText: string;
  label: string;
  titlePrefix: string;
}[] = [
  {
    fallbackText: 'A title you follow is available today.',
    label: 'NEW RELEASE',
    titlePrefix: 'Now available:',
  },
  {
    fallbackText: 'Someone liked your latest review.',
    label: 'SOCIAL',
    titlePrefix: 'New activity around',
  },
  {
    fallbackText: 'Your shared watchlist has a new pick.',
    label: 'WATCHLY',
    titlePrefix: 'A new update for',
  },
];
const ONBOARDING_INPUT_ACCESSORY_ID = 'onboarding-profile-keyboard-accessory';
const ONBOARDING_KEYBOARD_ACCESSORY_HEIGHT = 38;
const ONBOARDING_KEYBOARD_FIELD_GAP = 200 / PixelRatio.get();
const ONBOARDING_STEP_TRANSITION_MS = 280;

type OnboardingStepTransition = {
  direction: 1 | -1;
  from: OnboardingStep;
  to: OnboardingStep;
};

export function OnboardingScreen() {
  const {
    currentUser,
    firebaseIdToken,
    refreshCurrentUser,
  } = useAuthSession();
  const { width: windowWidth } = useWindowDimensions();
  const isHandleClaim = Boolean(currentUser?.onboardingCompleted && !currentUser.handle);
  const [avatarUploadsEnabled, setAvatarUploadsEnabled] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentUser?.photoUrl ?? null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarStatus, setAvatarStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
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
  const [notificationSkipConfirmationVisible, setNotificationSkipConfirmationVisible] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<'idle' | 'requesting'>('idle');
  const [pendingImportTitleCount, setPendingImportTitleCount] = useState(0);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState<boolean | null>(null);
  const [step, setStep] = useState<OnboardingStep>('profile');
  const [stepTransition, setStepTransition] = useState<OnboardingStepTransition | null>(null);
  const [tasteItems, setTasteItems] = useState<OnboardingTasteItem[]>([]);
  const copyAttempted = useRef(false);
  const importDataRef = useRef<ImportDataScreenHandle>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const stepTransitionProgress = useRef(new Animated.Value(0)).current;
  const stepTransitioning = useRef(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(
      (enabled) => {
        if (active) setReduceMotionEnabled(enabled);
      },
      () => {
        if (active) setReduceMotionEnabled(true);
      },
    );
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotionEnabled,
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useLayoutEffect(() => {
    if (!stepTransition) return;

    const animation = Animated.timing(stepTransitionProgress, {
      duration: ONBOARDING_STEP_TRANSITION_MS,
      easing: Easing.inOut(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (!finished) return;
      setStep(stepTransition.to);
      setStepTransition(null);
      stepTransitioning.current = false;
    });

    return () => animation.stop();
  }, [stepTransition, stepTransitionProgress]);

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
          notifyUserDataChanged('profile', 'socialGraph');
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
  function moveToStep(nextStep: OnboardingStep) {
    if (nextStep === step || stepTransitioning.current) return;

    if (reduceMotionEnabled !== false) {
      setStep(nextStep);
      return;
    }

    stepTransitioning.current = true;
    stepTransitionProgress.setValue(0);
    setStepTransition({
      direction: steps.indexOf(nextStep) > steps.indexOf(step) ? 1 : -1,
      from: step,
      to: nextStep,
    });
  }

  const focusProfileField = (event: FocusEvent) => {
    setIsProfileEditing(true);
    scrollViewRef.current?.scrollResponderScrollNativeHandleToKeyboard(
      event.target,
      ONBOARDING_KEYBOARD_ACCESSORY_HEIGHT + spacing.xl + ONBOARDING_KEYBOARD_FIELD_GAP,
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

      moveToStep('import');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not check this handle.');
    } finally {
      setIsCheckingHandle(false);
    }
  }

  async function changeAvatar() {
    if (!firebaseIdToken || !avatarUploadsEnabled || avatarStatus === 'saving') return;

    const previousPreviewUrl = avatarPreviewUrl;
    const previousStatus = avatarStatus;
    setAvatarStatus('saving');
    setAvatarMessage(null);

    try {
      const profile = await chooseAndUploadProfileAvatar(firebaseIdToken, setAvatarPreviewUrl);
      if (!profile) {
        setAvatarStatus(previousStatus);
        return;
      }

      setAvatarUrl(profile.avatarUrl);
      setAvatarStatus('saved');
      notifyUserDataChanged('profile', 'socialGraph');
      hapticSuccess();
    } catch (caughtError) {
      setAvatarPreviewUrl(previousPreviewUrl);
      setAvatarStatus('idle');
      setAvatarMessage(
        caughtError instanceof Error ? caughtError.message : 'Could not update your profile photo.',
      );
      hapticError();
    }
  }

  function continueImport() {
    setError(null);
    moveToStep(importSatisfied ? 'notifications' : 'taste');
  }

  function continueTaste() {
    if (!isOnboardingTasteSelectionValid(tasteItems)) {
      setError('Choose up to 5 movies and 5 TV shows.');
      return;
    }

    setError(null);
    moveToStep('notifications');
  }

  function goBack() {
    setError(null);
    if (step === 'import') moveToStep('profile');
    if (step === 'taste') moveToStep('import');
    if (step === 'notifications' && notificationSkipConfirmationVisible) {
      setNotificationSkipConfirmationVisible(false);
    } else if (step === 'notifications') {
      moveToStep(importSatisfied ? 'import' : 'taste');
    }
  }

  function requestNotificationSkip() {
    const notificationBlocked = notificationOutcome?.status === 'denied'
      || notificationOutcome?.status === 'unavailable';
    if (notificationBlocked) {
      void finishOnboarding();
      return;
    }

    setError(null);
    setNotificationSkipConfirmationVisible(true);
  }

  async function allowNotifications() {
    if (!firebaseIdToken || !currentUser || notificationStatus === 'requesting' || isFinishing) return;

    setNotificationSkipConfirmationVisible(false);
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
      if (!importSatisfied && tasteItems.length > 0) {
        notifyUserDataChanged('opinions', 'tracking');
      }
      await refreshCurrentUser();
    } catch (caughtError) {
      const message = caughtError instanceof Error
        ? caughtError.message
        : 'Could not finish onboarding. Try again.';

      if (message.toLowerCase().includes('handle')) {
        setHandleTouched(true);
        moveToStep('profile');
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

  const transitionSteps: readonly OnboardingStep[] = stepTransition
    ? stepTransition.direction === 1
      ? [stepTransition.from, stepTransition.to]
      : [stepTransition.to, stepTransition.from]
    : [step];
  const stepTrackLeft = stepTransition?.direction === -1 ? -windowWidth : 0;
  const stepTrackTranslateX = stepTransition
    ? stepTransitionProgress.interpolate({
        inputRange: [0, 1],
        outputRange: stepTransition.direction === 1
          ? [0, -windowWidth]
          : [0, windowWidth],
      })
    : 0;

  return (
    <View style={styles.root}>
      <Animated.View
        style={[
          styles.stepTrack,
          {
            left: stepTrackLeft,
            transform: [{ translateX: stepTrackTranslateX }],
            width: windowWidth * transitionSteps.length,
          },
        ]}
      >
        {transitionSteps.map((pageStep) => {
          const pageStepIndex = steps.indexOf(pageStep);

          return (
            <View
              accessibilityElementsHidden={Boolean(stepTransition)}
              importantForAccessibility={stepTransition ? 'no-hide-descendants' : 'auto'}
              key={pageStep}
              pointerEvents={stepTransition ? 'none' : 'auto'}
              style={[styles.stepPage, { width: windowWidth }]}
            >
              <Screen
                footer={
                  isProfileEditing ? undefined : (
                    <OnboardingFooter
                      error={error}
                      importSatisfied={importSatisfied}
                      isCheckingHandle={isCheckingHandle}
                      isFinishing={isFinishing}
                      notificationOutcome={notificationOutcome}
                      notificationSkipConfirmationVisible={notificationSkipConfirmationVisible}
                      notificationStatus={notificationStatus}
                      onBack={goBack}
                      onContinue={() => {
                        if (pageStep === 'profile') void continueProfile();
                        if (pageStep === 'import' && pendingImportTitleCount > 0) {
                          importDataRef.current?.requestPendingImport();
                        } else if (pageStep === 'import') {
                          continueImport();
                        }
                        if (pageStep === 'taste') continueTaste();
                      }}
                      onEnableNotifications={() => void allowNotifications()}
                      onFinishWithoutNotifications={() => void finishOnboarding()}
                      onRequestNotificationSkip={requestNotificationSkip}
                      pendingImportTitleCount={pendingImportTitleCount}
                      step={pageStep}
                      tasteSelectionCount={tasteItems.length}
                    />
                  )
                }
                nativeKeyboardInsetsOnly
                scrollViewRef={scrollViewRef}
                title=""
              >
                <View
                  style={[
                    styles.content,
                    pageStep === 'profile' || pageStep === 'import'
                      ? styles.profileScreenContent
                      : null,
                    pageStep === 'notifications' ? styles.notificationsScreenContent : null,
                  ]}
                >
                  <View
                    accessibilityLabel={`Step ${pageStepIndex + 1} of ${steps.length}`}
                    style={styles.progressTrack}
                  >
                    {steps.map((item, index) => (
                      <View
                        key={item}
                        style={[
                          styles.progressSegment,
                          index <= pageStepIndex ? styles.progressSegmentActive : null,
                        ]}
                      />
                    ))}
                  </View>

                  {pageStep === 'profile' ? (
                    <View style={styles.profileHeading}>
                      <Text style={styles.profileHeadingText}>Personalize your</Text>
                      <BrandWordmark height={32} />
                    </View>
                  ) : null}

                  {pageStep === 'import' ? (
                    <Text style={styles.importHeading}>Bring in your tastes</Text>
                  ) : null}

                  {pageStep === 'profile' ? (
                    <ProfileStep
                      avatarStatus={avatarStatus}
                      avatarUploadsEnabled={avatarUploadsEnabled}
                      avatarUrl={avatarPreviewUrl ?? avatarUrl}
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

                  {pageStep === 'import' ? (
                    <ImportDataScreen
                      embedded
                      onBackgroundImportStarted={() => {
                        setImportSatisfied(true);
                        setError(null);
                        moveToStep('notifications');
                      }}
                      onImportBatchCompleted={() => moveToStep('notifications')}
                      onImportCompleted={({ importId, result }) => {
                        if (result.titlesProcessed < 1) return;
                        setCompletedImportIds((current) =>
                          current.includes(importId) ? current : [...current, importId]
                        );
                        setImportSatisfied(true);
                        setError(null);
                      }}
                      onPendingImportChange={setPendingImportTitleCount}
                      ref={importDataRef}
                      workingSourcesOnly
                    />
                  ) : null}

                  {pageStep === 'taste' ? (
                    <TasteStep
                      onChange={(items) => {
                        setTasteItems(items);
                        setError(null);
                      }}
                      selected={tasteItems}
                    />
                  ) : null}

                  {pageStep === 'notifications' ? (
                    notificationSkipConfirmationVisible
                      ? <NotificationSkipConfirmation />
                      : (
                          <NotificationsStep
                            loading={notificationStatus === 'requesting' || isFinishing}
                            onEnable={() => void allowNotifications()}
                            outcome={notificationOutcome}
                            tasteItems={tasteItems}
                          />
                        )
                  ) : null}
                </View>
              </Screen>
            </View>
          );
        })}
      </Animated.View>
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
  notificationSkipConfirmationVisible,
  notificationStatus,
  onBack,
  onContinue,
  onEnableNotifications,
  onFinishWithoutNotifications,
  onRequestNotificationSkip,
  pendingImportTitleCount,
  step,
  tasteSelectionCount,
}: {
  error: string | null;
  importSatisfied: boolean;
  isCheckingHandle: boolean;
  isFinishing: boolean;
  notificationOutcome: ReleasePushSetupResult | null;
  notificationSkipConfirmationVisible: boolean;
  notificationStatus: 'idle' | 'requesting';
  onBack: () => void;
  onContinue: () => void;
  onEnableNotifications: () => void;
  onFinishWithoutNotifications: () => void;
  onRequestNotificationSkip: () => void;
  pendingImportTitleCount: number;
  step: OnboardingStep;
  tasteSelectionCount: number;
}) {
  const notificationBlocked = notificationOutcome?.status === 'denied'
    || notificationOutcome?.status === 'unavailable';

  return (
    <View style={styles.footer}>
      {error ? <Text accessibilityLiveRegion="polite" style={styles.errorText}>{error}</Text> : null}
      {step === 'notifications' ? (
        notificationSkipConfirmationVisible ? (
          <View style={styles.notificationConfirmationActions}>
            <Button
              disabled={notificationStatus === 'requesting' || isFinishing}
              fullWidth
              label="Enable notifications"
              onPress={onEnableNotifications}
            />
            <Button
              disabled={notificationStatus === 'requesting' || isFinishing}
              fullWidth
              label="Continue without notifications"
              loading={isFinishing}
              onPress={onFinishWithoutNotifications}
              variant="secondary"
            />
          </View>
        ) : (
          <View style={styles.actions}>
            <View style={styles.notificationsBackAction}>
              <Button
                disabled={notificationStatus === 'requesting' || isFinishing}
                fullWidth
                label="Back"
                onPress={onBack}
                variant="secondary"
              />
            </View>
            <View style={styles.notificationsSkipAction}>
              <Button
                disabled={notificationStatus === 'requesting' || isFinishing}
                fullWidth
                label={notificationBlocked ? 'Continue without' : 'Not now'}
                loading={isFinishing}
                onPress={notificationBlocked ? onFinishWithoutNotifications : onRequestNotificationSkip}
                variant="secondary"
              />
            </View>
          </View>
        )
      ) : (
        <View style={[styles.actions, step === 'profile' ? styles.profileActions : null]}>
          {step === 'import' || step === 'taste' ? (
            <>
              <View style={styles.importBackAction}>
                <Button fullWidth label="Back" onPress={onBack} variant="secondary" />
              </View>
              <View style={styles.importPrimaryAction}>
                <Button
                  disabled={step === 'taste' && tasteSelectionCount < 1}
                  fullWidth
                  label={step === 'import' && pendingImportTitleCount > 0
                    ? `Import ${pendingImportTitleCount} ${pendingImportTitleCount === 1 ? 'title' : 'titles'}`
                    : step === 'import' && !importSatisfied ? 'Skip' : 'Continue'}
                  onPress={onContinue}
                />
              </View>
            </>
          ) : (
            <>
              {step !== 'profile' ? (
                <Button label="Back" onPress={onBack} variant="secondary" />
              ) : null}
              <Button
                fullWidth={step === 'profile'}
                label="Continue"
                loading={step === 'profile' && isCheckingHandle}
                onPress={onContinue}
              />
            </>
          )}
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
  avatarStatus: 'idle' | 'saving' | 'saved';
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
    <View style={styles.profileContent}>
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
          {avatarStatus === 'saved' ? <Text style={styles.photoActionText}>Photo saved</Text> : null}
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
      helperText="Use 1-20 letters, numbers, or underscores. Your username is permanent."
      inputAccessoryViewID={inputAccessoryViewID}
      label="Username"
      maxLength={21}
      onBlur={onBlur}
      onChangeText={(value) => onChange(value.replace(/^@/, ''))}
      onFocus={onFocus}
      value={`@${handle}`}
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
  const { width: windowWidth } = useWindowDimensions();
  const [popularItems, setPopularItems] = useState<{
    movie: CatalogueSearchItem[];
    series: CatalogueSearchItem[];
  }>({ movie: [], series: [] });
  const [genreMovieItems, setGenreMovieItems] = useState<CatalogueSearchItem[] | null>(null);
  const [genrePickerOpen, setGenrePickerOpen] = useState(false);
  const [genreLoading, setGenreLoading] = useState(false);
  const [movieGenres, setMovieGenres] = useState<{ id: number; name: string }[]>([]);
  const [query, setQuery] = useState('');
  const [searchItems, setSearchItems] = useState<CatalogueSearchItem[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [selectedMovieGenreId, setSelectedMovieGenreId] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<'movie' | 'series'>('movie');
  const trimmedQuery = query.trim();
  const activeSelectionCount = getOnboardingTasteCount(selected, selectedType);
  const selectedMovieGenre = movieGenres?.find((genre) => genre.id === selectedMovieGenreId) ?? null;
  const tasteCardWidth = Math.floor(
    (windowWidth - spacing.xl * 2 - spacing.sm * 2) / 3,
  );

  useEffect(() => {
    let active = true;

    setOptionsLoading(true);
    setOptionsError(null);
    void getOnboardingTasteOptions()
      .then((response) => {
        if (!active) return;
        setMovieGenres(response.movieGenres ?? []);
        setPopularItems({ movie: response.movies, series: response.series });
      })
      .catch((caughtError) => {
        if (!active) return;
        setOptionsError(
          caughtError instanceof Error ? caughtError.message : 'Could not load TMDB titles.',
        );
      })
      .finally(() => {
        if (active) setOptionsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (selectedMovieGenreId === null) {
      setGenreMovieItems(null);
      setGenreLoading(false);
      return;
    }

    let active = true;
    setGenreLoading(true);
    setOptionsError(null);

    void getOnboardingTasteOptions(selectedMovieGenreId)
      .then((response) => {
        if (!active) return;
        setGenreMovieItems(response.movies);
      })
      .catch((caughtError) => {
        if (!active) return;
        setOptionsError(
          caughtError instanceof Error ? caughtError.message : 'Could not load this genre.',
        );
        setSelectedMovieGenreId(null);
      })
      .finally(() => {
        if (active) setGenreLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedMovieGenreId]);

  useEffect(() => {
    if (trimmedQuery.length < 2) {
      setSearchItems([]);
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
          if (!active) return;
          setSearchItems(response.items.filter((item) =>
            item.mediaType === selectedType
            && (!item.releaseDate || item.releaseDate <= new Date().toISOString().slice(0, 10))
          ));
        })
        .catch((caughtError) => {
          if (!active) return;
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

  const activePopularItems = selectedType === 'movie' && genreMovieItems
    ? genreMovieItems
    : popularItems[selectedType];
  const visibleItems = trimmedQuery.length >= 2
    ? searchItems
    : trimmedQuery.length === 1
      ? activePopularItems.filter((item) =>
          item.title.toLowerCase().includes(trimmedQuery.toLowerCase())
        )
      : activePopularItems;

  function chooseMovieGenre(genreId: number | null) {
    setGenrePickerOpen(false);
    setQuery('');
    setSearchItems([]);
    setSearchError(null);
    setSelectionError(null);
    setSelectedMovieGenreId(genreId);
  }

  function toggle(item: CatalogueSearchItem) {
    const existing = selected.some((selectedItem) =>
      selectedItem.contentType === item.mediaType && selectedItem.tmdbId === item.tmdbId
    );

    if (existing) {
      onChange(selected.filter((selectedItem) =>
        selectedItem.contentType !== item.mediaType || selectedItem.tmdbId !== item.tmdbId
      ));
      setSelectionError(null);
      return;
    }

    if (!canAddOnboardingTasteItem(selected, item.mediaType)) {
      setSelectionError(
        `You can choose up to ${ONBOARDING_TASTE_LIMIT_PER_TYPE} ${
          item.mediaType === 'movie' ? 'movies' : 'TV shows'
        }.`,
      );
      return;
    }

    setSelectionError(null);
    onChange([...selected, {
      contentType: item.mediaType,
      posterUrl: item.posterUrl,
      title: item.title,
      tmdbId: item.tmdbId,
    }]);
  }

  return (
    <View style={styles.tasteContent}>
      <View style={styles.tasteHeadingRow}>
        <Text style={styles.tasteHeading}>Show us your taste</Text>
        <Text style={styles.tasteCounter}>
          {activeSelectionCount}/{ONBOARDING_TASTE_LIMIT_PER_TYPE}
        </Text>
      </View>

      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        label="Search"
        onChangeText={(value) => {
          if (value.trim()) {
            setSelectedMovieGenreId(null);
          }
          setQuery(value);
        }}
        placeholder={selectedType === 'movie' ? 'Search movies' : 'Search TV shows'}
        returnKeyType="search"
        value={query}
      />

      <View style={styles.filters}>
        {tasteMediaOptions.map((option) => {
          const active = selectedType === option.value;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              key={option.value}
              onPress={() => {
                setSelectedType(option.value);
                setQuery('');
                setSearchItems([]);
                setSearchError(null);
                setSelectionError(null);
              }}
              style={({ pressed }) => [
                styles.filter,
                active ? styles.filterSelected : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <Text style={[styles.filterLabel, active ? styles.filterLabelSelected : null]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selectedType === 'movie' ? (
        <Pressable
          accessibilityLabel="Choose movie genre"
          accessibilityRole="button"
          accessibilityState={{ expanded: genrePickerOpen }}
          onPress={() => setGenrePickerOpen(true)}
          style={({ pressed }) => [styles.genreTrigger, pressed ? styles.pressed : null]}
        >
          <Text numberOfLines={1} style={styles.genreTriggerText}>
            {selectedMovieGenre?.name ?? 'All genres'}
          </Text>
          <View style={styles.genreTriggerRight}>
            {genreLoading ? <ActivityIndicator color={colors.accentText} size="small" /> : null}
            <ChevronDown color={colors.textMuted} size={20} strokeWidth={2.25} />
          </View>
        </Pressable>
      ) : null}

      {optionsLoading && popularItems[selectedType].length === 0 && trimmedQuery.length < 2
        ? <LoadingState label="Loading popular titles" />
        : null}
      {searchLoading && searchItems.length === 0 ? <LoadingState label="Searching TMDB" /> : null}
      {optionsError ? <Text style={styles.errorText}>{optionsError}</Text> : null}
      {searchError ? <Text style={styles.errorText}>{searchError}</Text> : null}
      {selectionError ? <Text style={styles.errorText}>{selectionError}</Text> : null}

      <View style={styles.tasteGrid}>
        {visibleItems.map((item) => (
          <TasteCard
            cardWidth={tasteCardWidth}
            item={item}
            key={item.id}
            onPress={() => toggle(item)}
            selected={selected.some((selectedItem) =>
              selectedItem.contentType === item.mediaType && selectedItem.tmdbId === item.tmdbId
            )}
          />
        ))}
      </View>

      <BottomActionSheet
        onClose={() => setGenrePickerOpen(false)}
        title="Movie genre"
        visible={genrePickerOpen}
      >
        <BottomActionSheetScrollView contentContainerStyle={styles.genreOptions}>
          {[{ id: null, name: 'All genres' }, ...movieGenres].map((genre) => {
            const active = selectedMovieGenreId === genre.id;
            return (
              <Pressable
                accessibilityLabel={`Select ${genre.name}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                key={genre.id ?? 'all'}
                onPress={() => chooseMovieGenre(genre.id)}
                style={({ pressed }) => [
                  styles.genreOption,
                  active ? styles.genreOptionSelected : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Text style={[styles.genreOptionText, active ? styles.genreOptionTextSelected : null]}>
                  {genre.name}
                </Text>
                {active ? <CheckCircle2 color={colors.success} size={20} strokeWidth={2.5} /> : null}
              </Pressable>
            );
          })}
        </BottomActionSheetScrollView>
      </BottomActionSheet>
    </View>
  );
}

function TasteCard({
  cardWidth,
  item,
  onPress,
  selected,
}: {
  cardWidth: number;
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
        styles.tasteCard,
        { width: cardWidth },
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={[styles.tastePosterFrame, { height: Math.round(cardWidth * 1.5) }]}>
        <MediaPoster posterUrl={item.posterUrl} style={styles.tastePoster} />
        {selected ? <View pointerEvents="none" style={styles.tasteSelectedOverlay} /> : null}
        {selected ? (
          <View pointerEvents="none" style={styles.tasteSelectedCheck}>
            <CheckCircle2 color={colors.success} size={19} strokeWidth={2.5} />
          </View>
        ) : null}
      </View>
      <Text numberOfLines={2} style={styles.tasteCardTitle}>{item.title}</Text>
    </Pressable>
  );
}

function NotificationsStep({
  loading,
  onEnable,
  outcome,
  tasteItems,
}: {
  loading: boolean;
  onEnable: () => void;
  outcome: ReleasePushSetupResult | null;
  tasteItems: OnboardingTasteItem[];
}) {
  const blocked = outcome?.status === 'denied' || outcome?.status === 'unavailable';
  const [cataloguePosterItems, setCataloguePosterItems] = useState<OnboardingTasteItem[]>([]);
  const tastePosterItems = tasteItems.filter((item) => item.posterUrl);
  const previewItems = [...tastePosterItems, ...cataloguePosterItems]
    .filter((item, index, items) => items.findIndex((candidate) =>
      candidate.contentType === item.contentType && candidate.tmdbId === item.tmdbId
    ) === index)
    .slice(0, notificationPreviews.length);

  useEffect(() => {
    if (tastePosterItems.length >= notificationPreviews.length) return;

    let active = true;
    void getOnboardingTasteOptions()
      .then((response) => {
        if (!active) return;
        setCataloguePosterItems(response.movies
          .filter((item) => item.posterUrl)
          .slice(0, notificationPreviews.length)
          .map((item) => ({
            contentType: item.mediaType,
            posterUrl: item.posterUrl,
            title: item.title,
            tmdbId: item.tmdbId,
          })));
      })
      .catch(() => {
        if (active) setCataloguePosterItems([]);
      });

    return () => {
      active = false;
    };
  }, [tastePosterItems.length]);

  return (
    <View style={styles.notificationsContent}>
      <Text style={styles.notificationsHeading}>Stay in the loop</Text>
      <Text style={styles.notificationsIntro}>
        Get releases, social activity, and every current and future Watchly update with one permission.
      </Text>

      <View style={styles.notificationPreviewList}>
        {notificationPreviews.map((preview, index) => (
          <NotificationPreview
            fallbackText={preview.fallbackText}
            item={previewItems[index]}
            key={preview.label}
            label={preview.label}
            titlePrefix={preview.titlePrefix}
          />
        ))}
      </View>

      {blocked ? (
        <View style={styles.warningPanel}>
          {outcome.status === 'denied' ? (
            <Text accessibilityLiveRegion="polite" style={styles.warningText}>
              You can enable notifications in iPhone Settings &gt; Notifications &gt; Watchly.
            </Text>
          ) : (
            <Text accessibilityLiveRegion="polite" style={styles.warningText}>{outcome.message}</Text>
          )}
          {outcome.status === 'denied' ? (
            <Button
              fullWidth
              label="Open Settings"
              onPress={() => void Linking.openSettings()}
              variant="secondary"
            />
          ) : null}
        </View>
      ) : null}

      <Pressable
        accessibilityLabel="Enable notifications"
        accessibilityRole="button"
        accessibilityState={{ busy: loading, disabled: loading }}
        disabled={loading}
        onPress={onEnable}
        style={({ pressed }) => [
          styles.notificationEnableAction,
          loading ? styles.notificationEnableActionDisabled : null,
          pressed && !loading ? styles.pressed : null,
        ]}
      >
        <View style={styles.notificationEnableIcon}>
          {loading
            ? <ActivityIndicator color={colors.textOnAccent} />
            : <BellRing color={colors.textOnAccent} size={26} strokeWidth={2.2} />}
        </View>
        <View style={styles.notificationEnableCopy}>
          <Text style={styles.notificationEnableLabel}>
            {loading ? 'Enabling notifications' : 'Enable notifications'}
          </Text>
          <Text style={styles.notificationEnableHint}>
            {loading ? 'Waiting for iPhone permission' : 'Tap to turn on Watchly alerts'}
          </Text>
        </View>
        <ChevronRight color={colors.textOnAccent} size={22} strokeWidth={2.4} />
      </Pressable>
    </View>
  );
}

function NotificationSkipConfirmation() {
  return (
    <View style={styles.notificationSkipConfirmation}>
      <View style={styles.notificationSkipConfirmationIcon}>
        <BellOff color={colors.accentText} size={34} strokeWidth={2.1} />
      </View>
      <Text accessibilityRole="header" style={styles.notificationSkipConfirmationHeading}>Are you sure?</Text>
      <Text style={styles.notificationSkipConfirmationCopy}>
        Without notifications, Watchly won&apos;t be able to alert you when movies and TV shows you follow are released.
      </Text>
      <Text style={styles.notificationSkipConfirmationHint}>
        You can turn notifications on later in Settings.
      </Text>
    </View>
  );
}

function NotificationPreview({
  fallbackText,
  item,
  label,
  titlePrefix,
}: {
  fallbackText: string;
  item: OnboardingTasteItem | undefined;
  label: string;
  titlePrefix: string;
}) {
  return (
    <View style={styles.notificationPreview}>
      {item?.posterUrl ? (
        <MediaPoster
          accessibilityLabel={`Artwork for ${item.title}`}
          posterUrl={item.posterUrl}
          style={styles.notificationPreviewImage}
        />
      ) : (
        <View style={styles.notificationPreviewImageFallback}>
          <ActivityIndicator color={colors.accentText} size="small" />
        </View>
      )}
      <View style={styles.notificationPreviewCopy}>
        <View style={styles.notificationPreviewMeta}>
          <Text style={styles.notificationPreviewLabel}>{label}</Text>
          <Text style={styles.notificationPreviewTime}>now</Text>
        </View>
        <Text numberOfLines={2} style={styles.notificationPreviewText}>
          {item ? `${titlePrefix} ${item.title}` : fallbackText}
        </Text>
      </View>
    </View>
  );
}

function normalizeDraftStep(draft: OnboardingDraft | null): OnboardingStep {
  if (!draft) return 'profile';
  if (draft.importSatisfied && draft.step === 'taste') return 'notifications';
  return steps.includes(draft.step) ? draft.step : 'profile';
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
  genreTrigger: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: touchTargets.min,
    paddingHorizontal: spacing.md,
  },
  genreTriggerRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  genreTriggerText: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  genreOption: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: touchTargets.min,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  genreOptionSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
  },
  genreOptionText: {
    color: colors.textMuted,
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  genreOptionTextSelected: {
    color: colors.accentText,
  },
  genreOptions: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  importHeading: {
    ...typography.title,
    color: colors.accentText,
  },
  importBackAction: {
    flex: 1,
  },
  importPrimaryAction: {
    flex: 2,
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
  notificationsBackAction: {
    flex: 1,
  },
  notificationsContent: {
    flexGrow: 1,
    gap: spacing.md,
  },
  notificationsHeading: {
    ...typography.title,
    color: colors.accentText,
  },
  notificationsIntro: {
    ...typography.body,
    color: colors.textMuted,
  },
  notificationsSkipAction: {
    flex: 2,
  },
  notificationsScreenContent: {
    flexGrow: 1,
  },
  notificationEnableAction: {
    ...shadows.raised,
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: 'auto',
    minHeight: 82,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  notificationEnableActionDisabled: {
    opacity: 0.58,
  },
  notificationEnableCopy: {
    flex: 1,
    gap: 2,
  },
  notificationEnableIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  notificationEnableHint: {
    ...typography.meta,
    color: colors.textOnAccent,
    opacity: 0.78,
  },
  notificationEnableLabel: {
    color: colors.textOnAccent,
    fontSize: 17,
    fontWeight: '800',
  },
  notificationConfirmationActions: {
    gap: spacing.sm,
  },
  notificationPreview: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 70,
    padding: spacing.sm,
  },
  notificationPreviewCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  notificationPreviewImage: {
    borderRadius: radii.md,
    height: 52,
    width: 52,
  },
  notificationPreviewImageFallback: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 52,
  },
  notificationPreviewLabel: {
    color: colors.accentText,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  notificationPreviewList: {
    gap: spacing.sm,
  },
  notificationPreviewMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  notificationPreviewText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  notificationPreviewTime: {
    color: colors.textSubtle,
    fontSize: 11,
    fontWeight: '600',
  },
  notificationSkipConfirmation: {
    alignItems: 'center',
    flexGrow: 1,
    gap: spacing.md,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  notificationSkipConfirmationCopy: {
    ...typography.body,
    color: colors.text,
    maxWidth: 340,
    textAlign: 'center',
  },
  notificationSkipConfirmationHeading: {
    ...typography.title,
    color: colors.accentText,
    textAlign: 'center',
  },
  notificationSkipConfirmationHint: {
    ...typography.meta,
    color: colors.textMuted,
    maxWidth: 300,
    textAlign: 'center',
  },
  notificationSkipConfirmationIcon: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderColor: colors.borderStrong,
    borderRadius: 38,
    borderWidth: 1,
    height: 76,
    justifyContent: 'center',
    width: 76,
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
  profileActions: {
    flexDirection: 'column',
  },
  profileContent: {
    gap: spacing.lg,
  },
  profileHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  profileHeadingText: {
    ...typography.title,
    color: colors.accentText,
  },
  profileScreenContent: {
    paddingTop: spacing.xl,
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
    backgroundColor: colors.background,
    flex: 1,
    overflow: 'hidden',
  },
  stepPage: {
    flexShrink: 0,
    height: '100%',
  },
  stepTrack: {
    flex: 1,
    flexDirection: 'row',
  },
  progressTrack: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
  },
  tasteCard: {
    gap: spacing.xs,
  },
  tasteCardTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  tasteContent: {
    gap: spacing.lg,
  },
  tasteCounter: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '800',
  },
  tasteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tasteHeading: {
    ...typography.title,
    color: colors.accentText,
  },
  tasteHeadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tastePoster: {
    height: '100%',
    width: '100%',
  },
  tastePosterFrame: {
    borderRadius: radii.md,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  tasteSelectedCheck: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.successBorder,
    borderRadius: 14,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.xs,
    top: spacing.xs,
    width: 28,
  },
  tasteSelectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 4, 8, 0.64)',
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
