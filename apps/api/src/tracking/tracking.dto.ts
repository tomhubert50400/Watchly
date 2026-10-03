import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsOptional, Min, ValidateNested } from 'class-validator';

export const contentTypes = ['movie', 'series'] as const;
const contentStatuses = ['watchlisted', 'watching', 'watched', 'dropped'] as const;

export type TrackingContentType = (typeof contentTypes)[number];
export type TrackingStatus = (typeof contentStatuses)[number];

class FavoriteOrderItemDto {
  @IsIn(contentTypes)
  contentType!: TrackingContentType;

  @IsInt()
  @Min(1)
  tmdbId!: number;
}

export class SaveFavoriteOrderDto {
  @IsArray()
  @ArrayUnique((item: FavoriteOrderItemDto | null) => `${item?.contentType}:${item?.tmdbId}`)
  @ValidateNested({ each: true })
  @Type(() => FavoriteOrderItemDto)
  items!: FavoriteOrderItemDto[];
}

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
