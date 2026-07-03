import { IsBoolean, IsIn, IsInt, IsOptional, Min } from 'class-validator';

export const contentTypes = ['movie', 'series'] as const;
const contentStatuses = ['watchlisted', 'watching', 'watched', 'dropped'] as const;

export type TrackingContentType = (typeof contentTypes)[number];
export type TrackingStatus = (typeof contentStatuses)[number];

export class UpsertContentStateDto {
  @IsIn(contentTypes)
  contentType!: TrackingContentType;

  @IsInt()
  @Min(1)
  tmdbId!: number;

  @IsOptional()
  @IsIn(contentStatuses)
  status?: TrackingStatus | null;

  @IsOptional()
  @IsBoolean()
  favorite?: boolean;
}
