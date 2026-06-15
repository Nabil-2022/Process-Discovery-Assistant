import { Prisma } from '../../../generated/prisma';

export type ProcedureSectionDefinition = {
  key: string;
  title: string;
  order: number;
  content: Prisma.InputJsonValue;
  source: 'deterministic' | 'manual' | 'ai' | 'validated' | 'published';
  status: 'draft' | 'ready' | 'changes_requested' | 'approved' | 'published';
};

export type ProcedureDeterministicResult = {
  reference: string;
  title: string;
  ruleVersion: string;
  sourceHash: string;
  isoNotice: string;
  sections: ProcedureSectionDefinition[];
  backlog: { title: string; type: string; priority: string; source: string }[];
};
