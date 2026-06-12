import { IsNumber, Max, Min } from 'class-validator';

export class RatingScoreDto {
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0.5)
  @Max(5)
  score!: number;
}
