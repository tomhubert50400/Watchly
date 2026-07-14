export type ReleaseAlertLoadStatus = 'loading' | 'ready' | 'error';

type ReleaseAlertStateLike = {
  enabled: boolean;
};

export function getReleaseAlertControlPresentation(
  status: ReleaseAlertLoadStatus,
  state: ReleaseAlertStateLike | null,
) {
  if (status === 'error') {
    return {
      accessibilityLabel: 'Release alert unavailable. Retry',
      action: 'retry' as const,
      disabled: false,
      enabled: false,
    };
  }

  if (status === 'loading') {
    return {
      accessibilityLabel: 'Loading release alert',
      action: 'none' as const,
      disabled: true,
      enabled: false,
    };
  }

  const enabled = Boolean(state?.enabled);
  return {
    accessibilityLabel: enabled ? 'Disable release alert' : 'Enable release alert',
    action: 'toggle' as const,
    disabled: false,
    enabled,
  };
}
