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

// ─── 3MF Workflow Types ─────────────────────────────────────────

export interface ThreeMFParseResult {
    job_id: string;
    printer_settings_id: string;
    print_settings_id: string;
    filament_settings_id: string;
    printer_model: string;
    summary: Record<string, any>;
    full_settings: Record<string, any>;
    objects: Array<{ id: string; name: string }>;
    plates: Array<{ id: string }>;
}

export interface ThreeMFModifyRequest {
    job_id: string;
    modifications: Modification[];
    repack_only?: boolean;
}

export interface ThreeMFModifyResponse {
    job_id: string;
    status: 'done' | 'pending_agent_cli';
    download_url?: string;
    message?: string;
    applied: string[];
    skipped: string[];
    agent_payload_url?: string;
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    imageUrl?: string;
    slicer_result?: any;
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
    purpose?: 'login' | 'register';
}

export interface EmailCodeLoginPayload {
    email: string;
    code: string;
}

export interface EmailCodeRegisterPayload {
    email: string;
    code: string;
    invite_code?: string;
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

export interface FeedbackImageAsset {
    name: string;
    base64: string;
    preview_url?: string;
}

export interface FeedbackAttachmentAsset {
    name: string;
    size: number;
    content: string;
}

export interface FeedbackBinaryAsset {
    name: string;
    base64: string;
    mime_type?: string;
}

export interface FeedbackPresetSnapshot {
    file_name: string | null;
    bundle_format?: string | null;
    bundle_id?: string | null;
    printer?: Record<string, unknown> | null;
    process?: Record<string, unknown> | null;
    filaments?: Record<string, unknown>[];
}

export interface MessageFeedbackRecord {
    rating: 'up' | 'down';
    text?: string;
    images?: FeedbackImageAsset[];
    submittedAt: number;
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
    attachedFilesDetailed?: FeedbackAttachmentAsset[];
    presetName?: string;
    presetSnapshot?: FeedbackPresetSnapshot;
    presetUploadAsset?: FeedbackBinaryAsset;
    imageAsset?: FeedbackImageAsset;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number; cache_tokens?: number };
    modelName?: string;
    feedback?: MessageFeedbackRecord;
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

export interface ChatFeedbackPayload {
    session_id?: string | null;
    assistant_message_id: string;
    user_message_id?: string | null;
    rating: 'up' | 'down';
    feedback_text?: string;
    feedback_images?: FeedbackImageAsset[];
    context_snapshot: Record<string, unknown>;
}

export interface DeveloperOverview {
    users: number;
    chat_sessions: number;
    feedback: number;
    negative_feedback: number;
}

export interface DeveloperSessionStatus {
    authenticated: boolean;
    email: string;
}

export interface DeveloperFeedbackItem {
    id: string;
    session_id?: string | null;
    user_id?: string | null;
    assistant_message_id: string;
    user_message_id?: string | null;
    rating: 'up' | 'down';
    user_message_content: string;
    assistant_message_content: string;
    assistant_thought?: string | null;
    feedback_text?: string | null;
    feedback_images: FeedbackImageAsset[];
    context_snapshot: Record<string, unknown>;
    created_at: string;
}

export interface DeveloperSessionItem {
    id: string;
    user_id: string;
    title: string;
    timestamp: number;
    preset_file_name?: string | null;
    message_count: number;
    created_at: string;
    updated_at: string;
}

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

