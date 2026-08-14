import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { BellRing, Smartphone } from 'lucide-react-native';
import { Linking, StyleSheet, Switch, Text, View } from 'react-native';
import { getPushPreferences, PushPreferences, updatePushPreferences } from '../api/push';
import { useAuthSession } from '../auth/AuthSessionContext';
import { SignInRequiredCard } from '../auth/SignInRequired';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { LoadingState } from '../components/LoadingState';
import { Screen } from '../components/Screen';
import { colors, radii, spacing, touchTargets, typography } from '../design/tokens';
import { hapticError, hapticSuccess } from '../feedback/haptics';
import {
  disablePushFromSettings,
  enablePushFromSettings,
  getSystemPushPermission,
  SystemPushPermission,
} from './nativePushNotifications';

type ScreenStatus = 'error' | 'loading' | 'ready' | 'saving';

export function NotificationPreferencesScreen() {
  const { currentUser, firebaseIdToken, getFirebaseIdToken } = useAuthSession();
  const [message, setMessage] = useState<{ detail: string; tone: 'error' | 'success' } | null>(null);
  const [permission, setPermission] = useState<SystemPushPermission>('undetermined');
  const [preferences, setPreferences] = useState<PushPreferences | null>(null);
  const [status, setStatus] = useState<ScreenStatus>('loading');

  const load = useCallback(async () => {
    if (!firebaseIdToken) {
      setStatus('ready');
      return;
    }

    setStatus('loading');
    setMessage(null);
    try {
      const [loadedPreferences, loadedPermission] = await Promise.all([
        getPushPreferences(firebaseIdToken),
        getSystemPushPermission(),
      ]);
      setPreferences(loadedPreferences);
      setPermission(loadedPermission);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [firebaseIdToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setGlobalPushEnabled(enabled: boolean) {
    if (!currentUser?.id || status === 'saving') return;
    setStatus('saving');
    setMessage(null);

    try {
      const token = await getFirebaseIdToken();
      if (!token) throw new Error('Sign in again to update notification preferences.');

      if (!enabled) {
        const next = await disablePushFromSettings(token);
        setPreferences(next);
        setMessage({ detail: 'System notifications are off for this account.', tone: 'success' });
      } else {
        const result = await enablePushFromSettings(token, currentUser.id);
        const next = await getPushPreferences(token);
        setPreferences(next);
        setPermission(await getSystemPushPermission());

        if (result.status !== 'enabled') {
          setMessage({
            detail: result.message ?? 'System notifications could not be enabled.',
            tone: 'error',
          });
          hapticError();
          setStatus('ready');
          return;
        }
        setMessage({ detail: 'System notifications are ready on this device.', tone: 'success' });
      }

      hapticSuccess();
      setStatus('ready');
    } catch {
      setMessage({ detail: 'Could not update system notifications. Try again.', tone: 'error' });
      setStatus('ready');
      hapticError();
    }
  }

  async function setReleasePushEnabled(enabled: boolean) {
    if (!firebaseIdToken || !preferences?.pushEnabled || status === 'saving') return;
    const previous = preferences;
    setPreferences({ ...preferences, releasePushEnabled: enabled });
    setStatus('saving');
    setMessage(null);

    try {
      const next = await updatePushPreferences(firebaseIdToken, { releasePushEnabled: enabled });
      setPreferences(next);
      setStatus('ready');
      setMessage({
        detail: enabled ? 'Followed release pushes are on.' : 'Followed release pushes are off.',
        tone: 'success',
      });
      hapticSuccess();
    } catch {
      setPreferences(previous);
      setStatus('ready');
      setMessage({ detail: 'Could not update release notifications.', tone: 'error' });
      hapticError();
    }
  }

  if (!currentUser || !firebaseIdToken) {
    return (
      <Screen title="">
        <SignInRequiredCard
          body="Sign in to manage system notifications for your Watchly account."
          title="Sign in to manage notifications"
        />
      </Screen>
    );
  }

  if (status === 'loading' && !preferences) {
    return <Screen title=""><LoadingState label="Loading notification preferences" /></Screen>;
  }

  if (status === 'error' && !preferences) {
    return (
      <Screen title="">
        <EmptyState body="Watchly could not load your notification preferences." title="Preferences unavailable">
          <Button label="Retry" onPress={() => void load()} />
        </EmptyState>
      </Screen>
    );
  }

  const globalEnabled = Boolean(preferences?.pushEnabled && permission === 'granted');

  return (
    <Screen title="">
      <View style={styles.page}>
        <View style={styles.intro}>
          <Text style={styles.title}>System notifications</Text>
          <Text style={styles.body}>
            Choose which Watchly alerts can appear outside the app. In-app Alerts always remain available.
          </Text>
        </View>

        {message ? <InlineStatusBanner detail={message.detail} tone={message.tone} /> : null}

        <View style={styles.statusCard}>
          <View style={styles.iconShell}>
            <Smartphone color={colors.accentText} size={22} strokeWidth={2} />
          </View>
          <View style={styles.statusCopy}>
            <Text style={styles.statusTitle}>{getPermissionTitle(permission, globalEnabled)}</Text>
            <Text style={styles.statusBody}>{getPermissionBody(permission)}</Text>
          </View>
        </View>

        <View style={styles.group}>
          <PreferenceRow
            body="Master control for every Watchly system notification on this account."
            disabled={status === 'saving'}
            icon={<Smartphone color={colors.textMuted} size={20} strokeWidth={2} />}
            label="System notifications"
            onValueChange={(enabled) => void setGlobalPushEnabled(enabled)}
            value={globalEnabled}
          />
          <PreferenceRow
            body="Announcements, one-week reminders, and release-day alerts for active bells."
            disabled={!globalEnabled || status === 'saving'}
            icon={<BellRing color={globalEnabled ? colors.accentText : colors.textSubtle} size={20} strokeWidth={2} />}
            label="Followed releases"
            last
            onValueChange={(enabled) => void setReleasePushEnabled(enabled)}
            value={Boolean(globalEnabled && preferences?.releasePushEnabled)}
          />
        </View>

        {permission === 'denied' ? (
          <Button label="Open device settings" onPress={() => void Linking.openSettings()} variant="secondary" />
        ) : null}

        <Text style={styles.footnote}>
          Push tokens are isolated by Watchly environment. Turning this off does not remove your in-app release alerts.
        </Text>
      </View>
    </Screen>
  );
}

function PreferenceRow({
  body,
  disabled,
  icon,
  label,
  last = false,
  onValueChange,
  value,
}: {
  body: string;
  disabled: boolean;
  icon: ReactNode;
  label: string;
  last?: boolean;
  onValueChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <View style={[styles.row, last ? styles.rowLast : null]}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, disabled ? styles.disabledText : null]}>{label}</Text>
        <Text style={styles.rowBody}>{body}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityRole="switch"
        disabled={disabled}
        ios_backgroundColor={colors.panelElevated}
        onValueChange={onValueChange}
        thumbColor={colors.text}
        trackColor={{ false: colors.panelElevated, true: colors.accent }}
        value={value}
      />
    </View>
  );
}

function getPermissionTitle(permission: SystemPushPermission, enabled: boolean) {
  if (enabled) return 'Ready on this device';
  if (permission === 'denied') return 'Blocked by device settings';
  if (permission === 'unavailable') return 'Unavailable in this build';
  return 'Off';
}

function getPermissionBody(permission: SystemPushPermission) {
  if (permission === 'denied') return 'Watchly cannot show system alerts until device permission is enabled.';
  if (permission === 'unavailable') return 'Install a Watchly build that includes notification support.';
  if (permission === 'granted') return 'Device permission is granted. Use the controls below for this account.';
  return 'Watchly asks for permission only when you turn notifications on.';
}

const styles = StyleSheet.create({
  body: {
    ...typography.body,
    color: colors.textMuted,
  },
  disabledText: {
    color: colors.textSubtle,
  },
  footnote: {
    ...typography.meta,
    color: colors.textSubtle,
    paddingHorizontal: spacing.xs,
  },
  group: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  iconShell: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
    borderRadius: radii.md,
    borderWidth: 1,
    height: touchTargets.min,
    justifyContent: 'center',
    width: touchTargets.min,
  },
  intro: {
    gap: spacing.xs,
  },
  page: {
    gap: spacing.lg,
  },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 86,
    padding: spacing.md,
  },
  rowBody: {
    ...typography.meta,
    color: colors.textSubtle,
    marginTop: 2,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowIcon: {
    alignItems: 'center',
    height: touchTargets.min,
    justifyContent: 'center',
    width: touchTargets.min,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  statusBody: {
    ...typography.meta,
    color: colors.textSubtle,
    marginTop: 2,
  },
  statusCard: {
    alignItems: 'center',
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 76,
    padding: spacing.md,
  },
  statusCopy: {
    flex: 1,
    minWidth: 0,
  },
  statusTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
});
