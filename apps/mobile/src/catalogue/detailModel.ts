export type DetailRenderMode = 'content' | 'fullError' | 'loading';

export function getDistinctOriginalTitle(originalTitle: string | null, title: string) {
  const normalizedOriginal = originalTitle?.trim();

  if (!normalizedOriginal || normalizedOriginal.localeCompare(title.trim(), 'en', { sensitivity: 'base' }) === 0) {
    return null;
  }

  return normalizedOriginal;
}

export function formatDetailDate(value: string | null) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  if (
    date.getUTCFullYear() !== Number(year)
    || date.getUTCMonth() !== Number(month) - 1
    || date.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(date);
}

export function formatMoney(value: number | null) {
  if (!value || value <= 0) {
    return null;
  }

  if (value >= 1_000_000_000) {
    return `$${formatCompactNumber(value / 1_000_000_000)}B`;
  }

  if (value >= 1_000_000) {
    return `$${formatCompactNumber(value / 1_000_000)}M`;
  }

  if (value >= 1_000) {
    return `$${formatCompactNumber(value / 1_000)}K`;
  }

  return `$${Math.round(value)}`;
}

export function formatRuntime(minutes: number | null) {
  if (!minutes) {
    return null;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${remainingMinutes}m`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

function formatCompactNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

export function formatFivePointRating(average: number, scale: 5 | 10) {
  return (scale === 10 ? average / 2 : average).toFixed(1);
}

export function getDetailRenderMode({
  hasData,
  hasError,
  isInitialLoading,
}: {
  hasData: boolean;
  hasError: boolean;
  isInitialLoading: boolean;
}): DetailRenderMode {
  if (hasData) {
    return 'content';
  }

  if (isInitialLoading) {
    return 'loading';
  }

  return hasError ? 'fullError' : 'loading';
}
