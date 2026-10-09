import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { getWatchlistItemLoadingState } from './personalWatchlistHydration';

export function WatchlistHydrationStatus({ items, onRetry }: {
  items: { title: string | null }[]; onRetry: () => void;
}) {
  const states = items.map(getWatchlistItemLoadingState);
  const loading = states.filter(state => state === 'loading').length;
  const failed = states.filter(state => state === 'error').length;
  if (!loading && !failed) return null;
  return <InlineStatusBanner tone={loading ? 'updating' : 'error'}
    title={loading ? 'Loading titles' : 'Some titles could not load'}
    detail={loading ? `${items.length - loading - failed} of ${items.length} ready${failed ? ` · ${failed} unavailable` : ''}`
      : `${failed} ${failed === 1 ? 'title is' : 'titles are'} unavailable. Your list is saved.`}
    retryLabel="Retry missing titles" onRetry={loading ? undefined : onRetry} />;
}
