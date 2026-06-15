import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class BpmnValidationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comment?: string;
}
