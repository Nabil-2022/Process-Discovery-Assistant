import { Injectable } from '@nestjs/common';

import { Prisma, ProcessStatus, RaciRole, RiskLevel } from '../../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantAccessContext } from '../guards/tenant-access.guard';
import {
  COMPLETENESS_SECTIONS,
  COMPLETENESS_THRESHOLD,
  CompletenessSectionKey,
  SCORING_RULE_VERSION,
  SECTION_MAX_POINTS,
} from './completeness-rules';
import { CompletenessResult, QualityIssue, SectionCompleteness } from './completeness.types';

export const COMPLETENESS_PROCESS_INCLUDE = {
  direction: true,
  category: true,
  ownerActor: true,
  inputs: true,
  outputs: true,
  activities: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
  transitions: true,
  actorRoles: true,
  documents: { include: { document: true } },
  applications: { include: { application: true } },
  kpis: { where: { deletedAt: null } },
  risks: { where: { deletedAt: null }, include: { controls: { include: { control: true } } } },
  moroccoCompliance: true,
  eventLogImports: { orderBy: { createdAt: 'desc' }, take: 5 },
  raciAssessments: { orderBy: { generatedAt: 'desc' }, take: 1 },
  bpmnModels: { orderBy: { generatedAt: 'desc' }, take: 1 },
  painPoints: true,
  automationNeeds: true,
} satisfies Prisma.ProcessInclude;

export type CompletenessProcess = Prisma.ProcessGetPayload<{
  include: typeof COMPLETENESS_PROCESS_INCLUDE;
}>;

type CalculateOptions = {
  hasUnresolvedConflict?: boolean;
  actorCanSubmit?: boolean;
  directionAllowed?: boolean;
};

@Injectable()
export class CompletenessService {
  constructor(private readonly prisma: PrismaService) {}

