const PROBE_STORAGE_KEY_PREFIX = 'watchly:monitoring-probe:';

export function resolveMobileMonitoringProbeId(
  environment: string,
  configuredProbeId?: string,
) {
  if (environment !== 'staging') return null;

  const probeId = configuredProbeId?.trim();
  return probeId || null;
}

export function getMobileMonitoringProbeStorageKey(probeId: string) {
  return `${PROBE_STORAGE_KEY_PREFIX}${encodeURIComponent(probeId)}`;
}

export function createMobileMonitoringProbeError() {
  const error = new Error('Watchly staging mobile monitoring probe');
  error.name = 'WatchlyMobileMonitoringProbeError';
  return error;
}
