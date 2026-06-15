import { RaciRole } from '../../../generated/prisma';

export type RaciValidationStatus = 'DRAFT' | 'VALIDATED' | 'INVALIDATED';

export type RaciActor = {
  id: string;
  name: string;
  title?: string | null;
  directionId?: string | null;
  isPlatformUser?: boolean;
};

export type RaciActivity = {
  id: string;
  name: string;
  activityType?: string | null;
  isAutomated?: boolean;
};

export type RaciCell = {
  activityId: string;
  actorId: string;
  roles: RaciRole[];
};

export type RaciIssue = {
  code: string;
  message: string;
  severity: 'blocking' | 'warning';
  activityId?: string;
  actorId?: string;
};

export type RaciMatrix = {
  activities: RaciActivity[];
  actors: RaciActor[];
  cells: RaciCell[];
};

export type RaciResult = {
  ruleVersion: string;
  matrix: RaciMatrix;
  blockingIssues: RaciIssue[];
  warnings: RaciIssue[];
  recommendations: string[];
  qualityScore: number;
  validationStatus: RaciValidationStatus;
  versionNumber: number;
  generatedAt: string;
  sourceHash: string;
  canValidate: boolean;
};
