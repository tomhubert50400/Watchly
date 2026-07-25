import { IsIn, IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

export const watchlistContentTypes = ['movie', 'series'] as const;
export const watchlistVisibilities = ['public', 'private'] as const;

export type WatchlistContentType = (typeof watchlistContentTypes)[number];
export type WatchlistVisibility = (typeof watchlistVisibilities)[number];

export class CreateWatchlistDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;
}

export class WatchlistItemDto {
  @IsIn(watchlistContentTypes)
  contentType!: WatchlistContentType;

  @IsInt()
  @Min(1)
  tmdbId!: number;
}

export class UpdateWatchlistVisibilityDto {
  @IsIn(watchlistVisibilities)
  visibility!: WatchlistVisibility;
}
