export interface ApiSettings {
    api_key: string;
    base_url: string;
    model_name: string;
}

const STORAGE_KEY = 'fdm_ai_api_settings';

export const DEFAULT_API_SETTINGS: ApiSettings = {
    api_key: '',
    base_url: 'https://open.bigmodel.cn/api/paas/v4/',
    model_name: 'glm-4-flash'
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
