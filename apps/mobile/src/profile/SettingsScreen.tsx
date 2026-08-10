import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Check,
  CheckCircle2,
  Camera,
  ChevronRight,
  Code2,
  Download,
  Eye,
  FileUp,
  FileText,
  Globe2,
  ListVideo,
  Lock,
  LogOut,
  Pencil,
  Scale,
  ShieldCheck,
  Trash2,
  User,
  Users,
} from 'lucide-react-native';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import {
  deleteAccount,
  exportAccountData,
  getProfile,
  PrivacyVisibility,
  ProfilePrivacy,
  removeAvatar,
  updatePrivacy,
  updateProfile,
} from '../api/profile';
import {
  listWatchlists,
  PersonalWatchlistSummary,
  updateWatchlistVisibility,
} from '../api/watchlists';
import { useAuthSession } from '../auth/AuthSessionContext';
import { SignInRequiredCard } from '../auth/SignInRequired';
import { BottomActionSheet, BottomActionSheetScrollView } from '../components/BottomActionSheet';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { Screen } from '../components/Screen';
import { TextInput } from '../components/TextInput';
import { UserAvatar } from '../components/UserAvatar';
import { colors, radii, shadows, spacing, touchTargets, typography } from '../design/tokens';
import { hapticError, hapticSuccess } from '../feedback/haptics';
import type { LegalDocumentId } from '../legal/legalDocuments';
import type { RootStackParamList } from '../navigation/types';
import appConfig from '../../app.json';
import { chooseAndUploadProfileAvatar } from './uploadProfileAvatar';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'error';
type AccountAction = 'delete' | 'export' | 'signOut' | null;
type SettingsNavigation = NativeStackNavigationProp<RootStackParamList>;
type SavedSettings = {
  displayName: string;
  privacy: ProfilePrivacy;
};

const defaultPrivacy: ProfilePrivacy = {
  episodeProgressVisibility: 'private',
  profileVisibility: 'private',
  ratingsVisibility: 'private',
  reviewsFollowProfileVisibility: true,
  sharedWatchlistVisibility: 'members',
  viewingHistoryVisibility: 'private',
};

