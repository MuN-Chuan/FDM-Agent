export interface ApiSettings {
    provider_id: string;
    model_name: string;
    is_custom: boolean;
    custom_api_key: string;
    custom_base_url: string;
    custom_provider_name: string;
}

const STORAGE_KEY = 'fdm_ai_api_settings';

export const DEFAULT_API_SETTINGS: ApiSettings = {
    provider_id: 'zhipu',
    model_name: 'glm-4.7',
    is_custom: false,
    custom_api_key: '',
    custom_base_url: '',
    custom_provider_name: ''
};

export function loadApiSettings(): ApiSettings {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return { ...DEFAULT_API_SETTINGS, ...JSON.parse(stored) };
        }
    } catch {
        // Fallback to default
    }
    return DEFAULT_API_SETTINGS;
}

export function saveApiSettings(settings: ApiSettings): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
