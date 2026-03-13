import type { ApiSettings } from './apiSettings';

export const BASE_URL = 'http://localhost:8001';

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
    old: string;
    new: string;
    range: string;
    reason: string;
    risk: 'low' | 'medium' | 'high';
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
};
