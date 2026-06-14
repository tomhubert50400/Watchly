import { ArrayMaxSize, IsArray, IsIn, IsInt, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';

export const sharedWatchlistContentTypes = ['movie', 'series'] as const;

export type SharedWatchlistContentType = (typeof sharedWatchlistContentTypes)[number];

export class CreateSharedWatchlistDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;
}

export class SharedWatchlistMemberDto {
  @IsUUID()
  userId!: string;
}

export class SharedWatchlistItemDto {
  @IsIn(sharedWatchlistContentTypes)
  contentType!: SharedWatchlistContentType;

  @IsInt()
  @Min(1)
  tmdbId!: number;
}

export class CreateVotingSessionDto {
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  itemIds!: string[];

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  title!: string;
}