export function SettingsScreen() {
  const navigation = useNavigation<SettingsNavigation>();
  const {
    currentUser,
    firebaseIdToken,
    notifySocialChanged,
    refreshCurrentUser,
    signOut,
    status: authStatus,
  } = useAuthSession();
  const [accountAction, setAccountAction] = useState<AccountAction>(null);
  const [avatarStatus, setAvatarStatus] = useState<'idle' | 'saving'>('idle');
  const [avatarUploadsEnabled, setAvatarUploadsEnabled] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'success' } | null>(null);
  const [personalWatchlists, setPersonalWatchlists] = useState<PersonalWatchlistSummary[]>([]);
  const [privacy, setPrivacy] = useState<ProfilePrivacy>(defaultPrivacy);
  const [savedWatchlistVisibilities, setSavedWatchlistVisibilities] = useState<Record<string, PrivacyVisibility>>({});
  const [savedSettings, setSavedSettings] = useState<SavedSettings | null>(null);
  const [status, setStatus] = useState<LoadStatus>('idle');
  const [watchlistLoadAttempt, setWatchlistLoadAttempt] = useState(0);
  const [watchlistsStatus, setWatchlistsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  useEffect(() => {
    let isMounted = true;

    if (!firebaseIdToken) {
      setSavedSettings(null);
      setStatus('idle');
      return;
    }

    setStatus('loading');
    setMessage(null);

    void getProfile(firebaseIdToken)
      .then((profile) => {
        if (!isMounted) return;

        const nextSettings = {
          displayName: profile.displayName ?? '',
          privacy: profile.privacy,
        };
        setAvatarUploadsEnabled(profile.avatarUploadsEnabled);
        setAvatarUrl(profile.avatarUrl);
        setDisplayName(nextSettings.displayName);
        setHandle(profile.handle);
        setPrivacy(nextSettings.privacy);
        setSavedSettings(nextSettings);
        setStatus('ready');
      })
      .catch(() => {
        if (!isMounted) return;

        setStatus('error');
        setMessage({ text: 'Could not load your settings.', tone: 'error' });
      });

    return () => {
      isMounted = false;
    };
  }, [firebaseIdToken, loadAttempt]);

  useEffect(() => {
    let isMounted = true;

    if (!firebaseIdToken) {
      setPersonalWatchlists([]);
      setSavedWatchlistVisibilities({});
      setWatchlistsStatus('idle');
      return;
    }

    setWatchlistsStatus('loading');

    void listWatchlists(firebaseIdToken)
      .then(({ items }) => {
        if (!isMounted) return;

        setPersonalWatchlists(items);
        setSavedWatchlistVisibilities(toWatchlistVisibilities(items));
        setWatchlistsStatus('ready');
      })
      .catch(() => {
        if (!isMounted) return;

        setWatchlistsStatus('error');
      });

    return () => {
      isMounted = false;
    };
  }, [firebaseIdToken, watchlistLoadAttempt]);

  const isDirty = useMemo(() => {
    if (!savedSettings) return false;

    const watchlistsChanged = personalWatchlists.some(
      (watchlist) => savedWatchlistVisibilities[watchlist.id] !== watchlist.visibility,
    );

    return (
      displayName.trim() !== savedSettings.displayName ||
      JSON.stringify(privacy) !== JSON.stringify(savedSettings.privacy) ||
      watchlistsChanged
    );
  }, [displayName, personalWatchlists, privacy, savedSettings, savedWatchlistVisibilities]);

  async function saveSettings() {
    if (!firebaseIdToken || !isDirty || status === 'saving') return;

    setStatus('saving');
    setMessage(null);

    try {
      const trimmedDisplayName = displayName.trim();
      const changedWatchlists = personalWatchlists.filter(
        (watchlist) => savedWatchlistVisibilities[watchlist.id] !== watchlist.visibility,
      );
      const [savedProfile, savedPrivacy, savedWatchlists] = await Promise.all([
        updateProfile(firebaseIdToken, {
          displayName: trimmedDisplayName.length > 0 ? trimmedDisplayName : null,
        }),
        updatePrivacy(firebaseIdToken, {
          profileVisibility: privacy.profileVisibility,
        }),
        Promise.all(changedWatchlists.map((watchlist) =>
          updateWatchlistVisibility(firebaseIdToken, watchlist.id, watchlist.visibility),
        )),
      ]);

      const nextSettings = {
        displayName: savedProfile.displayName ?? '',
        privacy: savedPrivacy.privacy,
      };
      setDisplayName(nextSettings.displayName);
      setPrivacy(nextSettings.privacy);
      setSavedSettings(nextSettings);
      const nextPersonalWatchlists = personalWatchlists.map((watchlist) =>
        savedWatchlists.find((saved) => saved.id === watchlist.id) ?? watchlist
      );
      setPersonalWatchlists(nextPersonalWatchlists);
      setSavedWatchlistVisibilities(toWatchlistVisibilities(nextPersonalWatchlists));
      await refreshCurrentUser();
      setStatus('ready');
      setMessage({ text: 'Your changes are saved.', tone: 'success' });
      hapticSuccess();
    } catch {
      setStatus('error');
      setMessage({ text: 'Could not save your changes. Try again.', tone: 'error' });
      hapticError();
    }
  }

  async function shareAccountExport() {
    if (!firebaseIdToken || accountAction) return;

    setAccountAction('export');
    setMessage(null);
    try {
      const accountData = await exportAccountData(firebaseIdToken);
      await Share.share({
        message: JSON.stringify(accountData, null, 2),
        title: 'Watchly data export',
      });
      setMessage({ text: 'Your data export is ready.', tone: 'success' });
      hapticSuccess();
    } catch {
      setMessage({ text: 'Could not create your data export.', tone: 'error' });
      hapticError();
    } finally {
      setAccountAction(null);
    }
  }

  async function changeAvatar() {
    if (!firebaseIdToken || avatarStatus === 'saving' || !avatarUploadsEnabled) return;

    setAvatarStatus('saving');
    setMessage(null);
    try {
      const profile = await chooseAndUploadProfileAvatar(firebaseIdToken);
      if (!profile) return;

      setAvatarUrl(profile.avatarUrl);
      notifySocialChanged();
      setMessage({ text: 'Your profile photo is updated.', tone: 'success' });
      hapticSuccess();
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Could not update your profile photo.',
        tone: 'error',
      });
      hapticError();
    } finally {
      setAvatarStatus('idle');
    }
  }

  async function deleteAvatar() {
    if (!firebaseIdToken || avatarStatus === 'saving') return;

    setAvatarStatus('saving');
    setMessage(null);
    try {
      const profile = await removeAvatar(firebaseIdToken);
      setAvatarUrl(profile.avatarUrl);
      notifySocialChanged();
      setMessage({ text: 'Your profile photo was removed.', tone: 'success' });
      hapticSuccess();
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Could not remove your profile photo.',
        tone: 'error',
      });
      hapticError();
    } finally {
      setAvatarStatus('idle');
    }
  }

  async function confirmDeleteAccount() {
    if (!firebaseIdToken || accountAction) return;

    setAccountAction('delete');
    setMessage(null);
    try {
      await deleteAccount(firebaseIdToken);
      setIsDeleteOpen(false);
      await signOut();
      hapticSuccess();
      if (navigation.canGoBack()) navigation.goBack();
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'Could not delete your account.',
        tone: 'error',
      });
      hapticError();
    } finally {
      setAccountAction(null);
    }
  }

  function requestSignOut() {
    if (accountAction) return;

    Alert.alert(
      'Sign out of Watchly?',
      'Your private data stays in your account and will be available when you sign in again.',
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => void performSignOut(),
          style: 'destructive',
          text: 'Sign out',
        },
      ],
    );
  }

  async function performSignOut() {
    setAccountAction('signOut');
    try {
      await signOut();
      if (navigation.canGoBack()) navigation.goBack();
    } finally {
      setAccountAction(null);
    }
  }

  const openLegalDocument = (document: LegalDocumentId) => {
    navigation.navigate('LegalDocument', { document });
  };

  const toggleProfileVisibility = () => {
    setPrivacy((current) => {
      const visibility = current.profileVisibility === 'public' ? 'private' : 'public';

      return {
        ...current,
        episodeProgressVisibility: visibility,
        profileVisibility: visibility,
        ratingsVisibility: visibility,
        viewingHistoryVisibility: visibility,
      };
    });
    setMessage(null);
  };

  const toggleWatchlistVisibility = (watchlistId: string) => {
    setPersonalWatchlists((current) => current.map((watchlist) =>
      watchlist.id === watchlistId
        ? { ...watchlist, visibility: watchlist.visibility === 'public' ? 'private' : 'public' }
        : watchlist
    ));
    setMessage(null);
  };

  if (!firebaseIdToken) {
    return (
      <Screen title="">
        <View style={styles.signedOutPage}>
          {authStatus === 'loading' ? (
            <LoadingState label="Restoring your account" />
          ) : (
            <SignInRequiredCard
              body="Sign in here to manage your profile, privacy, data, and account."
              title="Your settings, in one place"
            />
          )}
          <LegalSection onOpen={openLegalDocument} />
        </View>
      </Screen>
    );
  }

  if (status === 'loading' && !savedSettings) {
    return (
      <Screen title="">
        <LoadingState label="Loading your settings" />
      </Screen>
    );
  }

  if (status === 'error' && !savedSettings) {
    return (
      <Screen title="">
        <EmptyState
          body="Your account is still safe. Check the connection and try once more."
          title="Settings unavailable"
        >
          <Button label="Try again" onPress={() => setLoadAttempt((attempt) => attempt + 1)} />
        </EmptyState>
        <LegalSection onOpen={openLegalDocument} />
      </Screen>
    );
  }

  return (
    <>
      <Screen
        footer={isDirty || status === 'saving' ? (
          <Button
            fullWidth
            label="Save changes"
            loading={status === 'saving'}
            onPress={saveSettings}
          />
        ) : undefined}
        title=""
      >
        <View style={styles.page}>
          <ProfileEditor
            avatarUploadsEnabled={avatarUploadsEnabled}
            avatarUrl={avatarUrl}
            displayName={displayName || currentUser?.displayName || 'Watchly member'}
            editing={isEditingProfile}
            handle={handle ?? currentUser?.handle ?? null}
            isAvatarSaving={avatarStatus === 'saving'}
            onChangeAvatar={() => void changeAvatar()}
            onChangeText={(value) => {
              setDisplayName(value);
              setMessage(null);
            }}
            onRemoveAvatar={() => void deleteAvatar()}
            onToggleEditing={() => setIsEditingProfile((current) => !current)}
            provider={currentUser?.provider}
            value={displayName}
          />

          {message ? <SettingsMessage message={message} /> : null}

          <SettingsSection
            subtitle="One choice controls everything people can see on your profile."
            title="Privacy"
          >
            <PrivacyPanel privacy={privacy}>
              <PrivacyPreferenceRow
                body="Includes your profile, reviews, ratings, history, and episode progress."
                icon={Eye}
                label="Profile visibility"
                last
                onPress={toggleProfileVisibility}
                value={privacy.profileVisibility}
              />
            </PrivacyPanel>
          </SettingsSection>

          <SettingsSection
            subtitle="Choose which personal lists appear on your profile."
            title="Watchlists"
          >
            <View style={styles.group}>
              {watchlistsStatus === 'loading' ? (
                <View style={styles.compactState}>
                  <Text style={styles.compactStateTitle}>Loading your personal watchlists</Text>
                </View>
              ) : null}
              {watchlistsStatus === 'error' ? (
                <View style={styles.compactState}>
                  <Text style={styles.compactStateTitle}>Could not load your watchlists</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setWatchlistLoadAttempt((attempt) => attempt + 1)}
                    style={({ pressed }) => [styles.inlineRetry, pressed ? styles.pressed : null]}
                  >
                    <Text style={styles.inlineRetryLabel}>Try again</Text>
                  </Pressable>
                </View>
              ) : null}
              {watchlistsStatus === 'ready' && personalWatchlists.length === 0 ? (
                <View style={styles.compactState}>
                  <Text style={styles.compactStateTitle}>No personal watchlists yet</Text>
                  <Text style={styles.compactStateBody}>Create one from Library, then choose its visibility here.</Text>
                </View>
              ) : null}
              {watchlistsStatus === 'ready' ? personalWatchlists.map((watchlist, index) => (
                <WatchlistVisibilityRow
                  key={watchlist.id}
                  last={index === personalWatchlists.length - 1}
                  onPress={() => toggleWatchlistVisibility(watchlist.id)}
                  watchlist={watchlist}
                />
              )) : null}
            </View>
            <View style={styles.sharedWatchlistNote}>
              <Users color={colors.textSubtle} size={17} strokeWidth={2} />
              <Text style={styles.sharedWatchlistNoteText}>
                Shared watchlists always stay private to their members.
              </Text>
            </View>
          </SettingsSection>

          <SettingsSection
            subtitle="Bring your history in, take a copy with you, or remove your account."
            title="Your data"
          >
            <View style={styles.group}>
              <SettingsActionRow
                body="Bring ratings, reviews, and viewing history from other services."
                icon={FileUp}
                label="Import your data"
                onPress={() => navigation.navigate('ImportData')}
              />
              <SettingsActionRow
                body="Create a portable JSON copy to save or share."
                icon={Download}
                label="Export my data"
                loading={accountAction === 'export'}
                onPress={() => void shareAccountExport()}
              />
              <SettingsActionRow
                body="Remove your profile, activity, lists, and sign-in account."
                danger
                icon={Trash2}
                last
                label="Delete my account"
                onPress={() => setIsDeleteOpen(true)}
              />
            </View>
          </SettingsSection>

          <LegalSection onOpen={openLegalDocument} />

          <Pressable
            accessibilityRole="button"
            disabled={accountAction !== null}
            onPress={requestSignOut}
            style={({ pressed }) => [styles.signOut, pressed ? styles.pressed : null]}
          >
            <LogOut color={colors.textMuted} size={20} strokeWidth={2} />
            <Text style={styles.signOutLabel}>
              {accountAction === 'signOut' ? 'Signing out' : 'Sign out'}
            </Text>
          </Pressable>
        </View>
      </Screen>

      <BottomActionSheet
        footer={(
          <View style={styles.deleteActions}>
            <Button
              fullWidth
              label="Delete my account"
              loading={accountAction === 'delete'}
              onPress={() => void confirmDeleteAccount()}
              variant="danger"
            />
            <Button
              disabled={accountAction === 'delete'}
              fullWidth
              label="Keep my account"
              onPress={() => setIsDeleteOpen(false)}
              variant="ghost"
            />
          </View>
        )}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete account"
        visible={isDeleteOpen}
      >
        <BottomActionSheetScrollView contentContainerStyle={styles.deleteContent}>
          <View style={styles.deleteIcon}>
            <Trash2 color={colors.danger} size={25} strokeWidth={2} />
          </View>
          <Text style={styles.deleteTitle}>This cannot be undone.</Text>
          <Text style={styles.deleteBody}>
            Watchly will permanently remove your profile, viewing activity, ratings, reviews,
            follows, personal lists, and shared lists you own. Other members will lose access to
            shared lists that you created.
          </Text>
        </BottomActionSheetScrollView>
      </BottomActionSheet>

    </>
  );
}

