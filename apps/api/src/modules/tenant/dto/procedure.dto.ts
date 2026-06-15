import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class ProcedureUpdateDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  confidentiality_level?: string;
}

export class ProcedureSectionUpdateDto {
  @IsObject()
  content!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class ProcedureTransitionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
