import { createHash } from 'crypto';

import { RaciRole } from '../../../generated/prisma';
import { RaciActor, RaciActivity, RaciCell, RaciIssue, RaciMatrix } from './raci.types';

export const RACI_RULE_VERSION = 'process-discovery-raci-v1';

export type RaciRuleInput = {
  activities: RaciActivity[];
  actors: RaciActor[];
  cells: RaciCell[];
  isUserFacingProcess?: boolean;
  law5519Applicable?: boolean;
  hasCourtOfAccountsRisk?: boolean;
  hasFinancialRisk?: boolean;
  hasProcessOwner?: boolean;
};

export function buildRaciMatrix(input: RaciRuleInput): RaciMatrix {
  const activities = [...input.activities].sort((a, b) => a.name.localeCompare(b.name));
  const actors = [...input.actors].sort((a, b) => a.name.localeCompare(b.name));
  const cells = [...input.cells]
    .map((cell) => ({ ...cell, roles: [...new Set(cell.roles)].sort() as RaciRole[] }))
    .sort((a, b) => `${a.activityId}:${a.actorId}`.localeCompare(`${b.activityId}:${b.actorId}`));
  return { activities, actors, cells };
}

export function evaluateRaci(input: RaciRuleInput) {
  const matrix = buildRaciMatrix(input);
  const blockingIssues: RaciIssue[] = [];
  const warnings: RaciIssue[] = [];
  const recommendations = new Set<string>();
  const activityIds = new Set(matrix.activities.map((activity) => activity.id));
  const actorIds = new Set(matrix.actors.map((actor) => actor.id));

  if (!matrix.activities.length) {
    blockingIssues.push({
      code: 'missing_activities',
      message: 'Aucune activite declaree pour construire la matrice RACI.',
      severity: 'blocking',
    });
  }
  if (!matrix.actors.length) {
    blockingIssues.push({
      code: 'missing_actors',
      message: 'Aucun acteur declare pour construire la matrice RACI.',
      severity: 'blocking',
    });
  }

  for (const cell of matrix.cells) {
    if (!activityIds.has(cell.activityId)) {
      blockingIssues.push({
        code: 'deleted_activity_referenced',
        message: 'Une responsabilite reference une activite supprimee.',
        severity: 'blocking',
        activityId: cell.activityId,
        actorId: cell.actorId,
      });
    }
    if (!actorIds.has(cell.actorId)) {
      blockingIssues.push({
        code: 'deleted_actor_referenced',
        message: 'Une responsabilite reference un acteur supprime.',
        severity: 'blocking',
        activityId: cell.activityId,
        actorId: cell.actorId,
      });
    }
    for (const role of cell.roles) {
      if (!Object.values(RaciRole).includes(role)) {
        blockingIssues.push({
          code: 'invalid_raci_role',
          message: 'Un role RACI invalide est reference.',
          severity: 'blocking',
          activityId: cell.activityId,
          actorId: cell.actorId,
        });
      }
    }
  }

  for (const activity of matrix.activities) {
    const activityCells = matrix.cells.filter((cell) => cell.activityId === activity.id);
    const responsible = activityCells.filter((cell) => cell.roles.includes(RaciRole.RESPONSIBLE));
    const accountable = activityCells.filter((cell) => cell.roles.includes(RaciRole.ACCOUNTABLE));
    const consulted = activityCells.filter((cell) => cell.roles.includes(RaciRole.CONSULTED));
    const informed = activityCells.filter((cell) => cell.roles.includes(RaciRole.INFORMED));
    if (!responsible.length) {
      blockingIssues.push({
        code: 'missing_responsible',
        message: `Activite sans Responsible: ${activity.name}.`,
        severity: 'blocking',
        activityId: activity.id,
      });
    }
    if (!accountable.length) {
      blockingIssues.push({
        code: 'missing_accountable',
        message: `Activite sans Accountable: ${activity.name}.`,
        severity: 'blocking',
        activityId: activity.id,
      });
    }
    if (accountable.length > 1) {
      warnings.push({
        code: 'multiple_accountable',
        message: `Plusieurs Accountable sur l'activite: ${activity.name}.`,
        severity: 'warning',
        activityId: activity.id,
      });
      recommendations.add("Verifier qu'un seul Accountable porte la decision finale.");
    }
    for (const cell of activityCells) {
      if (cell.roles.includes(RaciRole.RESPONSIBLE) && cell.roles.includes(RaciRole.ACCOUNTABLE)) {
        warnings.push({
          code: 'same_actor_responsible_accountable',
          message: `Le meme acteur est Responsible et Accountable sur: ${activity.name}.`,
          severity: 'warning',
          activityId: activity.id,
          actorId: cell.actorId,
        });
        recommendations.add('Verifier la coherence entre le process owner et les Accountable.');
      }
    }
    if (consulted.length > 5) {
      warnings.push({
        code: 'too_many_consulted',
        message: `Trop d'acteurs Consulted sur: ${activity.name}.`,
        severity: 'warning',
        activityId: activity.id,
      });
      recommendations.add(
        'Limiter le nombre de personnes Consulted pour eviter les circuits trop longs.',
      );
    }
    if (informed.length > 8) {
      warnings.push({
        code: 'too_many_informed',
        message: `Trop d'acteurs Informed sur: ${activity.name}.`,
        severity: 'warning',
        activityId: activity.id,
      });
    }
    if (isCritical(activity) && !consulted.length) {
      warnings.push({
        code: 'critical_activity_without_consulted',
        message: `Activite critique sans Consulted: ${activity.name}.`,
        severity: 'warning',
        activityId: activity.id,
      });
      recommendations.add('Ajouter au moins un Consulted pour les activites critiques.');
    }
    const externalAccountable = accountable.find((cell) => {
      const actor = matrix.actors.find((item) => item.id === cell.actorId);
      return actor && !actor.isPlatformUser && !actor.directionId;
    });
    if (externalAccountable) {
      warnings.push({
        code: 'external_accountable',
        message: `Acteur externe Accountable sur: ${activity.name}.`,
        severity: 'warning',
        activityId: activity.id,
        actorId: externalAccountable.actorId,
      });
    }
  }

  const hasInternalAccountable = matrix.cells.some((cell) => {
    if (!cell.roles.includes(RaciRole.ACCOUNTABLE)) return false;
    const actor = matrix.actors.find((item) => item.id === cell.actorId);
    return Boolean(actor?.isPlatformUser || actor?.directionId);
  });

  if (input.isUserFacingProcess) {
    if (!hasInternalAccountable) {
      warnings.push({
        code: 'user_facing_without_clear_internal_accountable',
        message: 'Processus usager sans Accountable interne clairement identifie.',
        severity: 'warning',
      });
    }
    recommendations.add('Clarifier les responsabilites des activites liees a un processus usager.');
  }
  if (input.law5519Applicable && !input.hasProcessOwner) {
    warnings.push({
      code: 'law_55_19_without_process_owner',
      message: 'Processus Loi 55-19 sans proprietaire metier clair.',
      severity: 'warning',
    });
  }
  if (input.hasFinancialRisk && !hasInternalAccountable) {
    warnings.push({
      code: 'financial_risk_without_internal_accountable',
      message: 'Processus a risque financier sans Accountable interne.',
      severity: 'warning',
    });
    recommendations.add('Identifier un responsable interne pour les activites a risque financier.');
  }
  if (input.hasCourtOfAccountsRisk) {
    warnings.push({
      code: 'public_audit_responsibility_control_check',
      message: 'Risque audit public: verifier la clarte des responsabilites de controle.',
      severity: 'warning',
    });
  }

  const totalChecks = Math.max(matrix.activities.length * 2, 1);
  const missingRequired = blockingIssues.filter((issue) =>
    ['missing_responsible', 'missing_accountable'].includes(issue.code),
  ).length;
  const score = Math.max(0, Math.round(((totalChecks - missingRequired) / totalChecks) * 100));
  return {
    matrix,
    blockingIssues,
    warnings,
    recommendations: [...recommendations],
    qualityScore: Math.max(0, score - Math.min(warnings.length * 3, 25)),
  };
}

export function raciSourceHash(input: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(stable(input)))
    .digest('hex');
}

function isCritical(activity: RaciActivity) {
  const value = `${activity.name} ${activity.activityType ?? ''}`.toLowerCase();
  return value.includes('critique') || value.includes('controle') || value.includes('validation');
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = stable((value as Record<string, unknown>)[key]);
      return acc;
    }, {});
}
