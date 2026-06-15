export const SCORING_RULE_VERSION = 'process-discovery-completeness-v1';
export const COMPLETENESS_THRESHOLD = 80;

export const COMPLETENESS_SECTIONS = [
  { key: 'identification', label: 'Identification', maxPoints: 10, wizardStep: 1 },
  { key: 'objective_scope', label: 'Objectif et perimetre', maxPoints: 12, wizardStep: 2 },
  { key: 'inputs_outputs', label: 'Entrees et sorties', maxPoints: 10, wizardStep: 2 },
  { key: 'activities_sequence', label: 'Activites et sequence', maxPoints: 16, wizardStep: 3 },
  {
    key: 'actors_responsibilities',
    label: 'Acteurs et responsabilites',
    maxPoints: 14,
    wizardStep: 4,
  },
  { key: 'documents', label: 'Documents', maxPoints: 6, wizardStep: 5 },
  { key: 'applications', label: 'Applications', maxPoints: 5, wizardStep: 6 },
  { key: 'kpi', label: 'KPI', maxPoints: 8, wizardStep: 7 },
  { key: 'risks', label: 'Risques', maxPoints: 7, wizardStep: 8 },
  { key: 'controls', label: 'Controles', maxPoints: 5, wizardStep: 8 },
  { key: 'validation_evidence', label: 'Validation et preuves', maxPoints: 7, wizardStep: 11 },
] as const;

export type CompletenessSectionKey = (typeof COMPLETENESS_SECTIONS)[number]['key'];

export const SECTION_MAX_POINTS = COMPLETENESS_SECTIONS.reduce(
  (acc, section) => ({ ...acc, [section.key]: section.maxPoints }),
  {} as Record<CompletenessSectionKey, number>,
);
