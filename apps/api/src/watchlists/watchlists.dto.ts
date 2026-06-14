import { IsIn, IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

export const watchlistContentTypes = ['movie', 'series'] as const;

export type WatchlistContentType = (typeof watchlistContentTypes)[number];

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
