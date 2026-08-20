import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  PROFILE_HANDLE_INPUT_MAX_LENGTH,
  PROFILE_HANDLE_INPUT_PATTERN,
} from './profile-handle';

const privacyVisibilities = ['public', 'private'] as const;
const sharedWatchlistVisibilities = ['members', 'private'] as const;

export type PrivacyVisibilityValue = (typeof privacyVisibilities)[number];
export type SharedWatchlistVisibilityValue = (typeof sharedWatchlistVisibilities)[number];

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string | null;
}

export class ConfirmAvatarUploadDto {
  @IsString()
  @MaxLength(200)
  objectKey!: string;
}

export class CompleteOnboardingDto {
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  completedImportIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string | null;

  @IsString()
  @MaxLength(PROFILE_HANDLE_INPUT_MAX_LENGTH)
  @Matches(PROFILE_HANDLE_INPUT_PATTERN, {
    message: 'handle must use 1 to 20 letters, numbers, or underscores',
  })
  handle!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => OnboardingTasteItemDto)
  tasteItems?: OnboardingTasteItemDto[];
}

export class OnboardingTasteItemDto {
  @IsIn(['movie', 'series'])
  contentType!: 'movie' | 'series';

  @IsInt()
  @Min(1)
  tmdbId!: number;
}

export class UpdateProfileBackdropDto {
  @IsIn(['movie', 'series', null])
  contentType!: 'movie' | 'series' | null;

  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  tmdbId!: number | null;
}

export class UpdatePrivacySettingsDto {
  @IsOptional()
  @IsIn(privacyVisibilities)
  profileVisibility?: PrivacyVisibilityValue;

  @IsOptional()
  @IsIn(privacyVisibilities)
  viewingHistoryVisibility?: PrivacyVisibilityValue;

  @IsOptional()
  @IsIn(privacyVisibilities)
  episodeProgressVisibility?: PrivacyVisibilityValue;

  @IsOptional()
  @IsIn(privacyVisibilities)
  ratingsVisibility?: PrivacyVisibilityValue;

  @IsOptional()
  @IsIn(sharedWatchlistVisibilities)
  sharedWatchlistVisibility?: SharedWatchlistVisibilityValue;
}
