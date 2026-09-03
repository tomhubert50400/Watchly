import { EpisodeRatingControl } from '../tracking/EpisodeRatingControl';

type EpisodeReviewEditorProps = {
  episodeNumber: number;
  mediaTitle?: string;
  posterUrl?: string | null;
  seasonNumber: number;
  seriesTmdbId: number;
  variant?: 'activity' | 'default';
};

/** Compatibility entry point: rating and review now share one explicit opinion sheet. */
export function EpisodeReviewEditor(props: EpisodeReviewEditorProps) {
  return <EpisodeRatingControl {...props} />;
}