function ProfileEditor({
  avatarUploadsEnabled,
  avatarUrl,
  displayName,
  editing,
  handle,
  isAvatarSaving,
  onChangeAvatar,
  onChangeText,
  onRemoveAvatar,
  onToggleEditing,
  provider,
  value,
}: {
  avatarUploadsEnabled: boolean;
  avatarUrl: string | null;
  displayName: string;
  editing: boolean;
  handle: string | null;
  isAvatarSaving: boolean;
  onChangeAvatar: () => void;
  onChangeText: (value: string) => void;
  onRemoveAvatar: () => void;
  onToggleEditing: () => void;
  provider?: string;
  value: string;
}) {
  const openAvatarActions = () => {
    if (!avatarUploadsEnabled || isAvatarSaving) return;

    if (!avatarUrl) {
      onChangeAvatar();
      return;
    }

    Alert.alert('Profile photo', 'Choose a new photo or return to your initials.', [
      { onPress: onChangeAvatar, text: 'Choose a new photo' },
      { onPress: onRemoveAvatar, style: 'destructive', text: 'Remove photo' },
      { style: 'cancel', text: 'Cancel' },
    ]);
  };

  return (
    <View style={styles.profileCard}>
      <View style={styles.profileHeader}>
        <Pressable
          accessibilityHint={avatarUploadsEnabled ? 'Opens your photo library.' : undefined}
          accessibilityLabel={avatarUrl ? 'Change profile photo' : 'Add profile photo'}
          accessibilityRole={avatarUploadsEnabled ? 'button' : undefined}
          disabled={!avatarUploadsEnabled || isAvatarSaving}
          onPress={openAvatarActions}
          style={({ pressed }) => [styles.avatarButton, pressed ? styles.pressed : null]}
        >
          <UserAvatar avatarUrl={avatarUrl} displayName={displayName} size={64} />
          {isAvatarSaving ? (
            <View style={styles.avatarLoading}>
              <ActivityIndicator color={colors.text} size="small" />
            </View>
          ) : avatarUploadsEnabled ? (
            <View style={styles.avatarBadge}>
              <Camera color={colors.text} size={14} strokeWidth={2.3} />
            </View>
          ) : null}
        </Pressable>
        <View style={styles.profileCopy}>
          <Text style={styles.profileEyebrow}>Profile</Text>
          <Text numberOfLines={2} style={styles.profileName}>{displayName}</Text>
          {handle ? <Text style={styles.profileHandle}>@{handle}</Text> : null}
          <Text style={styles.profileProvider}>{getProviderLabel(provider)}</Text>
        </View>
        <Pressable
          accessibilityLabel={editing ? 'Finish editing profile' : 'Edit profile name'}
          accessibilityRole="button"
          onPress={onToggleEditing}
          style={({ pressed }) => [styles.editButton, pressed ? styles.pressed : null]}
        >
          {editing ? (
            <Check color={colors.accentText} size={17} strokeWidth={2.3} />
          ) : (
            <Pencil color={colors.accentText} size={16} strokeWidth={2.2} />
          )}
          <Text style={styles.editButtonLabel}>{editing ? 'Done' : 'Edit'}</Text>
        </Pressable>
      </View>

      {editing ? (
        <View style={styles.profileEditor}>
          <TextInput
            autoCapitalize="words"
            autoFocus
            helperText="This name appears on your profile, reviews, and shared activity."
            label="Display name"
            onChangeText={onChangeText}
            placeholder="Watchly member"
            value={value}
          />
          {handle ? (
            <View style={styles.immutableHandle}>
              <Lock color={colors.textSubtle} size={15} strokeWidth={2} />
              <Text style={styles.immutableHandleText}>@{handle} is your permanent handle.</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.profileHint}>
          <User color={colors.textSubtle} size={17} strokeWidth={2} />
          <Text style={styles.profileHintText}>
            This is how other members recognize you across Watchly.
          </Text>
        </View>
      )}
    </View>
  );
}

function SettingsSection({
  children,
  subtitle,
  title,
}: {
  children: ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
      {children}
    </View>
  );
}

type PrivacyPreferenceRowProps = {
  body: string;
  icon: typeof Eye;
  label: string;
  last?: boolean;
  onPress: () => void;
  value: PrivacyVisibility;
};

function PrivacyPanel({ children, privacy }: { children: ReactNode; privacy: ProfilePrivacy }) {
  const isPublic = privacy.profileVisibility === 'public';

  return (
    <View style={styles.privacyPanel}>
      <View style={styles.privacyOverview}>
        <View style={styles.privacyOverviewIcon}>
          <ShieldCheck color={colors.accentText} size={22} strokeWidth={2} />
        </View>
        <View style={styles.privacyOverviewCopy}>
          <Text style={styles.privacyOverviewTitle}>
            {isPublic ? 'Your profile is visible' : 'Your profile is private'}
          </Text>
          <Text style={styles.privacyOverviewBody}>
            {isPublic ? 'Members can discover your activity.' : 'Only you can see your activity.'}
          </Text>
        </View>
      </View>
      {children}
    </View>
  );
}

function PrivacyPreferenceRow({
  body,
  icon: Icon,
  label,
  last = false,
  onPress,
  value,
}: PrivacyPreferenceRowProps) {
  const publicValue = value === 'public';
  const valueLabel = publicValue ? 'Everyone' : 'Only me';
  const nextValueLabel = publicValue ? 'Only me' : 'Everyone';

  return (
    <Pressable
      accessibilityHint={`Current choice: ${valueLabel}. Double tap to switch to ${nextValueLabel}.`}
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.privacyPreference,
        last ? styles.privacyPreferenceLast : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.rowIcon}>
        <Icon color={colors.textMuted} size={19} strokeWidth={2} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{label}</Text>
        <Text style={styles.rowBody}>{body}</Text>
      </View>
      <VisibilityPill value={value} />
    </Pressable>
  );
}

