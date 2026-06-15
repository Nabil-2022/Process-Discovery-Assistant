import { CompletenessSectionKey } from './completeness-rules';

export type QualitySeverity = 'blocking' | 'warning' | 'recommendation';
export type SectionStatus = 'complete' | 'incomplete' | 'warning' | 'error';
export type QualityStatus = 'ready' | 'blocked' | 'incomplete';

export type QualityIssue = {
  code: string;
  message: string;
  section: CompletenessSectionKey;
  severity: QualitySeverity;
  wizardStep: number;
};

export type SectionCompleteness = {
  key: CompletenessSectionKey;
  label: string;
  wizardStep: number;
  pointsObtained: number;
  pointsMax: number;
  percentage: number;
  status: SectionStatus;
  missingFields: string[];
  blockingIssues: QualityIssue[];
  warnings: QualityIssue[];
  recommendations: string[];
};

export type CompletenessResult = {
  score: number;
  pointsObtained: number;
  pointsMax: number;
  percentage: number;
  qualityStatus: QualityStatus;
  sections: SectionCompleteness[];
  sectionScores: Record<string, number>;
  sectionPercentages: Record<string, number>;
  missingFields: string[];
  blockingIssues: string[];
  blockingIssueDetails: QualityIssue[];
  warnings: string[];
  warningDetails: QualityIssue[];
  recommendations: string[];
  canSubmit: boolean;
  scoringRuleVersion: string;
  calculatedAt: string;
  sourceLockVersion?: number;
};