  calculate(process: CompletenessProcess, options: CalculateOptions = {}): CompletenessResult {
    const sections = this.createSections();
    const blockingIssueDetails: QualityIssue[] = [];
    const warningDetails: QualityIssue[] = [];
    const recommendations = new Set<string>();
    const addPoints = (section: CompletenessSectionKey, points: number, ok: boolean) => {
      if (ok) sections.get(section)!.pointsObtained += points;
    };
    const missing = (section: CompletenessSectionKey, field: string) => {
      sections.get(section)!.missingFields.push(field);
    };
    const block = (section: CompletenessSectionKey, code: string, message: string) => {
      const issue = this.issue(section, code, message, 'blocking');
      blockingIssueDetails.push(issue);
      sections.get(section)!.blockingIssues.push(issue);
    };
    const warn = (section: CompletenessSectionKey, code: string, message: string) => {
      const issue = this.issue(section, code, message, 'warning');
      warningDetails.push(issue);
      sections.get(section)!.warnings.push(issue);
    };
    const recommend = (section: CompletenessSectionKey, message: string) => {
      recommendations.add(message);
      sections.get(section)!.recommendations.push(message);
    };

    addPoints('identification', 3, this.present(process.name));
    if (!this.present(process.name)) missing('identification', 'name');
    addPoints('identification', 3, this.present(process.directionId));
    if (!this.present(process.directionId)) {
      missing('identification', 'direction_id');
      block('identification', 'missing_direction', 'Direction absente.');
    }
    addPoints('identification', 4, this.present(process.processOwnerActorId));
    if (!this.present(process.processOwnerActorId)) {
      missing('identification', 'process_owner_actor_id');
      block('identification', 'missing_process_owner', 'Proprietaire metier absent.');
    }

    addPoints('objective_scope', 6, this.present(process.objective));
    if (!this.present(process.objective)) {
      missing('objective_scope', 'objective');
      block('objective_scope', 'missing_objective', 'Objectif absent.');
    }
    addPoints('objective_scope', 6, this.present(process.scope));
    if (!this.present(process.scope)) {
      missing('objective_scope', 'scope');
      block('objective_scope', 'missing_scope', 'Perimetre absent.');
    }

    addPoints('inputs_outputs', 5, process.inputs.length > 0);
    if (!process.inputs.length) {
      missing('inputs_outputs', 'inputs');
      block('inputs_outputs', 'missing_input', 'Aucune entree declaree.');
    }
    addPoints('inputs_outputs', 5, process.outputs.length > 0);
    if (!process.outputs.length) {
      missing('inputs_outputs', 'outputs');
      block('inputs_outputs', 'missing_output', 'Aucune sortie declaree.');
    }

    addPoints('activities_sequence', 4, process.activities.length > 0);
    if (!process.activities.length) {
      missing('activities_sequence', 'activities');
      block('activities_sequence', 'missing_activity', 'Aucune activite declaree.');
    }
    const activitiesHaveName = process.activities.every((activity) => this.present(activity.name));
    addPoints('activities_sequence', 4, activitiesHaveName);
    if (!activitiesHaveName) {
      missing('activities_sequence', 'activity.name');
      block('activities_sequence', 'activity_without_name', 'Une activite est sans nom.');
    }
    const activitiesHaveOutput = process.activities.every((activity) =>
      this.present(activity.outputText),
    );
    addPoints('activities_sequence', 4, activitiesHaveOutput);
    if (!activitiesHaveOutput && process.activities.length) {
      missing('activities_sequence', 'activity.output_text');
      block(
        'activities_sequence',
        'activity_without_output',
        'Une activite est sans sortie ou resultat.',
      );
    }
    const coherentSequence = this.hasCoherentSequence(process);
    addPoints('activities_sequence', 4, coherentSequence);
    if (!coherentSequence) {
      block(
        'activities_sequence',
        'sequence_incoherent',
        "Sequence d'activites incoherente ou activite orpheline.",
      );
    }
    if (process.activities.some((activity) => !this.present(activity.duration))) {
      warn('activities_sequence', 'activity_without_duration', 'Activite sans delai indicatif.');
      recommend('activities_sequence', 'Completer les delais indicatifs des activites.');
    }
    const bpmnModel = process.bpmnModels?.[0];
    if (!bpmnModel && process.activities.length) {
      warn('activities_sequence', 'bpmn_not_generated', 'BPMN non genere pour ce processus.');
      recommend('activities_sequence', 'Generer le modele BPMN deterministe avant validation.');
    }
    if (bpmnModel) {
      const bpmnIssues = this.jsonArray<{ code?: string; message?: string }>(
        bpmnModel.blockingIssues,
      );
      for (const issue of bpmnIssues) {
        if (
          [
            'orphan_activity',
            'transition_from_missing',
            'transition_to_missing',
            'conditional_branch_without_target',
          ].includes(issue.code ?? '')
        ) {
          block(
            'activities_sequence',
            issue.code ?? 'bpmn_blocking_issue',
            issue.message ?? 'Blocage BPMN detecte.',
          );
        }
      }
      if (bpmnModel.validationStatus === 'INVALIDATED') {
        block('activities_sequence', 'bpmn_invalidated', 'BPMN invalide apres recalcul.');
      }
      if (bpmnModel.validationStatus !== 'VALIDATED') {
        warn('activities_sequence', 'bpmn_not_validated', 'BPMN non valide humainement.');
        recommend('activities_sequence', 'Valider le BPMN apres revue humaine.');
      } else {
        recommend('activities_sequence', 'BPMN valide: sequence structuree confirmee.');
      }
    }

    const rolesByActivity = new Map<string, RaciRole[]>();
    for (const role of process.actorRoles) {
      if (!role.activityId) continue;
      rolesByActivity.set(role.activityId, [
        ...(rolesByActivity.get(role.activityId) ?? []),
        role.raciRole,
      ]);
    }
    const hasAnyActor = process.actorRoles.length > 0 || Boolean(process.ownerActor);
    addPoints('actors_responsibilities', 4, hasAnyActor);
    if (!hasAnyActor) {
      missing('actors_responsibilities', 'actors');
      block('actors_responsibilities', 'missing_actor', 'Aucun acteur declare.');
    }
    const hasResponsible = process.activities.every((activity) =>
      rolesByActivity.get(activity.id)?.includes(RaciRole.RESPONSIBLE),
    );
    addPoints('actors_responsibilities', 5, process.activities.length > 0 && hasResponsible);
    if (!hasResponsible && process.activities.length) {
      missing('actors_responsibilities', 'responsible');
      block('actors_responsibilities', 'missing_responsible', 'Une activite est sans Responsible.');
    }
    const hasAccountable = process.activities.every((activity) =>
      rolesByActivity.get(activity.id)?.includes(RaciRole.ACCOUNTABLE),
    );
    addPoints('actors_responsibilities', 5, process.activities.length > 0 && hasAccountable);
    if (!hasAccountable && process.activities.length) {
      missing('actors_responsibilities', 'accountable');
      block('actors_responsibilities', 'missing_accountable', 'Une activite est sans Accountable.');
    }
    if (
      [...rolesByActivity.values()].some(
        (roles) => roles.filter((role) => role === RaciRole.ACCOUNTABLE).length > 1,
      )
    ) {
      warn(
        'actors_responsibilities',
        'multiple_accountable',
        'Plusieurs Accountable sur une meme activite.',
      );
      recommend(
        'actors_responsibilities',
        "Verifier la presence d'un Accountable unique par activite.",
      );
    }
    const raciStatus = process.raciAssessments?.[0]?.validationStatus;
    if (process.activities.length && raciStatus !== 'VALIDATED') {
      warn(
        'actors_responsibilities',
        'raci_not_validated',
        'La matrice RACI detaillee n est pas encore validee.',
      );
      recommend('actors_responsibilities', 'Valider la matrice RACI apres revue humaine.');
    }

    addPoints('documents', 6, process.documents.length > 0);
    if (!process.documents.length) {
      missing('documents', 'documents');
      warn('documents', 'missing_document', 'Aucun document declare.');
      recommend('documents', 'Ajouter les documents de reference du processus.');
    }
    if (process.documents.some((item) => !this.present(item.document.version))) {
      warn('documents', 'document_without_version', 'Document sans version.');
      recommend('documents', 'Preciser la version des documents lies au processus.');
    }

    addPoints('applications', 5, process.applications.length > 0);
    if (!process.applications.length) {
      missing('applications', 'applications');
      warn('applications', 'missing_application', 'Aucune application declaree.');
    }

    addPoints('kpi', 8, process.kpis.length > 0);
    if (!process.kpis.length) {
      missing('kpi', 'kpis');
      warn('kpi', 'missing_kpi', 'Aucun KPI declare.');
      recommend('kpi', 'Ajouter au moins un KPI pour mesurer la performance du processus.');
    }
    if (process.kpis.some((kpi) => !this.present(kpi.target))) {
      warn('kpi', 'kpi_without_target', 'KPI sans cible.');
    }

    addPoints('risks', 7, process.risks.length > 0);
    if (!process.risks.length) {
      missing('risks', 'risks');
      warn('risks', 'missing_risk', 'Aucun risque declare.');
    }
    if (process.risks.some((risk) => !this.present(risk.treatmentPlan))) {
      warn('risks', 'risk_without_treatment_plan', 'Risque sans plan de traitement.');
    }

    const controlledRiskIds = new Set(
      process.risks.flatMap((risk) => risk.controls.map((control) => control.riskId)),
    );
    const allRisksControlled =
      process.risks.length > 0 && process.risks.every((risk) => controlledRiskIds.has(risk.id));
    addPoints('controls', 5, allRisksControlled);
    if (!process.risks.length || !allRisksControlled) {
      missing('controls', 'controls');
      warn('controls', 'missing_control', 'Aucun controle declare ou risque non couvert.');
      recommend('controls', 'Associer un controle aux risques critiques.');
    }
    if (
      process.risks.some(
        (risk) => risk.inherentLevel === RiskLevel.CRITICAL && !controlledRiskIds.has(risk.id),
      )
    ) {
      block('controls', 'critical_risk_without_control', 'Risque critique sans controle associe.');
    }
    if (
      process.risks.some((risk) =>
        risk.controls.some((riskControl) => !riskControl.control?.evidence),
      )
    ) {
      warn('controls', 'control_without_expected_evidence', 'Controle sans preuve attendue.');
    }

    const hasEvidence =
      process.documents.some((item) => this.present(item.document.version)) ||
      process.kpis.some((kpi) => Boolean(kpi.evidence)) ||
      process.risks.some((risk) =>
        risk.controls.some((riskControl) => Boolean(riskControl.control?.evidence)),
      );
    addPoints('validation_evidence', 7, hasEvidence);
    if (!hasEvidence) {
      missing('validation_evidence', 'evidence');
      recommend('validation_evidence', 'Ajouter au moins une preuve de validation exploitable.');
    }

    if (this.hasManualRepetitiveActivities(process) && !process.automationNeeds.length) {
      warn(
        'activities_sequence',
        'manual_repetitive_without_automation_need',
        "Activite manuelle repetitive sans besoin d'automatisation.",
      );
      recommend(
        'activities_sequence',
        "Ajouter un besoin d'automatisation si plusieurs activites sont manuelles et repetitives.",
      );
    }
    if (!process.painPoints.length) {
      recommend('validation_evidence', 'Ajouter les points de douleur si connus.');
    }
    if (!process.automationNeeds.length) {
      recommend(
        'validation_evidence',
        "Documenter les opportunites d'automatisation si presentes.",
      );
    }
    if (this.isCriticalProcess(process) && !process.kpis.length) {
      warn('kpi', 'critical_process_without_kpi', 'Processus critique sans KPI.');
    }
    if (this.isCriticalProcess(process) && !process.risks.length) {
      warn('risks', 'critical_process_without_risk', 'Processus critique sans risque.');
    }
    if (this.isCriticalProcess(process) && !allRisksControlled) {
      warn('controls', 'critical_process_without_control', 'Processus critique sans controle.');
    }

    if (options.hasUnresolvedConflict) {
      block('identification', 'unresolved_edit_conflict', "Conflit d'edition non resolu.");
    }
    if (!this.isEditableForSubmission(process.status)) {
      block(
        'identification',
        'process_not_editable',
        'Processus deja dans un statut non editable.',
      );
    }
    if (options.actorCanSubmit === false) {
      block('identification', 'submit_permission_denied', 'Role non autorise a soumettre.');
    }
    if (options.directionAllowed === false) {
      block(
        'identification',
        'submit_out_of_direction_scope',
        'Processus hors perimetre direction.',
      );
    }

    const sectionList = [...sections.values()].map((section) => this.finalizeSection(section));
    const pointsObtained = sectionList.reduce((sum, section) => sum + section.pointsObtained, 0);
    const pointsMax = sectionList.reduce((sum, section) => sum + section.pointsMax, 0);
    const score = Math.round((pointsObtained / pointsMax) * 100);
    if (score < COMPLETENESS_THRESHOLD) {
      block(
        'validation_evidence',
        'score_below_threshold',
        `Score inferieur a ${COMPLETENESS_THRESHOLD} %.`,
      );
    }
    const finalSections = [...sections.values()].map((section) => this.finalizeSection(section));
    const finalBlocking = [...new Set(blockingIssueDetails.map((issue) => issue.code))];
    const finalWarnings = [...new Set(warningDetails.map((issue) => issue.code))];
    const missingFields = [...new Set(finalSections.flatMap((section) => section.missingFields))];
    const qualityStatus =
      finalBlocking.length > 0
        ? 'blocked'
        : score >= COMPLETENESS_THRESHOLD
          ? 'ready'
          : 'incomplete';

    return {
      score,
      pointsObtained,
      pointsMax,
      percentage: score,
      qualityStatus,
      sections: finalSections,
      sectionScores: Object.fromEntries(
        finalSections.map((section) => [section.key, section.pointsObtained]),
      ),
      sectionPercentages: Object.fromEntries(
        finalSections.map((section) => [section.key, section.percentage]),
      ),
      missingFields,
      blockingIssues: finalBlocking,
      blockingIssueDetails,
      warnings: finalWarnings,
      warningDetails,
      recommendations: [...recommendations],
      canSubmit: qualityStatus === 'ready',
      scoringRuleVersion: SCORING_RULE_VERSION,
      calculatedAt: new Date().toISOString(),
      sourceLockVersion: process.lockVersion,
    };
  }