function WatchlistVisibilityRow({
  last,
  onPress,
  watchlist,
}: {
  last: boolean;
  onPress: () => void;
  watchlist: PersonalWatchlistSummary;
}) {
  const nextValueLabel = watchlist.visibility === 'public' ? 'Only me' : 'Everyone';
  const itemLabel = watchlist.itemCount === 1 ? '1 title' : `${watchlist.itemCount} titles`;

  return (
    <Pressable
      accessibilityHint={`Current choice: ${watchlist.visibility === 'public' ? 'Everyone' : 'Only me'}. Double tap to switch to ${nextValueLabel}.`}
      accessibilityLabel={`${watchlist.name} visibility`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.privacyPreference,
        last ? styles.privacyPreferenceLast : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.rowIcon}>
        <ListVideo color={colors.textMuted} size={19} strokeWidth={2} />
      </View>
      <View style={styles.rowCopy}>
        <Text numberOfLines={1} style={styles.rowTitle}>{watchlist.name}</Text>
        <Text style={styles.rowBody}>{itemLabel}</Text>
      </View>
      <VisibilityPill value={watchlist.visibility} />
    </Pressable>
  );
}

function VisibilityPill({ value }: { value: PrivacyVisibility }) {
  const publicValue = value === 'public';
  const Icon = publicValue ? Globe2 : Lock;

  return (
    <View style={[styles.visibilityPill, publicValue ? styles.visibilityPillPublic : null]}>
      <Icon
        color={publicValue ? colors.accentText : colors.textMuted}
        size={14}
        strokeWidth={2.2}
      />
      <Text style={[styles.visibilityPillText, publicValue ? styles.visibilityPillTextPublic : null]}>
        {publicValue ? 'Everyone' : 'Only me'}
      </Text>
    </View>
  );
}

