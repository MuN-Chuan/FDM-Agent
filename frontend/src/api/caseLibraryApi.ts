import { BASE_URL } from './api';
import type { CaseFilters, CaseListResponse } from '../features/case-library/types';


export const caseLibraryApi = {
    async listCases(filters: Partial<CaseFilters>): Promise<CaseListResponse> {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value) {
                params.set(key, value);
            }
        });

        const suffix = params.toString();
        const response = await fetch(`${BASE_URL}/api/cases${suffix ? `?${suffix}` : ''}`);
        if (!response.ok) {
            throw new Error('Failed to load cases');
        }
        return response.json();
    },

    async getCase(caseId: string) {
        const response = await fetch(`${BASE_URL}/api/cases/${caseId}`);
        if (!response.ok) {
            throw new Error('Failed to load case');
        }
        return response.json();
    },
};
