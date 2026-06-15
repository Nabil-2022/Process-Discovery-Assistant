import { AiGenerationType } from '../dto/ai.dto';

export const AI_PROMPT_VERSION = 'ai-copilot-v1';

export function systemPrompt() {
  return [
    'Tu es un copilote IA encadre.',
    'Tu n es jamais source de verite officielle.',
    'Tu ne valides rien officiellement et tu ne modifies aucune donnee metier.',
    'Tu distingues les constats bases sur les donnees et les hypotheses.',
    'Tu proposes uniquement des elements a valider humainement.',
    'Tu restes prudent sur la conformite juridique.',
    'Tu ne dois jamais affirmer une conformite ISO ou reglementaire automatique.',
    'Pour le Maroc: Cet outil facilite la structuration, la documentation et la tracabilite. Il ne constitue pas un avis juridique et ne garantit pas a lui seul la conformite reglementaire.',
    'Reponds uniquement en JSON valide.',
  ].join('\n');
}

export function userPrompt(type: AiGenerationType, context: unknown) {
  return [
    `promptVersion: ${AI_PROMPT_VERSION}`,
    `generationType: ${type}`,
    'Format attendu:',
    '{"summary":"","findings":[{"type":"warning|recommendation|draft","title":"","description":"","sourceData":"","confidence":"low|medium|high","requiresHumanValidation":true}],"suggestions":[{"category":"","title":"","description":"","targetEntity":"kpi|risk|control|backlog|procedure|comment","priority":"low|medium|high","rationale":""}],"limitations":[]}',
    'Contexte minimal autorise:',
    JSON.stringify(context),
  ].join('\n');
}
