import { MovieRatingControl } from '../tracking/MovieRatingControl';

type MovieReviewEditorProps = {
  mediaTitle?: string;
  posterUrl?: string | null;
  tmdbId: number;
};

/** Compatibility entry point: rating and review now share one explicit opinion sheet. */
export function MovieReviewEditor(props: MovieReviewEditorProps) {
  return <MovieRatingControl {...props} />;
}
