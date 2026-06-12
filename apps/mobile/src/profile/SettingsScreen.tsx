import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  getProfile,
  PrivacyVisibility,
  ProfilePrivacy,
  SharedWatchlistVisibility,
  updatePrivacy,
  updateProfile,
} from '../api/profile';
import { useAuthSession } from '../auth/AuthSessionContext';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Screen } from '../components/Screen';
import { TextInput } from '../components/TextInput';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'saving' | 'error';

const defaultPrivacy: ProfilePrivacy = {
  episodeProgressVisibility: 'private',
  profileVisibility: 'public',
  ratingsVisibility: 'private',
  reviewsFollowProfileVisibility: true,
  sharedWatchlistVisibility: 'members',
  viewingHistoryVisibility: 'private',
};

export function SettingsScreen() {
  const { firebaseIdToken, refreshCurrentUser, status: authStatus } = useAuthSession();
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [privacy, setPrivacy] = useState<ProfilePrivacy>(defaultPrivacy);
  const [status, setStatus] = useState<LoadStatus>('idle');

  useEffect(() => {
    let isMounted = true;

    if (!firebaseIdToken) {
      setStatus('idle');
      return;
    }

    setStatus('loading');
    setMessage(null);

    void getProfile(firebaseIdToken)
      .then((profile) => {
        if (!isMounted) {
          return;
        }

        setDisplayName(profile.displayName ?? '');
        setPrivacy(profile.privacy);
        setStatus('ready');
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setStatus('error');
        setMessage('Could not load profile settings.');
      });

    return () => {
      isMounted = false;
    };
  }, [firebaseIdToken]);

  async function saveSettings() {
    if (!firebaseIdToken || status === 'saving') {
      return;
    }

    setStatus('saving');
    setMessage(null);

    try {
      const trimmedDisplayName = displayName.trim();
      const savedProfile = await updateProfile(firebaseIdToken, {
        displayName: trimmedDisplayName.length > 0 ? trimmedDisplayName : null,
      });
      const savedPrivacy = await updatePrivacy(firebaseIdToken, {
        episodeProgressVisibility: privacy.episodeProgressVisibility,
        profileVisibility: privacy.profileVisibility,
        ratingsVisibility: privacy.ratingsVisibility,
        sharedWatchlistVisibility: privacy.sharedWatchlistVisibility,
        viewingHistoryVisibility: privacy.viewingHistoryVisibility,
      });

      setDisplayName(savedProfile.displayName ?? '');
      setPrivacy(savedPrivacy.privacy);
      await refreshCurrentUser();
      setStatus('ready');
      setMessage('Settings saved.');
    } catch {
      setStatus('error');
      setMessage('Could not save profile settings.');
    }
  }

  if (!firebaseIdToken && authStatus !== 'loading') {
    return (
      <Screen eyebrow="Account" title="Settings">
        <EmptyState body="Sign in from Profile before changing privacy controls." title="Account required" />
      </Screen>
    );
  }

  if (!firebaseIdToken && authStatus === 'loading') {
    return (
      <Screen eyebrow="Account" title="Settings">
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.rowBody}>Restoring account session.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboard}
    >
      <Screen eyebrow="Account" title="Settings">
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <TextInput
            autoCapitalize="words"
            helperText="Leave blank to show your account id instead."
            label="Display name"
            onChangeText={setDisplayName}
            value={displayName}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          <PrivacyRow
            body="Written reviews follow this same full-profile visibility."
            label="Profile"
            onChange={(value) => setPrivacy((current) => ({ ...current, profileVisibility: value }))}
            value={privacy.profileVisibility}
          />
          <PrivacyRow
            body="Your episode-by-episode watch history stays private by default."
            label="Viewing history"
            onChange={(value) => setPrivacy((current) => ({ ...current, viewingHistoryVisibility: value }))}
            value={privacy.viewingHistoryVisibility}
          />
          <PrivacyRow
            body="Progress powers continue-watching but should remain private unless you choose otherwise."
            label="Episode progress"
            onChange={(value) => setPrivacy((current) => ({ ...current, episodeProgressVisibility: value }))}
            value={privacy.episodeProgressVisibility}
          />
          <PrivacyRow
            body="Standalone ratings are not public feed events."
            label="Ratings"
            onChange={(value) => setPrivacy((current) => ({ ...current, ratingsVisibility: value }))}
            value={privacy.ratingsVisibility}
          />
          <SharedWatchlistRow
            onChange={(value) => setPrivacy((current) => ({ ...current, sharedWatchlistVisibility: value }))}
            value={privacy.sharedWatchlistVisibility}
          />
        </View>

        {message ? (
          <Text style={[styles.message, message.endsWith('saved.') ? styles.success : styles.error]}>
            {message}
          </Text>
        ) : null}

        <View style={styles.actions}>
          {status === 'loading' || status === 'saving' ? (
            <ActivityIndicator color={colors.accent} />
          ) : null}
          <Button
            disabled={!firebaseIdToken || status === 'loading' || status === 'saving'}
            label="Save settings"
            onPress={saveSettings}
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

type PrivacyRowProps = {
  body: string;
  label: string;
  onChange: (value: PrivacyVisibility) => void;
  value: PrivacyVisibility;
};

function PrivacyRow({ body, label, onChange, value }: PrivacyRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{label}</Text>
        <Text style={styles.rowBody}>{body}</Text>
      </View>
      <SegmentedValue
        options={[
          { label: 'Public', value: 'public' },
          { label: 'Private', value: 'private' },
        ]}
        onChange={onChange}
        value={value}
      />
    </View>
  );
}

type SharedWatchlistRowProps = {
  onChange: (value: SharedWatchlistVisibility) => void;
  value: SharedWatchlistVisibility;
};

function SharedWatchlistRow({ onChange, value }: SharedWatchlistRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>Shared watchlists</Text>
        <Text style={styles.rowBody}>Lists and votes stay member-only by default.</Text>
      </View>
      <SegmentedValue
        options={[
          { label: 'Members', value: 'members' },
          { label: 'Private', value: 'private' },
        ]}
        onChange={onChange}
        value={value}
      />
    </View>
  );
}

type SegmentedValueProps<T extends string> = {
  onChange: (value: T) => void;
  options: Array<{ label: string; value: T }>;
  value: T;
};

function SegmentedValue<T extends string>({ onChange, options, value }: SegmentedValueProps<T>) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              selected ? styles.segmentSelected : null,
              pressed ? styles.segmentPressed : null,
            ]}
          >
            <Text style={[styles.segmentLabel, selected ? styles.segmentLabelSelected : null]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  card: {
    ...shadows.panel,
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  error: {
    color: colors.danger,
  },
  keyboard: {
    flex: 1,
  },
  loadingState: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  message: {
    ...typography.body,
    fontWeight: '700',
  },
  row: {
    gap: spacing.md,
  },
  rowBody: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  rowCopy: {
    flex: 1,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
  },
  segment: {
    alignItems: 'center',
    borderRadius: radii.md,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: spacing.sm,
  },
  segmentLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
  },
  segmentLabelSelected: {
    color: colors.textOnAccent,
  },
  segmentPressed: {
    opacity: 0.82,
  },
  segmentSelected: {
    backgroundColor: colors.accent,
  },
  segmented: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
  },
  success: {
    color: colors.success,
  },
});
