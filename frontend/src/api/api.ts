import type { ApiSettings } from './apiSettings';

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
export const BASE_URL = configuredBaseUrl || '';

const defaultFetchOptions: RequestInit = {
    credentials: 'include',
};

export interface DiagnosisRequest {
    detections: { label: string; confidence: number }[];
    description?: string;
    safety_constraints?: string;
    preset_data?: any;
    api_settings?: ApiSettings;
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    imageUrl?: string;
}

export interface ChatRequest {
    messages: ChatMessage[];
    image_base64?: string;
    preset_data?: any;
    api_settings?: ApiSettings;
    request_modifications?: boolean;
}

export interface Modification {
    name: string;
    category: string;
    old: string;
    new: string;
    range: string;
    reason: string;
    risk: 'low' | 'medium' | 'high';
}

export interface UserProfile {
    id: string;
    email: string;
    role: string;
    points_balance: number;
    is_active: boolean;
    created_at: string;
    last_login_at?: string | null;
}

export interface AuthResponse {
    user: UserProfile;
}

export interface RegistrationPolicy {
    mode: 'open' | 'invite_only' | 'disabled' | string;
    invite_required: boolean;
    registration_enabled: boolean;
}

export interface LoginPayload {
    email: string;
    password: string;
}

export interface EmailCodeRequestPayload {
    email: string;
}

export interface EmailCodeLoginPayload {
    email: string;
    code: string;
}

export interface RegisterPayload extends LoginPayload {
    invite_code?: string;
}

export interface EmailCodeResponse {
    message: string;
    debug_code?: string | null;
}

export interface SessionMetadata {
    id: string;
    title: string;
    timestamp: number;
}

export interface StoredMessage {
    id: string;
    role: string;
    content: string;
    thought?: string;
    modifications?: Modification[];
    isStreaming?: boolean;
    imagePreviewUrl?: string;
    attachedFiles?: { name: string; size: number }[];
    presetName?: string;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number; cache_tokens?: number };
}

export interface SessionPayload extends SessionMetadata {
    messages: StoredMessage[];
    modifications: Modification[];
    selection: any;
    bundle: any;
    presetFileName: string | null;
}

export interface DiagnosisResponse {
    reasoning_markdown: string;
    modifications: Modification[];
}

type StreamChunk = {
    type: string;
    content?: string;
    reasoning_markdown?: string;
    modifications?: Modification[];
    message?: string;
    raw?: string;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number; cache_tokens?: number };
};

async function parseStream(response: Response, onUpdate: (chunk: StreamChunk) => void): Promise<void> {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) throw new Error('ReadableStream not supported');

    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            let jsonStr = trimmedLine;
            if (trimmedLine.startsWith('data: ')) {
                jsonStr = trimmedLine.slice(6);
            } else if (trimmedLine.startsWith('data:')) {
                jsonStr = trimmedLine.slice(5);
            }

            try {
                const data = JSON.parse(jsonStr);
                onUpdate(data);
            } catch (e) {
                console.error('Failed to parse stream line:', jsonStr, e);
            }
        }
    }
}

