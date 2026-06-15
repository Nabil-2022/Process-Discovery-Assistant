export type AiProviderRequest = {
  systemPrompt: string;
  userPrompt: string;
  responseFormat: 'json';
};

export type AiProviderResponse = {
  provider: string;
  model?: string;
  rawText: string;
};

export interface AiProvider {
  generate(request: AiProviderRequest): Promise<AiProviderResponse>;
}
