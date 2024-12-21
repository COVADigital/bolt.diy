import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { ollama } from 'ollama-ai-provider';

interface OllamaModelDetails {
    parent_model: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
}

export interface OllamaModel {
    name: string;
    model: string;
    modified_at: string;
    size: number;
    digest: string;
    details: OllamaModelDetails;
}

export interface OllamaApiResponse {
    models: OllamaModel[];
}

export const DEFAULT_NUM_CTX = (() => {
    const envValue = process?.env?.DEFAULT_NUM_CTX;
    if (!envValue) return 32768;
    const parsed = parseInt(envValue, 10);
    return isNaN(parsed) ? 32768 : parsed;
})();

export default class OllamaProvider extends BaseProvider {
    private readonly CONFIG = {
        baseUrlKey: 'OLLAMA_API_BASE_URL' as const,
        maxTokenAllowed: 8000,
        defaultNumCtx: DEFAULT_NUM_CTX,
    } as const;

    name = 'Ollama';
    getApiKeyLink = 'https://ollama.com/download';
    labelForGetApiKey = 'Download Ollama';
    icon = 'i-ph:cloud-arrow-down';

    config = {
        baseUrlKey: this.CONFIG.baseUrlKey,
    };

    staticModels: ModelInfo[] = [];

    async getDynamicModels(
        apiKeys?: Record<string, string>,
        settings?: IProviderSetting,
        serverEnv: Record<string, string> = {},
    ): Promise<ModelInfo[]> {
        try {
            const { baseUrl } = this.getProviderBaseUrlAndKey({
                apiKeys,
                providerSettings: settings,
                serverEnv,
                defaultBaseUrlKey: this.CONFIG.baseUrlKey,
                defaultApiTokenKey: '',
            });

            if (!baseUrl) {
                console.warn('No base URL provided for Ollama API');
                return [];
            }

            const response = await fetch(`${baseUrl}/api/tags`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = (await response.json()) as OllamaApiResponse;
            if (!data.models || !Array.isArray(data.models)) {
                throw new Error('Invalid response format from Ollama API');
            }

            return data.models.map((model: OllamaModel) => ({
                name: model.name,
                label: `${model.name} (${model.details.parameter_size})`,
                provider: this.name,
                maxTokenAllowed: this.CONFIG.maxTokenAllowed,
            }));
        } catch (error) {
            console.error('Failed to get Ollama models:', error instanceof Error ? error.message : String(error));
            return [];
        }
    }

    getModelInstance: (options: {
        model: string;
        serverEnv: Record<string, string>;
        apiKeys?: Record<string, string>;
        providerSettings?: Record<string, IProviderSetting>;
    }) => LanguageModelV1 = (options) => {
        const { apiKeys, providerSettings, serverEnv, model } = options;
        const { baseUrl } = this.getProviderBaseUrlAndKey({
            apiKeys,
            providerSettings,
            serverEnv,
            defaultBaseUrlKey: this.CONFIG.baseUrlKey,
            defaultApiTokenKey: '',
        });

        const ollamaInstance = ollama(model, {
            numCtx: this.CONFIG.defaultNumCtx,
        }) as LanguageModelV1 & { config: any };

        ollamaInstance.config.baseURL = `${baseUrl}/api`;

        return ollamaInstance;
    };
}