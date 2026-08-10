import { BadRequestException } from '@nestjs/common';
import {
  TrackedContentType,
  UserContentStatus,
} from '../generated/prisma/enums';

export type ProfileBackdropContentType = 'movie' | 'series';

export type ProfileBackdropInput = {
  contentType?: ProfileBackdropContentType | null;
  tmdbId?: number | null;
};

export type ProfileBackdropSelection = {
  contentType: TrackedContentType;
  tmdbId: number;
};

export function normalizeProfileBackdropInput(
  input: ProfileBackdropInput,
): ProfileBackdropSelection | null {
  if (!hasOwn(input, 'contentType') || !hasOwn(input, 'tmdbId')) {
    throw new BadRequestException('Provide both contentType and tmdbId.');
  }
  if (input.contentType === null && input.tmdbId === null) return null;
  if (
    (input.contentType !== 'movie' && input.contentType !== 'series')
    || !Number.isInteger(input.tmdbId)
    || (input.tmdbId ?? 0) < 1
  ) {
    throw new BadRequestException('Choose a valid movie or series.');
  }

  return {
    contentType: input.contentType === 'movie'
      ? TrackedContentType.MOVIE
      : TrackedContentType.SERIES,
    tmdbId: input.tmdbId!,
  };
}

export function isProfileBackdropEligible({
  favorite,
  hasEpisodeProgress,
  hasReleaseAlert,
  selection,
  status,
}: {
  favorite: boolean;
  hasEpisodeProgress: boolean;
  hasReleaseAlert: boolean;
  selection: ProfileBackdropSelection;
  status: UserContentStatus | null;
}) {
  if (favorite || hasReleaseAlert || status === UserContentStatus.WATCHED) return true;
  if (selection.contentType === TrackedContentType.MOVIE) return false;

  return status === UserContentStatus.WATCHING || hasEpisodeProgress;
}

export function toApiProfileBackdrop(
  contentType: TrackedContentType | null,
  tmdbId: number | null,
) {
  if (!contentType || !tmdbId) return null;

  return {
    contentType: contentType === TrackedContentType.MOVIE ? 'movie' as const : 'series' as const,
    tmdbId,
  };
}

function hasOwn<T extends object>(value: T, key: keyof ProfileBackdropInput) {
  return Object.prototype.hasOwnProperty.call(value, key);
}
