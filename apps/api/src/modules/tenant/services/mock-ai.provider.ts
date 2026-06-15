import { Injectable } from '@nestjs/common';

import { AiProvider, AiProviderRequest, AiProviderResponse } from './ai-provider.interface';

@Injectable()
export class MockAiProvider implements AiProvider {
  async generate(request: AiProviderRequest): Promise<AiProviderResponse> {
    const typeMatch = request.userPrompt.match(/generationType:\s*([a-z_]+)/);
    const generationType = typeMatch?.[1] ?? 'improvement_suggestions';
    return {
      provider: 'mock-ai',
      model: 'mock-deterministic-v1',
      rawText: JSON.stringify({
        summary: `Suggestion IA mock pour ${generationType}.`,
        findings: [
          {
            type: 'recommendation',
            title: 'Verifier les donnees source',
            description: 'Constat base sur le contexte structure fourni au copilote.',
            sourceData: 'process_context',
            confidence: 'medium',
            requiresHumanValidation: true,
          },
        ],
        suggestions: [
          {
            category: generationType,
            title: `Action proposee - ${generationType}`,
            description:
              'Brouillon separe des donnees officielles, a accepter ou modifier humainement.',
            targetEntity: targetFor(generationType),
            priority: 'medium',
            rationale: 'Proposition issue du contexte minimal autorise.',
          },
        ],
        limitations: ['Mock provider utilise pour tests et environnements sans Azure OpenAI.'],
      }),
    };
  }
}

function targetFor(type: string) {
  if (type.includes('kpi')) return 'kpi';
  if (type.includes('risk')) return 'risk';
  if (type.includes('control')) return 'control';
  if (type.includes('procedure')) return 'procedure';
  if (type.includes('backlog') || type.includes('automation')) return 'backlog';
  return 'comment';
}
