export type DetailRenderMode = 'content' | 'fullError' | 'loading';

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
