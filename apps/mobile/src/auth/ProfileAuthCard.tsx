import { ReactNode, useEffect, useMemo, useState } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Eye, LogOut, UserCircle } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { ApiError } from '../api/client';
import { getDevTestProfile } from '../api/profile';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import { useAuthSession } from './AuthSessionContext';
import { getMissingFirebaseConfig } from './firebase';
import { authRedirectScheme, getMissingGoogleClientConfig, googleClientIds } from './googleAuthConfig';

WebBrowser.maybeCompleteAuthSession();

type AuthStatus = 'idle' | 'loading' | 'signedIn' | 'error';
type ProfileNavigation = NativeStackNavigationProp<RootStackParamList>;
type ProviderButtonVariant = 'apple' | 'discord' | 'facebook' | 'google' | 'microsoft';
type ProviderButtonTone = 'brandDark' | 'brandWhite';

const googleRequestClientIds = {
  androidClientId: googleClientIds.androidClientId ?? 'missing-android-client-id',
  iosClientId: googleClientIds.iosClientId ?? 'missing-ios-client-id',
  webClientId: googleClientIds.webClientId ?? 'missing-web-client-id',
};

export function ProfileAuthCard() {
  const navigation = useNavigation<ProfileNavigation>();
  const authSession = useAuthSession();
  const { currentUser, signInWithGoogle, signOut } = authSession;
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<AuthStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const missingConfig = useMemo(
    () => [...getMissingFirebaseConfig(), ...getMissingGoogleClientConfig()],
    [],
  );
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(
    {
      ...googleRequestClientIds,
      selectAccount: true,
    },
    {
      path: 'auth',
      scheme: authRedirectScheme,
    },
  );

  useEffect(() => {
    let isMounted = true;

    async function completeSignIn(googleIdToken: string) {
      setConnectingProvider('Google');
      setLocalStatus('loading');
      setMessage(null);

      try {
        await signInWithGoogle(googleIdToken);

        if (!isMounted) {
          return;
        }

        setLocalStatus('signedIn');
        setConnectingProvider(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        console.warn('Sign-in failed', getSafeErrorMessage(error));
        setConnectingProvider(null);
        setLocalStatus('error');
        setMessage(getAccountCheckErrorMessage(error));
      }
    }

    if (response?.type === 'success') {
      const googleIdToken = response.params.id_token;

      if (typeof googleIdToken === 'string' && googleIdToken.length > 0) {
        void completeSignIn(googleIdToken);
      } else {
        setLocalStatus('error');
        setMessage('Google did not return an ID token.');
      }
    }

    if (response?.type === 'error') {
      setLocalStatus('error');
      setMessage('Google sign-in was rejected.');
    }

    if (response && response.type !== 'success' && response.type !== 'error') {
      setConnectingProvider(null);
      setLocalStatus('idle');
    }

    return () => {
      isMounted = false;
    };
  }, [response, signInWithGoogle]);

  const status = authSession.status === 'loading' ? 'loading' : localStatus;
  const canSignIn = missingConfig.length === 0 && Boolean(request) && status !== 'loading';

  async function startSignIn() {
    if (!canSignIn) {
      return;
    }

    setConnectingProvider('Google');
    setLocalStatus('loading');
    setMessage(null);

    try {
      await promptAsync();
    } catch {
      setConnectingProvider(null);
      setLocalStatus('error');
      setMessage('Could not open Google sign-in.');
    }
  }

  function showProviderSetupMessage(providerName: string) {
    setConnectingProvider(null);
    setLocalStatus('idle');
    setMessage(`${providerName} sign-in is not wired yet.`);
  }

  async function clearSession() {
    setConnectingProvider(null);
    setLocalStatus('loading');
    setMessage(null);

    try {
      await signOut();
      setConnectingProvider(null);
      setLocalStatus('idle');
    } catch {
      setConnectingProvider(null);
      setLocalStatus('error');
      setMessage('Could not sign out of Firebase.');
    }
  }

  async function openDevTestProfile() {
    if (!authSession.firebaseIdToken) {
      return;
    }

    setConnectingProvider(null);
    setLocalStatus('loading');
    setMessage(null);

    try {
      const profile = await getDevTestProfile(authSession.firebaseIdToken);

      setConnectingProvider(null);
      setLocalStatus('signedIn');
      navigation.navigate('PublicProfile', {
        userId: profile.id,
      });
    } catch {
      setConnectingProvider(null);
      setLocalStatus('error');
      setMessage('Could not open the test profile.');
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.identityRow}>
        <View style={styles.avatarFrame}>
          <Text style={styles.avatarInitial}>{getUserInitial(currentUser?.displayName ?? currentUser?.id)}</Text>
        </View>
        <View style={styles.identityCopy}>
          <Text style={styles.statusLabel}>{currentUser ? 'Signed in' : 'Mobile sign-in'}</Text>
          <Text style={styles.title}>
            {currentUser ? currentUser.displayName ?? currentUser.id : 'Set up your Watchly profile'}
          </Text>
          <Text style={styles.body}>
            {currentUser
              ? 'Your public profile shows written reviews. Progress and viewing history stay private.'
              : 'Connect your account to keep your profile, reviews, and watchlists synced.'}
          </Text>
        </View>
      </View>

      {missingConfig.length > 0 ? (
        <Text style={styles.warning}>Missing config: {missingConfig.join(', ')}</Text>
      ) : null}
      {message ? <Text style={styles.warning}>{message}</Text> : null}

      <View style={styles.actionRow}>
        {status === 'loading' ? (
          <Text style={styles.connectingText}>Connecting with {connectingProvider ?? 'your account'}...</Text>
        ) : null}
        {currentUser ? (
          <>
            <ProfileActionButton
              icon={<Eye color={colors.textOnAccent} size={18} strokeWidth={2} />}
              label="Preview public profile"
              onPress={() =>
                navigation.navigate('PublicProfile', {
                  previewOwnProfile: true,
                  userId: currentUser.id,
                })
              }
              variant="primary"
            />
            {__DEV__ ? (
              <ProfileActionButton
                icon={<UserCircle color={colors.text} size={18} strokeWidth={2} />}
                label="Open test profile"
                onPress={openDevTestProfile}
              />
            ) : null}
            <ProfileActionButton
              icon={<LogOut color={colors.danger} size={18} strokeWidth={2} />}
              label="Sign out"
              onPress={clearSession}
              variant="danger"
            />
          </>
        ) : (
          <>
            <ProviderSignInButton
              disabled={!canSignIn}
              icon={<ProviderLogo variant="google" />}
              label="Continue with Google"
              onPress={startSignIn}
              tone="brandWhite"
            />
            <ProviderSignInButton
              icon={<ProviderLogo variant="apple" />}
              label="Continue with Apple"
              onPress={() => showProviderSetupMessage('Apple')}
              tone="brandDark"
            />
            <View style={styles.moreProvidersSection}>
              <Text style={styles.moreProvidersTitle}>More providers you can use</Text>
              <View style={styles.moreProvidersRow}>
                <ProviderIconButton
                  label="Continue with Microsoft"
                  logo={<ProviderLogo variant="microsoft" />}
                  onPress={() => showProviderSetupMessage('Microsoft')}
                  variant="microsoft"
                />
                <ProviderIconButton
                  label="Continue with Discord"
                  logo={<ProviderLogo variant="discord" />}
                  onPress={() => showProviderSetupMessage('Discord')}
                  variant="discord"
                />
                <ProviderIconButton
                  label="Continue with Facebook"
                  logo={<ProviderLogo variant="facebook" />}
                  onPress={() => showProviderSetupMessage('Facebook')}
                  variant="facebook"
                />
              </View>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function ProviderLogo({ variant }: { variant: ProviderButtonVariant }) {
  switch (variant) {
    case 'apple':
      return (
        <Svg height={22} viewBox="0 0 24 24" width={22}>
          <Path
            d="M16.4 13.1c0-2.1 1.7-3.1 1.8-3.2-1-1.5-2.6-1.7-3.2-1.8-1.4-.1-2.6.8-3.3.8-.7 0-1.8-.8-3-.8-1.5 0-2.9.9-3.7 2.2-1.6 2.8-.4 7 1.1 9.2.8 1.1 1.7 2.3 2.9 2.3 1.1 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.2.9-1.3 1.2-2.5 1.2-2.6-.1 0-2.6-1-2.6-3.9z"
            fill="#FFFFFF"
          />
          <Path
            d="M14.1 6.6c.6-.7 1-1.7.9-2.7-.9 0-1.9.6-2.5 1.3-.6.7-1 1.7-.9 2.6 1 0 1.9-.5 2.5-1.2z"
            fill="#FFFFFF"
          />
        </Svg>
      );
    case 'discord':
      return (
        <Svg height={22} viewBox="0 0 24 24" width={22}>
          <Path
            d="M19.5 5.5A17 17 0 0 0 15.2 4l-.5 1c-1.8-.3-3.6-.3-5.4 0l-.5-1a17 17 0 0 0-4.3 1.5C1.8 9.5 1.1 13.4 1.4 17.2A17.4 17.4 0 0 0 6.7 20l1.1-1.8c-.6-.2-1.1-.5-1.6-.8l.4-.3a12.3 12.3 0 0 0 10.8 0l.4.3c-.5.3-1 .6-1.6.8l1.1 1.8a17.4 17.4 0 0 0 5.3-2.8c.4-4.4-.7-8.2-3.1-11.7zM8.7 15.1c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z"
            fill="#FFFFFF"
          />
        </Svg>
      );
    case 'facebook':
      return (
        <Svg height={22} viewBox="0 0 24 24" width={22}>
          <Path
            d="M14.1 8.4h2V5h-2.8C10.5 5 9 6.8 9 9.5V12H7v3.4h2V22h3.8v-6.6h2.6L16 12h-3.2V9.8c0-.9.4-1.4 1.3-1.4z"
            fill="#FFFFFF"
          />
        </Svg>
      );
    case 'microsoft':
      return (
        <Svg height={22} viewBox="0 0 24 24" width={22}>
          <Rect fill="#F25022" height={9.4} width={9.4} x={2} y={2} />
          <Rect fill="#7FBA00" height={9.4} width={9.4} x={12.6} y={2} />
          <Rect fill="#00A4EF" height={9.4} width={9.4} x={2} y={12.6} />
          <Rect fill="#FFB900" height={9.4} width={9.4} x={12.6} y={12.6} />
        </Svg>
      );
    case 'google':
      return (
        <Svg height={22} viewBox="0 0 24 24" width={22}>
          <Path d="M21.6 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5.4a4.6 4.6 0 0 1-2 3v2.4h3.2c1.9-1.7 3-4.2 3-7.1z" fill="#4285F4" />
          <Path d="M12 22c2.7 0 5-0.9 6.6-2.5l-3.2-2.4c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.8-5.6-4.1H3.1v2.5A10 10 0 0 0 12 22z" fill="#34A853" />
          <Path d="M6.4 13.9a6 6 0 0 1 0-3.8V7.6H3.1a10 10 0 0 0 0 8.8l3.3-2.5z" fill="#FBBC05" />
          <Path d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.8 9.8 0 0 0 12 2a10 10 0 0 0-8.9 5.6l3.3 2.5C7.2 7.8 9.4 6 12 6z" fill="#EA4335" />
        </Svg>
      );
  }

  return <Circle cx={12} cy={12} fill={colors.text} r={10} />;
}

function ProviderSignInButton({
  disabled,
  icon,
  label,
  onPress,
  tone,
}: {
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onPress: () => void;
  tone: ProviderButtonTone;
}) {
  const isLight = tone === 'brandWhite';

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.providerButton,
        tone === 'brandDark' ? styles.providerButtonDark : null,
        isLight ? styles.providerButtonWhite : null,
        pressed && !disabled ? styles.actionButtonPressed : null,
        disabled ? styles.actionButtonDisabled : null,
      ]}
    >
      <View style={styles.providerLogoSlot}>{icon}</View>
      <Text style={[styles.providerButtonLabel, isLight ? styles.providerButtonLabelDark : null]}>{label}</Text>
    </Pressable>
  );
}

function ProviderIconButton({
  label,
  logo,
  onPress,
  variant,
}: {
  label: string;
  logo: ReactNode;
  onPress: () => void;
  variant: 'discord' | 'facebook' | 'microsoft';
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.providerIconButton,
        variant === 'discord' ? styles.providerIconButtonDiscord : null,
        variant === 'facebook' ? styles.providerIconButtonFacebook : null,
        variant === 'microsoft' ? styles.providerIconButtonMicrosoft : null,
        pressed ? styles.actionButtonPressed : null,
      ]}
    >
      {logo}
    </Pressable>
  );
}