    async submitChatFeedback(payload: ChatFeedbackPayload): Promise<void> {
        const response = await fetch(`${BASE_URL}/api/chat/feedback`, {
            ...defaultFetchOptions,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Failed to submit feedback' }));
            throw new Error(error.detail || 'Failed to submit feedback');
        }
    },

    async getDeveloperOverview(): Promise<DeveloperOverview> {
        const response = await fetch(`${BASE_URL}/api/dev/overview`, defaultFetchOptions);
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('DEV_UNAUTHORIZED');
            }
            throw new Error('Failed to fetch developer overview');
        }
        return response.json();
    },

    async getDeveloperFeedback(rating?: 'up' | 'down'): Promise<DeveloperFeedbackItem[]> {
        const suffix = rating ? `?rating=${rating}` : '';
        const response = await fetch(`${BASE_URL}/api/dev/feedback${suffix}`, defaultFetchOptions);
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('DEV_UNAUTHORIZED');
            }
            throw new Error('Failed to fetch developer feedback');
        }
        return response.json();
    },

    async getDeveloperSessions(): Promise<DeveloperSessionItem[]> {
        const response = await fetch(`${BASE_URL}/api/dev/sessions`, defaultFetchOptions);
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('DEV_UNAUTHORIZED');
            }
            throw new Error('Failed to fetch developer sessions');
        }
        return response.json();
    },

    async getDeveloperSession(): Promise<DeveloperSessionStatus | null> {
        const response = await fetch(`${BASE_URL}/api/dev/me`, defaultFetchOptions);
        if (response.status === 401) {
            return null;
        }
        if (!response.ok) {
            throw new Error('Failed to fetch developer session');
        }
        return response.json();
    },

    async loginDeveloper(email: string, password: string): Promise<DeveloperSessionStatus> {
        const response = await fetch(`${BASE_URL}/api/dev/login`, {
            ...defaultFetchOptions,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Developer login failed' }));
            throw new Error(error.detail || 'Developer login failed');
        }
        return response.json();
    },

    async logoutDeveloper(): Promise<void> {
        const response = await fetch(`${BASE_URL}/api/dev/logout`, {
            ...defaultFetchOptions,
            method: 'POST',
        });
        if (!response.ok) {
            throw new Error('Developer logout failed');
        }
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

    async registerWithEmailCode(payload: EmailCodeRegisterPayload): Promise<UserProfile> {
        const response = await fetch(`${BASE_URL}/api/auth/email-code/register`, {
            ...defaultFetchOptions,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Code register failed' }));
            throw new Error(error.detail || 'Code register failed');
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

    // ─── Slicer Engine APIs ───────────────────────────────────────

    async getSlicerEngines(): Promise<SlicerEngineInfo[]> {
        const response = await fetch(`${BASE_URL}/api/slicer/engines`, defaultFetchOptions);
        if (!response.ok) {
            throw new Error('Failed to fetch slicer engines');
        }
        return response.json();
    },

    async submitSlicerJob(
        modelFile: File,
        request: SlicerJobSubmission,
    ): Promise<SlicerJobResult> {
        const formData = new FormData();
        formData.append('model', modelFile);

        const requestBlob = new Blob([JSON.stringify(request)], { type: 'application/json' });
        formData.append('request', requestBlob);

        const response = await fetch(`${BASE_URL}/api/slicer/process`, {
            ...defaultFetchOptions,
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Slicer processing failed' }));
            throw new Error(error.detail || 'Slicer processing failed');
        }
        return response.json();
    },

    async getSlicerJobStatus(jobId: string): Promise<SlicerJobResult> {
        const response = await fetch(`${BASE_URL}/api/slicer/jobs/${jobId}`, defaultFetchOptions);
        if (!response.ok) {
            throw new Error('Failed to fetch job status');
        }
        return response.json();
    },

    getSlicerDownloadUrl(jobId: string): string {
        return `${BASE_URL}/api/slicer/jobs/${jobId}/download`;
    },

    getSlicer3mfDownloadUrl(jobId: string): string {
        return `${BASE_URL}/api/slicer/download-3mf/${jobId}`;
    },

    async cleanupSlicerJob(jobId: string): Promise<void> {
        await fetch(`${BASE_URL}/api/slicer/jobs/${jobId}`, {
            ...defaultFetchOptions,
            method: 'DELETE',
        });
    },

    // ─── 3MF Workflow Methods ──────────────────────────────────────

    async parse3MF(file: File): Promise<ThreeMFParseResult> {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${BASE_URL}/api/slicer/parse-3mf`, {
            ...defaultFetchOptions,
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to parse 3MF: ${response.statusText}`);
        }

        return response.json();
    },

    async modify3MF(request: ThreeMFModifyRequest): Promise<ThreeMFModifyResponse> {
        const response = await fetch(`${BASE_URL}/api/slicer/modify-3mf`, {
            ...defaultFetchOptions,
            method: 'POST',
            headers: {
                ...defaultFetchOptions.headers,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                job_id: request.job_id,
                modifications: request.modifications,
                repack_only: request.repack_only ?? false
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to modify 3MF: ${response.statusText}`);
        }

        return response.json();
    },

    getSlicerAgentOriginalUrl(jobId: string): string {
        return `${BASE_URL}/api/slicer/agent/original/${jobId}`;
    },

    getSlicerAgentSettingsUrl(jobId: string): string {
        return `${BASE_URL}/api/slicer/agent/settings/${jobId}`;
    },

    getSlicerAgentCliPayloadUrl(jobId: string): string {
        return `${BASE_URL}/api/slicer/agent/cli-payload/${jobId}`;
    },

    async uploadSlicerAgentResult(jobId: string, file: File): Promise<void> {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${BASE_URL}/api/slicer/agent/${jobId}/upload`, {
            ...defaultFetchOptions,
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to upload slicer agent result: ${response.statusText}`);
        }
    },

    // ─── Model Configuration APIs ─────────────────────────────────

    async getProviders(): Promise<Record<string, ProviderConfig>> {
        const response = await fetch(`${BASE_URL}/api/dev/providers`, defaultFetchOptions);
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('DEV_UNAUTHORIZED');
            }
            throw new Error('Failed to fetch providers');
        }
        return response.json();
    },

    async addProvider(config: ProviderConfig): Promise<{ success: boolean }> {
        const response = await fetch(`${BASE_URL}/api/dev/providers`, {
            ...defaultFetchOptions,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
        });
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('DEV_UNAUTHORIZED');
            }
            throw new Error('Failed to add provider');
        }
        return response.json();
    },

    async updateProvider(providerId: string, config: ProviderConfig): Promise<{ success: boolean }> {
        const response = await fetch(`${BASE_URL}/api/dev/providers/${providerId}`, {
            ...defaultFetchOptions,
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
        });
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('DEV_UNAUTHORIZED');
            }
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.detail || `Failed to update provider (${response.status})`;
            throw new Error(errorMsg);
        }
        return response.json();
    },

    async deleteProvider(providerId: string): Promise<{ success: boolean }> {
        const response = await fetch(`${BASE_URL}/api/dev/providers/${providerId}`, {
            ...defaultFetchOptions,
            method: 'DELETE',
        });
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('DEV_UNAUTHORIZED');
            }
            throw new Error('Failed to delete provider');
        }
        return response.json();
    },

    async detectProviderModels(providerId: string): Promise<{ models: string[] }> {
        const response = await fetch(`${BASE_URL}/api/dev/providers/${providerId}/detect`, {
            ...defaultFetchOptions,
            method: 'POST',
        });
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('DEV_UNAUTHORIZED');
            }
            throw new Error('Failed to detect models');
        }
        return response.json();
    },

    async toggleProviderForUsers(providerId: string, enabledForUsers: boolean): Promise<{ success: boolean }> {
        const response = await fetch(`${BASE_URL}/api/dev/providers/${providerId}/toggle-users?enabled_for_users=${enabledForUsers}`, {
            ...defaultFetchOptions,
            method: 'POST',
        });
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('DEV_UNAUTHORIZED');
            }
            throw new Error('Failed to toggle provider for users');
        }
        return response.json();
    },

    async getEnabledProvidersForUsers(): Promise<Record<string, ProviderConfig>> {
        const response = await fetch(`${BASE_URL}/api/dev/providers/enabled-for-users`, defaultFetchOptions);
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('DEV_UNAUTHORIZED');
            }
            throw new Error('Failed to fetch enabled providers');
        }
        return response.json();
    },

    async getPublicProviders(): Promise<Record<string, ProviderConfig>> {
        const response = await fetch(`${BASE_URL}/api/dev/providers/public`, defaultFetchOptions);
        if (!response.ok) {
            throw new Error('Failed to fetch providers');
        }
        return response.json();
    },

    async toggleModelForUsers(providerId: string, modelId: string, enabledForUsers: boolean): Promise<{ success: boolean }> {
        const response = await fetch(`${BASE_URL}/api/dev/providers/${providerId}/models/toggle`, {
            ...defaultFetchOptions,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model_id: modelId, enabled_for_users: enabledForUsers }),
        });
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('DEV_UNAUTHORIZED');
            }
            throw new Error('Failed to toggle model');
        }
        return response.json();
    },
};

// ─── Slicer Engine Types ─────────────────────────────────────────

export interface SlicerEngineInfo {
    name: string;
    engine_id: string;
    version: string;
    executable: string;
    available: boolean;
    supports: string[];
}

export interface SlicerJobSubmission {
    engine?: string;
    preset_data?: Record<string, unknown>;
    modifications?: Modification[];
    auto_arrange?: boolean;
    auto_orient?: boolean;
    do_slice?: boolean;
    output_format?: string;
}

export interface SlicerJobResult {
    job_id: string;
    status: 'pending' | 'running' | 'done' | 'failed';
    output_filename?: string | null;
    stdout?: string;
    stderr?: string;
    duration_seconds?: number;
    error?: string | null;
}

// ─── Model Configuration Types ──────────────────────────────────

export interface ProviderConfig {
    name: string;
    base_url: string;
    api_key: string;
    default_model: string;
    supports_vision: boolean;
    enabled: boolean;
    enabled_for_users: boolean;
    models: ProviderModel[];
}

export interface ProviderModel {
    id: string;
    enabled_for_users: boolean;
}
