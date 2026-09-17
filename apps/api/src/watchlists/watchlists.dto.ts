import { ArrayMaxSize, ArrayUnique, IsArray, IsUUID, IsIn, IsInt, IsString, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';

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

export class CreateWatchlistSectionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name!: string;
}

export class UpdateWatchlistSectionDto extends CreateWatchlistSectionDto {}

export class MoveWatchlistItemDto {
  @ValidateIf((_object, value) => value !== null)
  @IsUUID('4')
  sectionId!: string | null;
}

export class UpdateWatchlistVisibilityDto {
  @IsIn(watchlistVisibilities)
  visibility!: WatchlistVisibility;
}

export class UpdateWatchlistCoverDto {
  @IsArray()
  @ArrayMaxSize(4)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  itemIds!: string[];
}