function ProfileActionButton({
  disabled,
  icon,
  label,
  onPress,
  variant = 'secondary',
}: {
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onPress: () => void;
  variant?: 'danger' | 'primary' | 'secondary';
}) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        isPrimary ? styles.actionButtonPrimary : styles.actionButtonSecondary,
        isDanger ? styles.actionButtonDanger : null,
        pressed && !disabled ? styles.actionButtonPressed : null,
        disabled ? styles.actionButtonDisabled : null,
      ]}
    >
      <View style={styles.actionIcon}>{icon}</View>
      <Text
        style={[
          styles.actionLabel,
          isPrimary ? styles.actionLabelPrimary : styles.actionLabelSecondary,
          isDanger ? styles.actionLabelDanger : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function getUserInitial(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return 'K';
  }

  return trimmed.charAt(0).toUpperCase();
}

function getAccountCheckErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status) {
    return `Backend account check failed with status ${error.status}.`;
  }

  if (error instanceof ApiError) {
    return error.message;
  }

  return 'Sign-in failed. Check Firebase and backend account setup.';
}

function getSafeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    width: '100%',
  },
  actionButtonDanger: {
    backgroundColor: colors.dangerBackground,
    borderColor: colors.danger,
  },
  actionButtonDisabled: {
    opacity: 0.48,
  },
  actionButtonPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.99 }],
  },
  actionButtonPrimary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  actionButtonSecondary: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
  },
  actionIcon: {
    alignItems: 'center',
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
  },
  actionLabelDanger: {
    color: colors.danger,
  },
  actionLabelPrimary: {
    color: colors.textOnAccent,
  },
  actionLabelSecondary: {
    color: colors.text,
  },
  actionRow: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    width: '100%',
  },
  avatarFrame: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
    borderRadius: radii.lg,
    borderWidth: 1,
    height: 64,
    justifyContent: 'center',
    marginRight: spacing.md,
    width: 64,
  },
  avatarInitial: {
    color: colors.accentText,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0,
  },
  body: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  connectingText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 18,
    textAlign: 'center',
  },
  card: {
    ...shadows.panel,
    backgroundColor: colors.panelSoft,
    borderColor: colors.borderStrong,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  identityCopy: {
    flex: 1,
  },
  identityRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  moreProvidersRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
  },
  moreProvidersSection: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
    width: '100%',
  },
  moreProvidersTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
  },
  providerButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 46,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    width: '100%',
  },
  providerButtonDark: {
    backgroundColor: colors.panel,
    borderColor: colors.borderStrong,
  },
  providerButtonLabel: {
    color: colors.textOnAccent,
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 18,
    marginRight: 32,
    textAlign: 'center',
  },
  providerButtonLabelDark: {
    color: '#111827',
  },
  providerButtonWhite: {
    backgroundColor: colors.textOnAccent,
    borderColor: colors.textOnAccent,
  },
  providerIconButton: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  providerIconButtonDiscord: {
    backgroundColor: '#5865F2',
    borderColor: '#5865F2',
  },
  providerIconButtonFacebook: {
    backgroundColor: '#1877F2',
    borderColor: '#1877F2',
  },
  providerIconButtonMicrosoft: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  providerLogoSlot: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  statusLabel: {
    ...typography.eyebrow,
    color: colors.accentText,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  warning: {
    ...typography.body,
    color: colors.danger,
    marginTop: spacing.md,
  },
});
