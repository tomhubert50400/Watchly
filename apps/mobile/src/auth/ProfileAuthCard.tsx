import { ReactNode, useEffect, useMemo, useState } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { ApiError } from '../api/client';
import { BrandLogo } from '../brand/BrandLogo';
import { colors, radii, spacing, typography } from '../design/tokens';
import { hapticError, hapticSuccess } from '../feedback/haptics';
import { useAuthSession } from './AuthSessionContext';
import { getMissingFirebaseConfig } from './firebase';
import { authRedirectScheme, getMissingGoogleClientConfig, googleClientIds } from './googleAuthConfig';
import { authProviders, type AuthProviderConfig } from './providerConfig';

WebBrowser.maybeCompleteAuthSession();

type AuthStatus = 'idle' | 'loading' | 'error';

const googleRequestClientIds = {
  androidClientId: googleClientIds.androidClientId ?? 'missing-android-client-id',
  iosClientId: googleClientIds.iosClientId ?? 'missing-ios-client-id',
  webClientId: googleClientIds.webClientId ?? 'missing-web-client-id',
};

type ProfileAuthCardProps = {
  body?: string;
  embedded?: boolean;
  title?: string;
};

export function ProfileAuthCard({
  body = 'Sync your lists, ratings, and progress across all your devices.',
  embedded = false,
  title = 'Your Watchly starts here',
}: ProfileAuthCardProps = {}) {
  const { signInWithGoogle, status: sessionStatus } = useAuthSession();
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<AuthStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const missingConfig = useMemo(
    () => [...getMissingFirebaseConfig(), ...getMissingGoogleClientConfig()],
    [],
  );
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(
    { ...googleRequestClientIds, selectAccount: true },
    { path: 'auth', scheme: authRedirectScheme },
  );

  useEffect(() => {
    let mounted = true;
    async function finishGoogleSignIn(idToken: string) {
      setConnectingProvider('Google');
      setLocalStatus('loading');
      setMessage(null);
      try {
        await signInWithGoogle(idToken);
        hapticSuccess();
        if (mounted) {
          setConnectingProvider(null);
          setLocalStatus('idle');
        }
      } catch (error) {
        hapticError();
        if (mounted) {
          console.warn('Sign-in failed', safeError(error));
          setConnectingProvider(null);
          setLocalStatus('error');
          setMessage(accountError(error));
        }
      }
    }

    if (response?.type === 'success') {
      const idToken = response.params.id_token;
      if (typeof idToken === 'string' && idToken.length > 0) {
        void finishGoogleSignIn(idToken);
      } else {
        hapticError();
        setLocalStatus('error');
        setMessage('Google did not return an ID token.');
      }
    } else if (response?.type === 'error') {
      hapticError();
      setConnectingProvider(null);
      setLocalStatus('error');
      setMessage('Google sign-in was rejected.');
    } else if (response) {
      setConnectingProvider(null);
      setLocalStatus('idle');
    }

    return () => { mounted = false; };
  }, [response, signInWithGoogle]);

  const status = sessionStatus === 'loading' ? 'loading' : localStatus;
  const canUseGoogle = missingConfig.length === 0 && Boolean(request) && status !== 'loading';

  async function selectProvider(provider: AuthProviderConfig) {
    setMessage(null);
    if (!provider.isWired) {
      setConnectingProvider(null);
      setLocalStatus('idle');
      setMessage(`${provider.name} sign-in is not connected yet. Choose Google or finish provider setup first.`);
      return;
    }
    if (!canUseGoogle) return;
    setConnectingProvider(provider.name);
    setLocalStatus('loading');
    try {
      await promptAsync();
    } catch {
      hapticError();
      setConnectingProvider(null);
      setLocalStatus('error');
      setMessage('Could not open Google sign-in.');
    }
  }

  const primaryProviders = authProviders.filter((provider) => provider.presentation === 'primary');
  const secondaryProviders = authProviders.filter((provider) => provider.presentation === 'secondary');

  return (
    <View style={[styles.shell, embedded ? styles.shellEmbedded : null]}>
      <View pointerEvents="none" style={styles.glow} />
      <View style={styles.card}>
        <BrandLogo size={76} />
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>

        {missingConfig.length > 0 ? (
          <Text accessibilityLiveRegion="polite" style={styles.configWarning}>
            Google setup is incomplete: {missingConfig.join(', ')}
          </Text>
        ) : null}
        {message ? <Text accessibilityLiveRegion="polite" style={styles.setupMessage}>{message}</Text> : null}
        {status === 'loading' ? (
          <Text accessibilityLiveRegion="polite" style={styles.connecting}>Connecting with {connectingProvider ?? 'your account'}…</Text>
        ) : null}

        <View style={styles.primaryList}>
          {primaryProviders.map((provider) => (
            <ProviderButton
              disabled={provider.id === 'google' && !canUseGoogle}
              key={provider.id}
              label={`Continue with ${provider.name}`}
              logo={<ProviderLogo id={provider.id} />}
              onPress={() => { void selectProvider(provider); }}
              white={provider.id === 'google'}
            />
          ))}
        </View>

        <Text style={styles.moreLabel}>OTHER AVAILABLE OPTIONS</Text>
        <View style={styles.secondaryRow}>
          {secondaryProviders.map((provider) => (
            <View key={provider.id} style={styles.secondaryItem}>
              <Pressable
                accessibilityLabel={`Continue with ${provider.name}`}
                accessibilityRole="button"
                onPress={() => { void selectProvider(provider); }}
                style={({ pressed }) => [
                  styles.roundProvider,
                  provider.id === 'microsoft' ? styles.microsoft : null,
                  provider.id === 'discord' ? styles.discord : null,
                  provider.id === 'facebook' ? styles.facebook : null,
                  pressed ? styles.pressed : null,
                ]}
              >
                <ProviderLogo id={provider.id} />
              </Pressable>
              <Text style={styles.providerName}>{provider.name}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.note}>Choose the sign-in method you prefer. Providers that still need setup remain visible and never simulate success.</Text>
      </View>
    </View>
  );
}

function ProviderButton({ disabled, label, logo, onPress, white }: {
  disabled?: boolean;
  label: string;
  logo: ReactNode;
  onPress: () => void;
  white?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.providerButton,
        white ? styles.providerWhite : styles.providerDark,
        disabled ? styles.disabled : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.logoSlot}>{logo}</View>
      <Text style={[styles.providerButtonLabel, white ? styles.providerButtonLabelDark : null]}>{label}</Text>
    </Pressable>
  );
}

function ProviderLogo({ id }: { id: AuthProviderConfig['id'] }) {
  if (id === 'google') {
    return (
      <View style={styles.googleLogoCrop}>
        <Image
          accessibilityIgnoresInvertColors
          accessible={false}
          source={require('../../assets/google-signin-light-square.png')}
          style={styles.googleLogoAsset}
        />
      </View>
    );
  }
  if (id === 'apple') {
    return (
      <Svg height={23} viewBox="0 0 24 24" width={23}>
        <Path d="M16.4 13.1c0-2.1 1.7-3.1 1.8-3.2-1-1.5-2.6-1.7-3.2-1.8-1.4-.1-2.6.8-3.3.8-.7 0-1.8-.8-3-.8-1.5 0-2.9.9-3.7 2.2-1.6 2.8-.4 7 1.1 9.2.8 1.1 1.7 2.3 2.9 2.3 1.1 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.2.9-1.3 1.2-2.5 1.2-2.6-.1 0-2.6-1-2.6-3.9z" fill="#FFFFFF" />
        <Path d="M14.1 6.6c.6-.7 1-1.7.9-2.7-.9 0-1.9.6-2.5 1.3-.6.7-1 1.7-.9 2.6 1 0 1.9-.5 2.5-1.2z" fill="#FFFFFF" />
      </Svg>
    );
  }
  if (id === 'microsoft') {
    return (
      <Svg height={22} viewBox="0 0 24 24" width={22}>
        <Rect fill="#F25022" height={9.4} width={9.4} x={2} y={2} />
        <Rect fill="#7FBA00" height={9.4} width={9.4} x={12.6} y={2} />
        <Rect fill="#00A4EF" height={9.4} width={9.4} x={2} y={12.6} />
        <Rect fill="#FFB900" height={9.4} width={9.4} x={12.6} y={12.6} />
      </Svg>
    );
  }
  if (id === 'discord') {
    return (
      <Svg height={23} viewBox="0 0 24 24" width={23}>
        <Path d="M19.5 5.5A17 17 0 0 0 15.2 4l-.5 1c-1.8-.3-3.6-.3-5.4 0l-.5-1a17 17 0 0 0-4.3 1.5C1.8 9.5 1.1 13.4 1.4 17.2A17.4 17.4 0 0 0 6.7 20l1.1-1.8c-.6-.2-1.1-.5-1.6-.8l.4-.3a12.3 12.3 0 0 0 10.8 0l.4.3c-.5.3-1 .6-1.6.8l1.1 1.8a17.4 17.4 0 0 0 5.3-2.8c.4-4.4-.7-8.2-3.1-11.7zM8.7 15.1c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z" fill="#FFFFFF" />
      </Svg>
    );
  }
  return (
    <Svg height={23} viewBox="0 0 24 24" width={23}>
      <Path d="M14.1 8.4h2V5h-2.8C10.5 5 9 6.8 9 9.5V12H7v3.4h2V22h3.8v-6.6h2.6L16 12h-3.2V9.8c0-.9.4-1.4 1.3-1.4z" fill="#FFFFFF" />
    </Svg>
  );
}

function accountError(error: unknown) {
  if (error instanceof ApiError && error.status) return `Backend account check failed with status ${error.status}.`;
  if (error instanceof ApiError) return error.message;
  return 'Sign-in failed. Check Firebase and backend account setup.';
}
function safeError(error: unknown) { return error instanceof Error ? error.message : String(error); }

const styles = StyleSheet.create({
  body: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },
  card: { backgroundColor: 'rgba(15, 19, 29, 0.92)', borderColor: colors.border, borderRadius: radii.xl, borderWidth: 1, padding: spacing.lg },
  configWarning: { ...typography.meta, color: colors.danger, marginTop: spacing.md, textAlign: 'center' },
  connecting: { ...typography.meta, color: colors.accentText, marginTop: spacing.md, textAlign: 'center' },
  disabled: { opacity: 0.48 },
  discord: { backgroundColor: '#5865F2', borderColor: '#5865F2' },
  facebook: { backgroundColor: '#1877F2', borderColor: '#1877F2' },
  glow: { backgroundColor: colors.accentSoft, borderRadius: 155, height: 310, left: '10%', opacity: 0.7, position: 'absolute', top: 14, width: '80%' },
  googleLogoAsset: { height: 40, left: -10, position: 'absolute', top: -10, width: 40 },
  googleLogoCrop: { height: 20, overflow: 'hidden', width: 20 },
  logoSlot: { alignItems: 'center', height: 24, justifyContent: 'center', width: 24 },
  microsoft: { backgroundColor: '#F7F3F5', borderColor: '#F7F3F5' },
  moreLabel: { color: colors.textSubtle, fontSize: 10, fontWeight: '800', marginBottom: spacing.sm, marginTop: spacing.lg, textAlign: 'center' },
  note: { color: colors.textSubtle, fontSize: 11, lineHeight: 15, marginTop: spacing.md, textAlign: 'center' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  primaryList: { gap: spacing.sm, marginTop: spacing.lg },
  providerButton: { alignItems: 'center', borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', minHeight: 50, paddingHorizontal: spacing.md },
  providerButtonLabel: { color: colors.text, flex: 1, fontSize: 14, fontWeight: '800', marginRight: 24, textAlign: 'center' },
  providerButtonLabelDark: { color: '#1F1F1F' },
  providerDark: { backgroundColor: colors.background, borderColor: colors.borderStrong },
  providerName: { color: colors.textSubtle, fontSize: 10, fontWeight: '700' },
  providerWhite: { backgroundColor: '#FFFFFF', borderColor: '#747775' },
  roundProvider: { alignItems: 'center', borderRadius: 28, borderWidth: 1, height: 52, justifyContent: 'center', width: 52 },
  secondaryItem: { alignItems: 'center', gap: spacing.xs },
  secondaryRow: { flexDirection: 'row', gap: spacing.lg, justifyContent: 'center' },
  setupMessage: { ...typography.meta, color: colors.textMuted, marginTop: spacing.md, textAlign: 'center' },
  shell: { paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, position: 'relative' },
  shellEmbedded: { paddingHorizontal: 0, paddingTop: 0 },
  title: { color: colors.text, fontSize: 25, fontWeight: '900', lineHeight: 30, marginTop: spacing.md, textAlign: 'center' },
});