  async persist(
    ctx: TenantAccessContext,
    process: CompletenessProcess,
    result: CompletenessResult,
    snapshotHash?: string,
  ) {
    await this.prisma.process.update({
      where: { id: process.id },
      data: { completenessScore: result.score },
    });
    return this.prisma.completenessAssessment.create({
      data: {
        tenantId: ctx.tenantId,
        processId: process.id,
        ruleVersion: result.scoringRuleVersion,
        globalScore: result.score,
        sectionScores: result.sectionScores as Prisma.InputJsonObject,
        sectionDetails: result.sections as unknown as Prisma.InputJsonValue,
        missingFields: result.missingFields as Prisma.InputJsonValue,
        blockingIssues: result.blockingIssues as Prisma.InputJsonValue,
        warnings: result.warnings as Prisma.InputJsonValue,
        recommendations: result.recommendations as Prisma.InputJsonValue,
        canSubmit: result.canSubmit,
        qualityStatus: result.qualityStatus,
        calculatedBy: ctx.actorUserId,
        sourceLockVersion: process.lockVersion,
        snapshotHash,
      },
    });
  }

  private createSections() {
    return new Map<CompletenessSectionKey, SectionCompleteness>(
      COMPLETENESS_SECTIONS.map((section) => [
        section.key,
        {
          key: section.key,
          label: section.label,
          wizardStep: section.wizardStep,
          pointsObtained: 0,
          pointsMax: section.maxPoints,
          percentage: 0,
          status: 'incomplete',
          missingFields: [],
          blockingIssues: [],
          warnings: [],
          recommendations: [],
        },
      ]),
    );
  }

