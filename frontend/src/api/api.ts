import type { ApiSettings } from './apiSettings';

export const BASE_URL = 'http://localhost:8001';

export interface DiagnosisRequest {
    detections: { label: string; confidence: number }[];
    description?: string;
    safety_constraints?: string;
    preset_data?: any;
    api_settings?: ApiSettings;
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

export const api = {
    async diagnose(payload: DiagnosisRequest): Promise<DiagnosisResponse> {
        const response = await fetch(`${BASE_URL}/api/diagnose`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Diagnosis failed');
        }

        return response.json();
    },

    async diagnoseStream(
        payload: DiagnosisRequest,
        onUpdate: (chunk: { type: string; content?: string; reasoning_markdown?: string; modifications?: Modification[]; message?: string; raw?: string }) => void
    ): Promise<void> {
        const response = await fetch(`${BASE_URL}/api/diagnose/stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Diagnosis stream failed');
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) throw new Error('ReadableStream not supported');

        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            
            // Keep the last part in the buffer, as it might be an incomplete line
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine) continue;
                
                // Handle standard Server-Sent Events format "data: {...}"
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
};