function SettingsActionRow({
  body,
  danger = false,
  icon: Icon,
  label,
  last = false,
  loading = false,
  onPress,
}: {
  body: string;
  danger?: boolean;
  icon: typeof User;
  label: string;
  last?: boolean;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [styles.actionRow, last ? styles.lastRow : null, pressed ? styles.pressed : null]}
    >
      <View style={[styles.rowIcon, danger ? styles.dangerIcon : null]}>
        <Icon color={danger ? colors.danger : colors.textMuted} size={19} strokeWidth={2} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, danger ? styles.dangerText : null]}>
          {loading ? 'Preparing export' : label}
        </Text>
        <Text style={styles.rowBody}>{body}</Text>
      </View>
      <ChevronRight color={colors.textSubtle} size={20} strokeWidth={2} />
    </Pressable>
  );
}

function LegalSection({ onOpen }: { onOpen: (document: LegalDocumentId) => void }) {
  return (
    <SettingsSection
      subtitle="Plain-language policies, publisher details, and required credits."
      title="Legal and about"
    >
      <View style={styles.group}>
        <LegalRow icon={Lock} label="Privacy policy" onPress={() => onOpen('privacy')} />
        <LegalRow icon={FileText} label="Terms of use" onPress={() => onOpen('terms')} />
        <LegalRow icon={Scale} label="Legal notice" onPress={() => onOpen('legalNotice')} />
        <LegalRow icon={Code2} label="Licenses and credits" last onPress={() => onOpen('licenses')} />
      </View>
      <Text style={styles.version}>Watchly {appConfig.expo.version}</Text>
    </SettingsSection>
  );
}

