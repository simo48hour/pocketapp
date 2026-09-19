import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

export const RECOMMENDED_MODELS: ModelInfo[] = [
  {
    name: '~google/gemini-flash-latest',
    label: 'Google Gemini Flash Latest - in:$0.75 out:$3.75 - context 1000k',
    provider: 'Recommended',
    maxTokenAllowed: 1000000,
  },
  {
    name: '~anthropic/claude-sonnet-latest',
    label: 'Anthropic Claude Sonnet Latest - in:$2.00 out:$10.00 - context 1000k',
    provider: 'Recommended',
    maxTokenAllowed: 1000000,
  },
  {
    name: 'anthropic/claude-opus-5',
    label: 'Claude Opus 5 - in:$5.00 out:$25.00 - context 1000k',
    provider: 'Recommended',
    maxTokenAllowed: 1000000,
  },
  {
    name: '~openai/gpt-latest',
    label: 'OpenAI GPT Latest - in:$2.00 out:$10.00 - context 1050k',
    provider: 'Recommended',
    maxTokenAllowed: 1000000,
  },
  {
    name: '~openai/gpt-mini-latest',
    label: 'OpenAI GPT Mini Latest - in:$0.75 out:$4.50 - context 400k',
    provider: 'Recommended',
    maxTokenAllowed: 400000,
  },
  {
    name: '~google/gemini-pro-latest',
    label: 'Google Gemini Pro Latest - in:$2.00 out:$12.00 - context 1000k',
    provider: 'Recommended',
    maxTokenAllowed: 1000000,
  },
  {
    name: 'google/gemini-2.5-flash',
    label: 'Google: Gemini 2.5 Flash - in:$0.30 out:$2.50 - context 1000k',
    provider: 'Recommended',
    maxTokenAllowed: 1000000,
  },
  {
    name: 'xiaomi/mimo-v2.5-pro',
    label: 'Xiaomi: MiMo-V2.5-Pro - in:$0.43 out:$0.87 - context 1000k',
    provider: 'Recommended',
    maxTokenAllowed: 1000000,
  },
  {
    name: 'xiaomi/mimo-v2.5',
    label: 'Xiaomi: MiMo-V2.5 - in:$0.14 out:$0.28 - context 1000k',
    provider: 'Recommended',
    maxTokenAllowed: 1000000,
  },
];

export default class RecommendedProvider extends BaseProvider {
  name = 'Recommended';
  getApiKeyLink = 'https://openrouter.ai/settings/keys';
  labelForGetApiKey = 'Get OpenRouter API Key';
  icon = 'i-ph:sparkle-fill';

  config = {
    apiTokenKey: 'OPEN_ROUTER_API_KEY',
  };

  staticModels: ModelInfo[] = RECOMMENDED_MODELS;

  async getDynamicModels(
    _apiKeys?: Record<string, string>,
    _settings?: IProviderSetting,
    _serverEnv: Record<string, string> = {},
  ): Promise<ModelInfo[]> {
    try {
      // Fetch fresh pricing & context from OpenRouter API if reachable
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return RECOMMENDED_MODELS;
      }

      const data = (await response.json()) as {
        data: Array<{
          id: string;
          name: string;
          context_length: number;
          pricing?: { prompt?: string | number; completion?: string | number };
        }>;
      };

      const targetIds = new Set(RECOMMENDED_MODELS.map((m) => m.name));
      const dynamicRecs: ModelInfo[] = [];

      for (const target of RECOMMENDED_MODELS) {
        const liveMatch = data.data.find(
          (m) => m.id === target.name || (m.id.startsWith('~') && m.id.slice(1) === target.name),
        );

        if (liveMatch) {
          const contextWindow = liveMatch.context_length || target.maxTokenAllowed;
          const maxAllowed = 1000000;
          const finalContext = Math.min(contextWindow, maxAllowed);

          const promptPrice =
            liveMatch.pricing?.prompt != null
              ? (Number(liveMatch.pricing.prompt) * 1_000_000).toFixed(2)
              : null;
          const compPrice =
            liveMatch.pricing?.completion != null
              ? (Number(liveMatch.pricing.completion) * 1_000_000).toFixed(2)
              : null;
          const pricingStr =
            promptPrice != null && compPrice != null ? ` - in:$${promptPrice} out:$${compPrice}` : '';

          dynamicRecs.push({
            name: target.name,
            label: `${liveMatch.name}${pricingStr} - context ${finalContext >= 1000000 ? Math.floor(finalContext / 1000000) + 'M' : Math.floor(finalContext / 1000) + 'k'}`,
            provider: this.name,
            maxTokenAllowed: finalContext,
          });
        } else {
          dynamicRecs.push(target);
        }
      }

      return dynamicRecs.length > 0 ? dynamicRecs : RECOMMENDED_MODELS;
    } catch {
      return RECOMMENDED_MODELS;
    }
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys: {
        ...apiKeys,
        Recommended: apiKeys?.Recommended || apiKeys?.OpenRouter || '',
      },
      providerSettings: providerSettings?.[this.name] || providerSettings?.['OpenRouter'],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'OPEN_ROUTER_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing OpenRouter API key for Recommended models`);
    }

    const openRouter = createOpenRouter({
      apiKey,
      headers: {
        'HTTP-Referer': 'https://pocketapp.dev',
        'X-Title': 'PocketApp',
      },
    });

    return openRouter.chat(model) as LanguageModelV1;
  }
}
