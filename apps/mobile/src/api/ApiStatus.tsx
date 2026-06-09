import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getHealth, HealthResponse } from './health';

export function ApiStatus() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadHealth = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      setHealth(await getHealth());
    } catch (caughtError) {
      setHealth(null);
      setError(caughtError instanceof Error ? caughtError.message : 'API healthcheck failed.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  return (
    <View style={styles.panel}>
      <Text style={styles.label}>API status</Text>
      <Text style={styles.status}>
        {isLoading ? 'Checking API...' : health ? 'Connected to API' : 'API unavailable'}
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!isLoading && !health ? (
        <Pressable
          accessibilityRole="button"
          onPress={loadHealth}
          style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  error: { color: '#B91C1C', fontSize: 14, letterSpacing: 0, lineHeight: 20, marginTop: 8 },
  label: { color: '#64748B', fontSize: 12, fontWeight: '700', letterSpacing: 0, textTransform: 'uppercase' },
  panel: { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE', borderRadius: 8, borderWidth: 1, marginTop: 16, padding: 16 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  retryButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#111827', borderRadius: 8, marginTop: 14, paddingHorizontal: 14, paddingVertical: 10 },
  retryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 0 },
  status: { color: '#111827', fontSize: 16, fontWeight: '700', letterSpacing: 0, lineHeight: 22, marginTop: 6 },
});
