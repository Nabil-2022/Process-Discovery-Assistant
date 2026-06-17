import { IsIn, IsObject, IsOptional, IsUUID } from 'class-validator';

export const EXPORT_TYPES = [
  'process_sheet',
  'procedure',
  'raci_matrix',
  'bpmn_diagram',
  'risk_register',
  'kpi_register',
  'backlog',
  'direction_summary',
  'executive_summary',
  'morocco_compliance',
  'process_mining_report',
  'audit_extract',
  'full_package',
] as const;

export const EXPORT_FORMATS = ['pdf', 'docx', 'xlsx', 'json', 'bpmn_xml', 'zip', 'csv'] as const;

export type ExportType = (typeof EXPORT_TYPES)[number];
export type ExportFormatDto = (typeof EXPORT_FORMATS)[number];

export class CreateExportDto {
  @IsIn(EXPORT_TYPES)
  export_type!: ExportType;

  @IsIn(EXPORT_FORMATS)
  export_format!: ExportFormatDto;

  @IsOptional()
  @IsUUID()
  process_id?: string;

  @IsOptional()
  @IsUUID()
  direction_id?: string;

  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>;
}

export class RetryExportDto {
  @IsOptional()
  @IsObject()
  parameters?: Record<string, unknown>;
}
