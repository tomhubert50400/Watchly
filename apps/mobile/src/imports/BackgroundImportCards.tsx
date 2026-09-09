import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { BackgroundImport, dismissBackgroundImport, ImportPreview, listBackgroundImports, reviewBackgroundImport, startBackgroundImport } from '../api/imports';
import { useAuthSession } from '../auth/AuthSessionContext';
import { Button } from '../components/Button';
import { colors, radii, spacing, typography } from '../design/tokens';
import type { RootStackParamList } from '../navigation/types';
import { notifyUserDataChanged } from '../sync/userDataEvents';

export function BackgroundImportCards({ refreshKey = 0, onReview }: {
  refreshKey?: number;
  onReview?: (preview: ImportPreview) => void;
}) {
  const { currentUser, getFirebaseIdToken } = useAuthSession();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [jobs, setJobs] = useState<{ userId: string; items: BackgroundImport[] } | null>(null);
  const [revision, setRevision] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const completed = useRef(new Set<string>());

  useFocusEffect(useCallback(() => {
    if (!currentUser) return undefined;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      try {
        if (AppState.currentState !== 'active') return;
        const token = await getFirebaseIdToken();
        if (!token || !active) return;
        const result = await listBackgroundImports(token);
        if (!active) return;
        setJobs({ userId: currentUser.id, items: result.imports });
        for (const job of result.imports) {
          if (job.status === 'completed' && !completed.current.has(job.importId)) {
            completed.current.add(job.importId);
            notifyUserDataChanged('episodeProgress', 'opinions', 'profile', 'tracking', 'viewings');
          }
        }
      } catch {
        // Preserve the last known progress during temporary connection failures.
      } finally {
        if (active) timer = setTimeout(() => void refresh(), 10_000);
      }
    };
    void refresh();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [currentUser?.id, getFirebaseIdToken, refreshKey, revision]));

  const action = async (job: BackgroundImport, kind: 'retry' | 'review' | 'dismiss') => {
    setBusyId(job.importId);
    setError(null);
    try {
      const token = await getFirebaseIdToken();
      if (!token) return;
      if (kind === 'retry') await startBackgroundImport(token, job.importId);
      if (kind === 'dismiss') await dismissBackgroundImport(token, job.importId);
      if (kind === 'review') {
        if (onReview) onReview(await reviewBackgroundImport(token, job.importId));
        else navigation.navigate('ImportData');
      }
      setRevision((value) => value + 1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update this import.');
    } finally {
      setBusyId(null);
    }
  };

  if (!currentUser || jobs?.userId !== currentUser.id) return null;
  return <>
    {jobs?.items.map((job) => {
      const percent = job.status === 'completed' ? 100 : job.total > 0
        ? Math.min(100, Math.max(0, Math.floor(job.processed / job.total * 100))) : 0;
      const step = job.phase === 'matching' ? 'Step 1 of 2 · Matching titles' : 'Step 2 of 2 · Importing titles';
      return <View key={job.importId} style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>
        {job.status === 'completed' ? 'Import complete' : job.status === 'failed' ? 'Import paused' : 'Import in progress'}
      </Text>
      <Text numberOfLines={1} style={styles.body}>{job.fileName}</Text>
      <View style={styles.progressHeading}>
        <Text style={styles.progressLabel}>{job.status === 'completed' ? 'Completed' : step}</Text>
        <Text style={styles.progressPercent}>{percent}%</Text>
      </View>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={job.status === 'completed' ? 'Import complete' : `${step}${job.status === 'failed' ? ', paused' : ''}`}
        accessibilityValue={{ min: 0, max: 100, now: percent, text: `${job.processed} of ${job.total} titles` }}
        style={styles.progressTrack}
      >
        <View style={[styles.progressFill, { width: `${percent}%`,
          backgroundColor: job.status === 'completed' ? colors.success : job.status === 'failed' ? colors.danger : colors.accent,
        }]} />
      </View>
      <Text style={styles.progressCount}>{job.processed} / {job.total} titles</Text>
      <Text accessibilityLiveRegion="polite" style={styles.body}>
        {job.status === 'processing'
          ? 'You can keep using Watchly or close the app.'
          : job.status === 'failed'
            ? 'Your progress is saved. Retry to continue the import.'
            : `${job.result?.titlesProcessed ?? 0} titles imported.${job.needsAttention ? ` ${job.needsAttention} titles need review.` : ''}`}
      </Text>
      {job.status === 'failed' ? <Button label="Retry import" loading={busyId === job.importId} onPress={() => void action(job, 'retry')} /> : null}
      {job.status === 'completed' && job.needsAttention > 0 ? <Button label="Review titles" disabled={busyId !== null} onPress={() => void action(job, 'review')} /> : null}
      {job.status === 'completed' ? <Button label="Dismiss" variant="secondary" disabled={busyId !== null} onPress={() => void action(job, 'dismiss')} /> : null}
    </View>;
    })}
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </>;
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, gap: spacing.sm, borderRadius: radii.lg, backgroundColor: colors.panel },
  title: { ...typography.title, color: colors.text },
  body: { ...typography.body, color: colors.textMuted },
  progressHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  progressLabel: { ...typography.meta, color: colors.textMuted, flex: 1 },
  progressPercent: { ...typography.meta, color: colors.text, fontVariant: ['tabular-nums'] },
  progressTrack: { height: 6, borderRadius: radii.xs, overflow: 'hidden', backgroundColor: colors.border },
  progressFill: { height: '100%', borderRadius: radii.xs },
  progressCount: { ...typography.meta, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  error: { ...typography.body, color: colors.danger },
});
