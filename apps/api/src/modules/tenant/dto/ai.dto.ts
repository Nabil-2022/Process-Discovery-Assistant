import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export const AI_GENERATION_TYPES = [
  'inconsistency_detection',
  'kpi_suggestions',
  'risk_suggestions',
  'control_suggestions',
  'improvement_suggestions',
  'automation_suggestions',
  'procedure_draft',
  'user_stories',
  'backlog_suggestions',
  'direction_summary',
  'executive_summary',
  'morocco_compliance_review',
  'public_audit_review',
  'process_mining_interpretation',
] as const;

export type AiGenerationType = (typeof AI_GENERATION_TYPES)[number];

export class AiGenerateDto {
  @IsIn(AI_GENERATION_TYPES)
  generation_type!: AiGenerationType;
}

export class AiModifySuggestionDto {
  @IsObject()
  content!: Record<string, unknown>;
}

export class AiApplySuggestionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
