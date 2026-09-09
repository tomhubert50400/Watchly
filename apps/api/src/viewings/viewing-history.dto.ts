import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

class ViewingHistoryItemDto {
  @IsUUID()
  id!: string;

  @IsOptional()
  @IsDateString({ strict: true })
  watchedAt!: string | null;
}

class ViewingHistoryDateDto {
  @IsUUID()
  id!: string;

  @IsOptional()
  @IsString()
  watchedDate!: string | null;
}

export class SaveViewingHistoryDto {
  @IsIn(['movie', 'episode'])
  contentType!: 'movie' | 'episode';

  @IsInt()
  @Min(1)
  tmdbId!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  seasonNumber?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  episodeNumber?: number;

  @IsString()
  timeZone!: string;

  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => ViewingHistoryItemDto)
  previous!: ViewingHistoryItemDto[];

  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => ViewingHistoryDateDto)
  entries!: ViewingHistoryDateDto[];
}
