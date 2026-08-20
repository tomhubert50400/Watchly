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
  BellRing,
  Camera,
  CheckCircle2,
  ChevronDown,
  Database,
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
    notifySocialChanged,
    notifyTrackingChanged,
    refreshCurrentUser,
  } = useAuthSession();
  const { width: windowWidth } = useWindowDimensions();
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
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState<boolean | null>(null);
  const [step, setStep] = useState<OnboardingStep>('profile');
  const [stepTransition, setStepTransition] = useState<OnboardingStepTransition | null>(null);
  const [tasteItems, setTasteItems] = useState<OnboardingTasteItem[]>([]);
  const copyAttempted = useRef(false);
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
    if (step === 'notifications') moveToStep(importSatisfied ? 'import' : 'taste');
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
                      notificationStatus={notificationStatus}
                      onAllowNotifications={() => void allowNotifications()}
                      onBack={goBack}
                      onContinue={() => {
                        if (pageStep === 'profile') void continueProfile();
                        if (pageStep === 'import') continueImport();
                        if (pageStep === 'taste') continueTaste();
                      }}
                      onFinishWithoutNotifications={() => void finishOnboarding()}
                      step={pageStep}
                      tasteSelectionCount={tasteItems.length}
                    />
                  )
                }
                nativeKeyboardInsetsOnly
                scrollViewRef={scrollViewRef}
                title={
                  pageStep === 'profile' || pageStep === 'import' || pageStep === 'taste'
                    ? ''
                    : getStepTitle(pageStep)
                }
              >
                <View
                  style={[
                    styles.content,
                    pageStep === 'profile' || pageStep === 'import'
                      ? styles.profileScreenContent
                      : null,
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

                  {pageStep !== 'profile' && pageStep !== 'import' && pageStep !== 'taste'
                    ? <StepHero step={pageStep} />
                    : null}

                  {pageStep === 'profile' ? (
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

                  {pageStep === 'import' ? (
                    <ImportDataScreen
                      embedded
                      onImportCompleted={({ importId, result }) => {
                        if (result.titlesProcessed < 1) return;
                        setCompletedImportIds((current) =>
                          current.includes(importId) ? current : [...current, importId]
                        );
                        setImportSatisfied(true);
                        setError(null);
                      }}
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
                    <NotificationsStep outcome={notificationOutcome} />
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
  notificationStatus,
  onAllowNotifications,
  onBack,
  onContinue,
  onFinishWithoutNotifications,
  step,
  tasteSelectionCount,
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
  tasteSelectionCount: number;
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
                  label={step === 'import' && !importSatisfied ? 'Skip' : 'Continue'}
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
      helperText="Use 3-20 letters, numbers, or underscores. Your username is permanent."
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
  if (step === 'import') return 'Bring in your tastes';
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
  settingsHint: {
    ...typography.meta,
    color: colors.textSubtle,
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
