export const BASE_URL = 'http://localhost:8000';

export interface DiagnosisRequest {
    detections: { label: string; confidence: number }[];
    description?: string;
    safety_constraints?: string;
    preset_data?: any;
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
    }
};