export const api = {
    async diagnose(payload: DiagnosisRequest): Promise<DiagnosisResponse> {
        const response = await fetch(`${BASE_URL}/api/diagnose`, {
            ...defaultFetchOptions,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Diagnosis failed');
        }

        return response.json();
    },

    async diagnoseStream(payload: DiagnosisRequest, onUpdate: (chunk: StreamChunk) => void): Promise<void> {
        const response = await fetch(`${BASE_URL}/api/diagnose/stream`, {
            ...defaultFetchOptions,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Diagnosis stream failed');
        }

        await parseStream(response, onUpdate);
    },

    async chatStream(payload: ChatRequest, onUpdate: (chunk: StreamChunk) => void): Promise<void> {
        const response = await fetch(`${BASE_URL}/api/chat/stream`, {
            ...defaultFetchOptions,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Chat stream failed');
        }

        await parseStream(response, onUpdate);
    },

    async getParameterMap(slicer: string): Promise<Record<string, string[]>> {
        const response = await fetch(`${BASE_URL}/api/presets/parameter_map?slicer=${slicer}`, defaultFetchOptions);
        if (!response.ok) {
            throw new Error('Failed to fetch parameter map');
        }
        return response.json();
    },

    async getCurrentUser(): Promise<UserProfile | null> {
        const response = await fetch(`${BASE_URL}/api/auth/me`, defaultFetchOptions);
        if (response.status === 401) {
            return null;
        }
        if (!response.ok) {
            throw new Error('Failed to fetch current user');
        }
        const data: AuthResponse = await response.json();
        return data.user;
    },

    async login(payload: LoginPayload): Promise<UserProfile> {
        const response = await fetch(`${BASE_URL}/api/auth/login`, {
            ...defaultFetchOptions,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Login failed' }));
            throw new Error(error.detail || 'Login failed');
        }
        const data: AuthResponse = await response.json();
        return data.user;
    },

    async register(payload: RegisterPayload): Promise<UserProfile> {
        const response = await fetch(`${BASE_URL}/api/auth/register`, {
            ...defaultFetchOptions,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Register failed' }));
            throw new Error(error.detail || 'Register failed');
        }
        const data: AuthResponse = await response.json();
        return data.user;
    },

    async requestEmailCode(payload: EmailCodeRequestPayload): Promise<EmailCodeResponse> {
        const response = await fetch(`${BASE_URL}/api/auth/email-code/request`, {
            ...defaultFetchOptions,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Failed to send verification code' }));
            throw new Error(error.detail || 'Failed to send verification code');
        }
        return response.json();
    },

    async loginWithEmailCode(payload: EmailCodeLoginPayload): Promise<UserProfile> {
        const response = await fetch(`${BASE_URL}/api/auth/email-code/login`, {
            ...defaultFetchOptions,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Code login failed' }));
            throw new Error(error.detail || 'Code login failed');
        }
        const data: AuthResponse = await response.json();
        return data.user;
    },

    async getRegistrationPolicy(): Promise<RegistrationPolicy> {
        const response = await fetch(`${BASE_URL}/api/auth/register-policy`, defaultFetchOptions);
        if (!response.ok) {
            throw new Error('Failed to fetch registration policy');
        }
        return response.json();
    },

    async logout(): Promise<void> {
        const response = await fetch(`${BASE_URL}/api/auth/logout`, {
            ...defaultFetchOptions,
            method: 'POST',
        });
        if (!response.ok) {
            throw new Error('Logout failed');
        }
    },

    async listChatSessions(): Promise<SessionMetadata[]> {
        const response = await fetch(`${BASE_URL}/api/chat/sessions`, defaultFetchOptions);
        if (response.status === 401) {
            throw new Error('UNAUTHORIZED');
        }
        if (!response.ok) {
            throw new Error('Failed to fetch chat sessions');
        }
        return response.json();
    },

    async getChatSession(id: string): Promise<SessionPayload> {
        const response = await fetch(`${BASE_URL}/api/chat/sessions/${id}`, defaultFetchOptions);
        if (response.status === 401) {
            throw new Error('UNAUTHORIZED');
        }
        if (!response.ok) {
            throw new Error('Failed to fetch chat session');
        }
        return response.json();
    },

    async saveChatSession(id: string, payload: SessionPayload): Promise<SessionPayload> {
        const response = await fetch(`${BASE_URL}/api/chat/sessions/${id}`, {
            ...defaultFetchOptions,
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (response.status === 401) {
            throw new Error('UNAUTHORIZED');
        }
        if (!response.ok) {
            throw new Error('Failed to save chat session');
        }
        return response.json();
    },

    async deleteChatSession(id: string): Promise<void> {
        const response = await fetch(`${BASE_URL}/api/chat/sessions/${id}`, {
            ...defaultFetchOptions,
            method: 'DELETE',
        });
        if (response.status === 401) {
            throw new Error('UNAUTHORIZED');
        }
        if (!response.ok) {
            throw new Error('Failed to delete chat session');
        }
    },
};