function LegalRow({
  icon: Icon,
  label,
  last = false,
  onPress,
}: {
  icon: typeof ShieldCheck;
  label: string;
  last?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.legalRow, last ? styles.lastRow : null, pressed ? styles.pressed : null]}
    >
      <View style={styles.rowIcon}>
        <Icon color={colors.textMuted} size={19} strokeWidth={2} />
      </View>
      <Text style={styles.legalLabel}>{label}</Text>
      <ChevronRight color={colors.textSubtle} size={20} strokeWidth={2} />
    </Pressable>
  );
}

function SettingsMessage({
  message,
}: {
  message: { text: string; tone: 'error' | 'success' };
}) {
  const success = message.tone === 'success';

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.message, success ? styles.messageSuccess : styles.messageError]}
    >
      {success ? (
        <CheckCircle2 color={colors.success} size={19} strokeWidth={2} />
      ) : (
        <ShieldCheck color={colors.danger} size={19} strokeWidth={2} />
      )}
      <Text style={[styles.messageText, success ? styles.successText : styles.errorText]}>
        {message.text}
      </Text>
    </View>
  );
}

function getProviderLabel(provider?: string) {
  if (!provider) return 'Signed in';

  const label = provider.charAt(0) + provider.slice(1).toLowerCase();
  return `Signed in with ${label}`;
}

