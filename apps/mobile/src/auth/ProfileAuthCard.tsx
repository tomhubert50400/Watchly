import { useEffect, useMemo, useState } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { LogIn, LogOut } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../api/client';
import { Button } from '../components/Button';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import { useAuthSession } from './AuthSessionContext';
import { getMissingFirebaseConfig } from './firebase';
import { authRedirectScheme, getMissingGoogleClientConfig, googleClientIds } from './googleAuthConfig';

WebBrowser.maybeCompleteAuthSession();

type AuthStatus = 'idle' | 'loading' | 'signedIn' | 'error';

export function ProfileAuthCard() {
  const authSession = useAuthSession();
  const { currentUser, signInWithGoogle, signOut } = authSession;
  const [localStatus, setLocalStatus] = useState<AuthStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const missingConfig = useMemo(
    () => [...getMissingFirebaseConfig(), ...getMissingGoogleClientConfig()],
    [],
  );
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(
    {
      ...googleClientIds,
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
      setLocalStatus('loading');
      setMessage(null);

      try {
        await signInWithGoogle(googleIdToken);

        if (!isMounted) {
          return;
        }

        setLocalStatus('signedIn');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        console.warn('Sign-in failed', getSafeErrorMessage(error));
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

    setLocalStatus('loading');
    setMessage(null);

    try {
      await promptAsync();
    } catch {
      setLocalStatus('error');
      setMessage('Could not open Google sign-in.');
    }
  }

  async function clearSession() {
    setLocalStatus('loading');
    setMessage(null);

    try {
      await signOut();
      setLocalStatus('idle');
    } catch {
      setLocalStatus('error');
      setMessage('Could not sign out of Firebase.');
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconFrame}>
          {currentUser ? (
            <LogOut color={colors.accent} size={20} strokeWidth={2} />
          ) : (
            <LogIn color={colors.accent} size={20} strokeWidth={2} />
          )}
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{currentUser ? 'Signed in' : 'Mobile sign-in'}</Text>
          <Text style={styles.body}>
            {currentUser
              ? currentUser.displayName ?? currentUser.id
              : 'Connect your account to keep your profile ready.'}
          </Text>
        </View>
      </View>

      {missingConfig.length > 0 ? (
        <Text style={styles.warning}>Missing config: {missingConfig.join(', ')}</Text>
      ) : null}
      {message ? <Text style={styles.warning}>{message}</Text> : null}

      <View style={styles.actionRow}>
        {status === 'loading' ? <ActivityIndicator color={colors.accent} /> : null}
        {currentUser ? (
          <Button label="Sign out" onPress={clearSession} variant="secondary" />
        ) : (
          <Button disabled={!canSignIn} label="Continue with Google" onPress={startSignIn} />
        )}
      </View>
    </View>
  );
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
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  body: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  card: {
    ...shadows.panel,
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  copy: {
    flex: 1,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  iconFrame: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    marginRight: spacing.md,
    width: 42,
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
