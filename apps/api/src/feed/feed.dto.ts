import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateReviewReplyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  body!: string;

  @IsBoolean()
  @IsOptional()
  containsSpoilers?: boolean;
}
