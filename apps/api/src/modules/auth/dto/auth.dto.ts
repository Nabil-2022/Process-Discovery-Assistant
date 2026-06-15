import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'user@example.test' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'example-password-not-real' })
  @IsString()
  password!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tenant_slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tenant_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  remember_me?: boolean;
}

export class SelectTenantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tenant_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tenant_slug?: string;
}

export class RefreshDto {
  @ApiPropertyOptional({ description: 'Fallback for non-browser clients. Prefer HttpOnly cookie.' })
  @IsOptional()
  @IsString()
  refresh_token?: string;
}

export class InviteUserDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  full_name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tenant_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  direction_id?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  role_codes?: string[];
}

export class AcceptInvitationDto {
  @ApiProperty()
  @IsString()
  token!: string;

  @ApiProperty()
  @IsString()
  password!: string;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  token!: string;

  @ApiProperty()
  @IsString()
  new_password!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  current_password!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  new_password!: string;
}
