import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsTimeZone,
  IsUUID,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const subscriptionStatuses = [
  'trial',
  'active',
  'past_due',
  'suspended',
  'cancelled',
  'expired',
] as const;

export class ListTenantsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'SUSPENDED', 'ARCHIVED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'SUSPENDED', 'ARCHIVED'])
  status?: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

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

  @ApiPropertyOptional({ enum: ['name', 'created_at', 'updated_at', 'status'] })
  @IsOptional()
  @IsIn(['name', 'created_at', 'updated_at', 'status'])
  sort?: 'name' | 'created_at' | 'updated_at' | 'status';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}

export class CreateTenantDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @ApiProperty()
  @IsString()
  organization_type!: string;

  @ApiProperty()
  @IsString()
  country!: string;

  @ApiProperty()
  @IsString()
  city!: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'SUSPENDED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'SUSPENDED'])
  status?: 'ACTIVE' | 'SUSPENDED';

  @ApiPropertyOptional({ default: 'fr' })
  @IsOptional()
  @IsString()
  primary_language?: string;

  @ApiProperty()
  @IsTimeZone()
  timezone!: string;

  @ApiProperty()
  @IsString()
  plan!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  internal_notes?: string;
}

export class UpdateTenantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organization_type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  primary_language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsTimeZone()
  timezone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  internal_notes?: string;
}

export class ReasonDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class InitialTenantAdminDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  full_name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ default: 'fr' })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  invitation_message?: string;
}

export class ApplyTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  template_version_id?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  dry_run?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  overwrite_customizations?: boolean;
}

export class TenantFeatureUpdateDto {
  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class UpdateTenantFeaturesDto {
  @ApiProperty({ type: [TenantFeatureUpdateDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TenantFeatureUpdateDto)
  features!: TenantFeatureUpdateDto[];
}

export class UpdateSubscriptionDto {
  @ApiProperty()
  @IsString()
  plan!: string;

  @ApiProperty({ enum: subscriptionStatuses })
  @IsIn(subscriptionStatuses)
  status!: (typeof subscriptionStatuses)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  starts_at?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  ends_at?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  allowed_users?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  allowed_directions?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  allowed_processes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  options?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  internal_notes?: string;
}

export class CreateSupportAccessGrantDto {
  @ApiProperty()
  @IsUUID()
  tenant_id!: string;

  @ApiProperty()
  @IsUUID()
  support_user_id!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  reason!: string;

  @ApiProperty()
  @IsObject()
  scope!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  permissions?: string[];

  @ApiProperty()
  @IsDateString()
  valid_from!: string;

  @ApiProperty()
  @IsDateString()
  expires_at!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  authorized_by_id?: string;
}

export class RevokeSupportAccessGrantDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  reason!: string;
}

export class AdminAuditQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tenant_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
