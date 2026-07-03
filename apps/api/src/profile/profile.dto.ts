import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

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
