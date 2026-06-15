import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min, MinLength } from 'class-validator';

export class TenantDashboardQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  campaign_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  direction_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  period?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  process_status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  category_id?: string;
}

export class ListDirectionsQueryDto extends TenantDashboardQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page_size?: number;
}

export class CreateDirectionDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:_[a-z0-9]+)*$/)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parent_id?: string;
}

export class UpdateDirectionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[a-z0-9]+(?:_[a-z0-9]+)*$/)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;
}

export class AssignReferentDto {
  @ApiProperty()
  @IsUUID()
  user_id!: string;
}

export class RemindReferentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;
}
