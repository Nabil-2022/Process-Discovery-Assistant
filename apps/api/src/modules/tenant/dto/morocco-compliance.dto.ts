import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateMoroccoComplianceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_user_facing_process?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  law_55_19_applicable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  administrative_procedure_type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  user_category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  current_channel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  target_channel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  simplification_priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  digitalization_priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  current_processing_time_days?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  target_processing_time_days?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  required_documents_count?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  requested_copies_count?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  physical_visits_required?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  fees_required?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  legal_reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  procedure_owner_entity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public_service_portal_url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observations?: string;
}

export class CreatePublicAuditRiskDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  risk_description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  risk_family?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  risk_category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cause?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  consequence?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  inherent_probability?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  inherent_impact?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  residual_probability?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  residual_impact?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  existing_controls?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  control_owner?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  action_plan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  due_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  evidence_required?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  audit_relevance?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  court_of_accounts_relevance?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  legal_or_regulatory_reference?: string;
}

export class ImportEventLogCsvDto {
  @ApiProperty()
  @IsString()
  file_name!: string;

  @ApiProperty()
  @IsString()
  content!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  delimiter?: string;
}

export class MapEventLogColumnsDto {
  @ApiProperty()
  @IsObject()
  mapping!: Record<string, string>;
}
