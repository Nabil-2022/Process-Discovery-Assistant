import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { TenantAccessGuard } from './guards/tenant-access.guard';
import { AiController } from './ai.controller';
import { ActivityController } from './activity.controller';
import { BpmnController } from './bpmn.controller';
import { ExportController } from './export.controller';
import { MoroccoComplianceController } from './morocco-compliance.controller';
import { ProcessController } from './process.controller';
import { ProcedureController } from './procedure.controller';
import { RaciController } from './raci.controller';
import { WorkshopController } from './workshop.controller';
import { CompletenessService } from './services/completeness.service';
import { BpmnService } from './services/bpmn.service';
import { BpmnXmlBuilder } from './services/bpmn-xml.builder';
import { MoroccoComplianceService } from './services/morocco-compliance.service';
import { ProcessService } from './services/process.service';
import { ProcedureService } from './services/procedure.service';
import { RaciService } from './services/raci.service';
import { TenantController } from './tenant.controller';
import { TenantService } from './services/tenant.service';
import { WorkshopService } from './services/workshop.service';
import { TenantAiService } from './services/ai.service';
import { ActivityService } from './services/activity.service';
import { AzureOpenAiProvider } from './services/azure-openai.provider';
import { ExportService } from './services/export.service';
import { MockAiProvider } from './services/mock-ai.provider';

@Module({
  imports: [AuthModule, PrismaModule, StorageModule],
  controllers: [
    TenantController,
    ProcessController,
    MoroccoComplianceController,
    RaciController,
    BpmnController,
    WorkshopController,
    AiController,
    ProcedureController,
    ExportController,
    ActivityController,
  ],
  providers: [
    TenantAccessGuard,
    TenantService,
    ProcessService,
    CompletenessService,
    MoroccoComplianceService,
    RaciService,
    BpmnService,
    BpmnXmlBuilder,
    WorkshopService,
    TenantAiService,
    MockAiProvider,
    AzureOpenAiProvider,
    ProcedureService,
    ExportService,
    ActivityService,
  ],
})
export class TenantModule {}