  private finalizeSection(section: SectionCompleteness): SectionCompleteness {
    const pointsObtained = Math.min(section.pointsObtained, SECTION_MAX_POINTS[section.key]);
    const percentage = Math.round((pointsObtained / section.pointsMax) * 100);
    return {
      ...section,
      pointsObtained,
      percentage,
      status: section.blockingIssues.length
        ? 'error'
        : section.warnings.length
          ? 'warning'
          : percentage >= 100
            ? 'complete'
            : 'incomplete',
    };
  }

  private issue(
    section: CompletenessSectionKey,
    code: string,
    message: string,
    severity: 'blocking' | 'warning',
  ): QualityIssue {
    const sectionRule = COMPLETENESS_SECTIONS.find((item) => item.key === section)!;
    return { code, message, section, severity, wizardStep: sectionRule.wizardStep };
  }

  private hasCoherentSequence(process: CompletenessProcess) {
    if (process.activities.length <= 1) return true;
    if (!process.transitions.length) return false;
    const ids = new Set(process.activities.map((activity) => activity.id));
    const connected = new Set<string>();
    for (const transition of process.transitions) {
      if (transition.fromActivityId && ids.has(transition.fromActivityId))
        connected.add(transition.fromActivityId);
      if (transition.toActivityId && ids.has(transition.toActivityId))
        connected.add(transition.toActivityId);
    }
    return process.activities.every((activity) => connected.has(activity.id));
  }

  private hasManualRepetitiveActivities(process: CompletenessProcess) {
    return process.activities.filter((activity) => !activity.isAutomated).length >= 2;
  }

  private jsonArray<T>(value: unknown): T[] {
    return Array.isArray(value) ? (value as T[]) : [];
  }

  private isCriticalProcess(process: CompletenessProcess) {
    return (
      process.applications.some((item) => item.application.criticality === RiskLevel.CRITICAL) ||
      process.risks.some((risk) => risk.inherentLevel === RiskLevel.CRITICAL) ||
      process.category?.code?.toLowerCase().includes('critical') ||
      process.category?.name.toLowerCase().includes('critique')
    );
  }

  private isEditableForSubmission(status: ProcessStatus) {
    const editableStatuses: ProcessStatus[] = [
      ProcessStatus.DRAFT,
      ProcessStatus.IN_PROGRESS,
      ProcessStatus.CHANGES_REQUESTED,
      ProcessStatus.RESUBMITTED,
    ];
    return editableStatuses.includes(status);
  }

  private present(value: unknown) {
    return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
  }
}
