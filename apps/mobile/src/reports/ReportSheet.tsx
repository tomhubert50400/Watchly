import { Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import type { ReportReason, ReportTarget } from '../api/reports';
import { submitReport } from '../api/reports';
import { useAuthSession } from '../auth/AuthSessionContext';
import {
  BottomActionSheet,
  BottomActionSheetScrollView,
} from '../components/BottomActionSheet';
import { Button } from '../components/Button';
import { colors, radii, spacing, typography } from '../design/tokens';
import { hapticError, hapticSelection, hapticSuccess } from '../feedback/haptics';
import { useToast } from '../notifications/ToastContext';
import {
  MAX_REPORT_DETAILS_LENGTH,
  REPORT_REASON_OPTIONS,
  normalizeReportDetails,
} from './reportModel';

type ReportSheetProps = {
  onClose: () => void;
  target: ReportTarget | null;
};

export function ReportSheet({ onClose, target }: ReportSheetProps) {
  const { getFirebaseIdToken } = useAuthSession();
  const { showToast } = useToast();
  const { fontScale } = useWindowDimensions();
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);

  useEffect(() => {
    setDetails('');
    setError(null);
    setIsSubmitting(false);
    setReason(null);
  }, [target?.id, target?.type]);

  function close() {
    if (!isSubmitting) onClose();
  }

  async function submit() {
    if (!target || !reason || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const token = await getFirebaseIdToken();

      if (!token) {
        throw new Error('Sign in again before submitting this report.');
      }

      await submitReport(token, target, reason, normalizeReportDetails(details));
      hapticSuccess();
      onClose();
      showToast('Report submitted privately.', 'success');
    } catch (submitError) {
      hapticError();
      setError(submitError instanceof Error ? submitError.message : 'Could not submit this report.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const footer = (
    <View style={[styles.footerActions, fontScale > 1.2 ? styles.footerActionsStacked : null]}>
      <View style={styles.footerButton}>
        <Button disabled={isSubmitting} fullWidth label="Cancel" onPress={close} variant="secondary" />
      </View>
      <View style={styles.submitButton}>
        <Button
          disabled={!reason}
          fullWidth
          label="Submit report"
          loading={isSubmitting}
          onPress={() => void submit()}
        />
      </View>
    </View>
  );

  return (
    <BottomActionSheet
      footer={footer}
      onClose={close}
      title="Report"
      visible={target !== null}
    >
      <BottomActionSheetScrollView contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text numberOfLines={2} style={styles.targetLabel}>{target?.label}</Text>
          <Text style={styles.help}>
            Reports are private. Sending one does not automatically remove content or notify the reported member.
          </Text>
        </View>

        <View accessibilityRole="radiogroup" style={styles.reasons}>
          {REPORT_REASON_OPTIONS.map((option) => {
            const selected = reason === option.value;

            return (
              <Pressable
                accessibilityLabel={option.label}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, disabled: isSubmitting }}
                disabled={isSubmitting}
                key={option.value}
                onPress={() => {
                  hapticSelection();
                  setReason(option.value);
                  setError(null);
                }}
                style={({ pressed }) => [
                  styles.reasonRow,
                  selected ? styles.reasonRowSelected : null,
                  pressed ? styles.reasonRowPressed : null,
                ]}
              >
                <Text style={[styles.reasonLabel, selected ? styles.reasonLabelSelected : null]}>
                  {option.label}
                </Text>
                <View style={[styles.radio, selected ? styles.radioSelected : null]}>
                  {selected ? <Check color={colors.textOnAccent} size={14} strokeWidth={3} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.detailsHeader}>
          <Text style={styles.detailsLabel}>Additional context</Text>
          <Text style={styles.counter}>{details.length} / {MAX_REPORT_DETAILS_LENGTH}</Text>
        </View>
        <TextInput
          accessibilityLabel="Additional report context"
          editable={!isSubmitting}
          maxLength={MAX_REPORT_DETAILS_LENGTH}
          multiline
          onChangeText={(value) => {
            setDetails(value);
            setError(null);
          }}
          placeholder="Optional details that will help the moderation team"
          placeholderTextColor={colors.textSubtle}
          style={styles.detailsInput}
          textAlignVertical="top"
          value={details}
        />
        {error ? <Text accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text> : null}
      </BottomActionSheetScrollView>
    </BottomActionSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.lg,
  },
  counter: {
    ...typography.meta,
    color: colors.textSubtle,
  },
  detailsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  detailsInput: {
    ...typography.body,
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    minHeight: 104,
    padding: spacing.md,
  },
  detailsLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  error: {
    ...typography.body,
    color: colors.danger,
    marginTop: spacing.md,
  },
  footerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  footerButton: {
    flex: 1,
  },
  footerActionsStacked: {
    flexDirection: 'column',
  },
  help: {
    ...typography.body,
    color: colors.textMuted,
  },
  intro: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  radio: {
    alignItems: 'center',
    borderColor: colors.borderStrong,
    borderRadius: 10,
    borderWidth: 1,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  radioSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  reasonLabel: {
    color: colors.textMuted,
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  reasonLabelSelected: {
    color: colors.text,
  },
  reasonRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 52,
    paddingVertical: spacing.sm,
  },
  reasonRowPressed: {
    opacity: 0.72,
  },
  reasonRowSelected: {
    borderBottomColor: colors.accentBorder,
  },
  reasons: {
    marginTop: spacing.sm,
  },
  submitButton: {
    flex: 1.45,
  },
  targetLabel: {
    ...typography.title,
    color: colors.text,
  },
});
