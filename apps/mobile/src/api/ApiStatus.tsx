import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { colors, radii, spacing, typography } from '../design/tokens';
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
    <View style={[styles.panel, health ? styles.panelSuccess : null]}>
      <View style={styles.header}>
        <View style={[styles.dot, health ? styles.dotSuccess : styles.dotMuted]} />
        <Text style={styles.label}>API status</Text>
      </View>
      <Text style={styles.status}>
        {isLoading ? 'Checking connection' : health ? 'Backend connected' : 'Backend offline'}
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!isLoading && !health ? (
        <View style={styles.action}>
          <Button label="Retry" onPress={loadHealth} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'flex-start',
    marginTop: spacing.md,
  },
  error: {
    ...typography.body,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  dot: {
    borderRadius: 8,
    height: 8,
    marginRight: spacing.sm,
    width: 8,
  },
  dotMuted: {
    backgroundColor: colors.danger,
  },
  dotSuccess: {
    backgroundColor: colors.success,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  panel: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  panelSuccess: {
    backgroundColor: colors.successBackground,
  },
  status: {
    color: colors.text,
    ...typography.title,
    marginTop: spacing.sm,
  },
});
