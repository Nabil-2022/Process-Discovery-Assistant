import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class RaciResponsibilityItemDto {
  @ApiProperty()
  @IsUUID()
  activity_id!: string;

  @ApiProperty()
  @IsUUID()
  actor_id!: string;

  @ApiProperty({ enum: ['RESPONSIBLE', 'ACCOUNTABLE', 'CONSULTED', 'INFORMED'] })
  @IsIn(['RESPONSIBLE', 'ACCOUNTABLE', 'CONSULTED', 'INFORMED'])
  raci_role!: 'RESPONSIBLE' | 'ACCOUNTABLE' | 'CONSULTED' | 'INFORMED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateRaciResponsibilitiesDto {
  @ApiProperty({ type: [RaciResponsibilityItemDto] })
  @IsArray()
  items!: RaciResponsibilityItemDto[];
}

export class RaciValidationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;
}