function toWatchlistVisibilities(watchlists: PersonalWatchlistSummary[]) {
  return Object.fromEntries(
    watchlists.map((watchlist) => [watchlist.id, watchlist.visibility]),
  ) as Record<string, PrivacyVisibility>;
}

const styles = StyleSheet.create({
  actionRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 78,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  avatarBadge: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderColor: colors.background,
    borderRadius: 13,
    borderWidth: 2,
    bottom: -2,
    height: 26,
    justifyContent: 'center',
    position: 'absolute',
    right: -3,
    width: 26,
  },
  avatarButton: {
    borderRadius: 32,
  },
  avatarLoading: {
    alignItems: 'center',
    backgroundColor: 'rgba(9, 12, 19, 0.68)',
    borderRadius: 32,
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  compactState: {
    alignItems: 'flex-start',
    gap: spacing.xs,
    minHeight: 76,
    padding: spacing.md,
  },
  compactStateBody: {
    ...typography.meta,
    color: colors.textSubtle,
    fontWeight: '500',
  },
  compactStateTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  dangerIcon: {
    backgroundColor: colors.dangerBackground,
    borderColor: colors.dangerBorder,
  },
  dangerText: {
    color: colors.danger,
  },
  deleteActions: {
    gap: spacing.sm,
  },
  deleteBody: {
    ...typography.body,
    color: colors.textMuted,
  },
  deleteContent: {
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  deleteIcon: {
    alignItems: 'center',
    backgroundColor: colors.dangerBackground,
    borderColor: colors.dangerBorder,
    borderRadius: radii.lg,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  deleteTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  editButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: touchTargets.min,
    paddingHorizontal: spacing.sm,
  },
  editButtonLabel: {
    color: colors.accentText,
    fontSize: 13,
    fontWeight: '800',
  },
  errorText: {
    color: colors.danger,
  },
  group: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  inlineRetry: {
    justifyContent: 'center',
    minHeight: touchTargets.min,
  },
  inlineRetryLabel: {
    color: colors.accentText,
    fontSize: 13,
    fontWeight: '800',
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  legalLabel: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  legalRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  message: {
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  messageError: {
    backgroundColor: colors.dangerBackground,
    borderColor: colors.dangerBorder,
  },
  messageSuccess: {
    backgroundColor: colors.successBackground,
    borderColor: colors.successBorder,
  },
  messageText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  page: {
    gap: spacing.xxxl,
    paddingBottom: spacing.lg,
    paddingTop: spacing.lg,
  },
  pressed: {
    opacity: 0.72,
  },
  privacyOverview: {
    alignItems: 'center',
    backgroundColor: colors.panelElevated,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  privacyOverviewBody: {
    ...typography.meta,
    color: colors.textSubtle,
    marginTop: 2,
  },
  privacyOverviewCopy: {
    flex: 1,
    minWidth: 0,
  },
  privacyOverviewIcon: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  privacyOverviewTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  privacyPanel: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  privacyPreference: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 76,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  privacyPreferenceLast: {
    borderBottomWidth: 0,
  },
  profileCard: {
    ...shadows.panel,
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
  },
  profileEditor: {
    backgroundColor: colors.panel,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
  },
  profileEyebrow: {
    ...typography.meta,
    color: colors.accentText,
    textTransform: 'uppercase',
  },
  profileHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  profileHint: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  profileHintText: {
    ...typography.meta,
    color: colors.textSubtle,
    flex: 1,
    fontWeight: '500',
  },
  immutableHandle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  immutableHandleText: {
    ...typography.meta,
    color: colors.textSubtle,
    flex: 1,
  },
  profileHandle: {
    ...typography.meta,
    color: colors.textMuted,
    marginTop: 2,
  },
  profileName: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 30,
    marginTop: 2,
  },
  profileProvider: {
    ...typography.meta,
    color: colors.textSubtle,
    marginTop: 2,
  },
  rowBody: {
    ...typography.meta,
    color: colors.textSubtle,
    fontWeight: '500',
    marginTop: 2,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowIcon: {
    alignItems: 'center',
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeading: {
    gap: spacing.xs,
  },
  sectionSubtitle: {
    ...typography.body,
    color: colors.textSubtle,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.3,
    lineHeight: 27,
  },
  sharedWatchlistNote: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  sharedWatchlistNoteText: {
    ...typography.meta,
    color: colors.textSubtle,
    flex: 1,
    fontWeight: '500',
  },
  signedOutPage: {
    gap: spacing.xxxl,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.lg,
  },
  signOut: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: touchTargets.min,
    paddingHorizontal: spacing.lg,
  },
  signOutLabel: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '700',
  },
  successText: {
    color: colors.success,
  },
  visibilityPill: {
    alignItems: 'center',
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.xs,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    minHeight: 30,
    minWidth: 82,
    paddingHorizontal: spacing.xs,
  },
  visibilityPillPublic: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
  },
  visibilityPillText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  visibilityPillTextPublic: {
    color: colors.accentText,
  },
  version: {
    ...typography.meta,
    color: colors.textSubtle,
    textAlign: 'center',
  },
});
