import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AiProvider, AiProviderRequest, AiProviderResponse } from './ai-provider.interface';

@Injectable()
export class AzureOpenAiProvider implements AiProvider {
  constructor(private readonly config: ConfigService) {}

  async generate(request: AiProviderRequest): Promise<AiProviderResponse> {
    const endpoint = this.config.get<string>('AZURE_OPENAI_ENDPOINT');
    const deployment = this.config.get<string>('AZURE_OPENAI_DEPLOYMENT');
    const apiVersion = this.config.get<string>('AZURE_OPENAI_API_VERSION') ?? '2024-02-15-preview';
    const apiKey =
      this.config.get<string>('AZURE_OPENAI_API_KEY') ?? this.config.get<string>('AI_API_KEY');
    if (!endpoint || !deployment || !apiKey) {
      throw new ServiceUnavailableException('Provider Azure OpenAI non configure.');
    }

    const response = await fetch(
      `${endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`,
      {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: request.systemPrompt },
            { role: 'user', content: request.userPrompt },
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' },
        }),
      },
    );
    if (!response.ok) {
      throw new ServiceUnavailableException('Generation Azure OpenAI echouee.');
    }
    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      model?: string;
    };
    return {
      provider: 'azure-openai',
      model: payload.model ?? deployment,
      rawText: payload.choices?.[0]?.message?.content ?? '{}',
    };
  }
}
