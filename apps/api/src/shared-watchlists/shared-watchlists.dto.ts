import { Type } from 'class-transformer';
import { ValidateNested, ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

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
  @IsOptional()
  @IsBoolean()
  allowMultipleVotes?: boolean;
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(10080)
  durationMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  itemIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => SharedWatchlistItemDto)
  titles?: SharedWatchlistItemDto[];

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  title!: string;
}

export class AddVotingCandidatesDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  itemIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => SharedWatchlistItemDto)
  titles?: SharedWatchlistItemDto[];
}
