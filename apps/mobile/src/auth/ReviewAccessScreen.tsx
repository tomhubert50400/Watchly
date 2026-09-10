import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusedFieldVisibility } from '../components/useFocusedFieldVisibility';
import { Button } from '../components/Button';
import { colors, radii, spacing } from '../design/tokens';
import type { RootStackParamList } from '../navigation/types';
import { ApiError } from '../api/client';
import { useAuthSession } from './AuthSessionContext';

export function ReviewAccessScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'ReviewAccess'>) {
  const { currentUser, signInWithDemo, signOut, status } = useAuthSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const visibility = useFocusedFieldVisibility(scrollRef);
  const passwordInput = useRef<TextInput>(null);

  const close = () => navigation.reset({
    index: 0,
    routes: [{ name: currentUser && (!currentUser.onboardingCompleted || !currentUser.handle) ? 'Onboarding' : 'MainTabs' }],
  });

  const submit = async () => {
    if (busy.current || status === 'loading' || !username.trim() || !password) return;
    busy.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await signInWithDemo(username.trim(), password);
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 401
        ? 'Demo access is unavailable or the credentials are incorrect.'
        : cause instanceof ApiError && cause.status === 429
          ? 'Too many attempts. Please wait a minute and try again.'
          : 'Unable to sign in. Check your connection and try again.');
    } finally {
      setPassword('');
      busy.current = false;
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <ScrollView ref={scrollRef} {...visibility} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Explore Watchly</Text>
        {currentUser ? (
          <View style={styles.form}>
            <Text style={styles.description}>Signed in as {currentUser.displayName || currentUser.handle || 'a Watchly user'}.</Text>
            <Button label="Continue to Watchly" onPress={close} />
            <Button label="Sign out" variant="secondary" loading={status === 'loading'} onPress={() => {
              void signOut().catch(() => setError('Sign-out could not finish. Please try again.'));
            }} />
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.description}>Use the demo credentials provided in the review instructions.</Text>
            <Text style={styles.label}>Username</Text>
            <TextInput accessibilityLabel="Username" autoCapitalize="none" autoCorrect={false} autoComplete="username"
              editable={!submitting && status !== 'loading'} maxLength={128} onChangeText={setUsername}
              onSubmitEditing={() => passwordInput.current?.focus()} returnKeyType="next"
              style={styles.input} textContentType="username" value={username} />
            <Text style={styles.label}>Password</Text>
            <TextInput accessibilityLabel="Password" autoCapitalize="none" autoCorrect={false} autoComplete="password"
              editable={!submitting && status !== 'loading'} maxLength={256} onChangeText={setPassword}
              onSubmitEditing={() => void submit()} ref={passwordInput} returnKeyType="go" secureTextEntry
              style={styles.input} textContentType="password" value={password} />
            <Button disabled={!username.trim() || !password} label="Sign in" loading={submitting || status === 'loading'} onPress={() => void submit()} />
          </View>
        )}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Button label="Close" onPress={close} variant="ghost" disabled={submitting} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.background, flex: 1 },
  content: { flexGrow: 1, gap: spacing.lg, padding: spacing.xl },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  description: { color: colors.textMuted, fontSize: 15, lineHeight: 23 },
  form: { gap: spacing.md },
  label: { color: colors.text, fontSize: 14, fontWeight: '600' },
  input: { backgroundColor: colors.panel, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, color: colors.text, fontSize: 16, minHeight: 48, padding: spacing.md },
  error: { color: colors.danger, fontSize: 14, lineHeight: 21 },
});
