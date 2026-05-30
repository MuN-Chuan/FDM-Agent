import { beforeEach, describe, expect, it, vi } from 'vitest';

import { caseLibraryApi } from './caseLibraryApi';


describe('caseLibraryApi', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('builds filter query strings for case listing', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(JSON.stringify({ count: 1, items: [{ case_id: 'case-001', title: 'PETG Stringing', defect_category: 'stringing' }] }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }),
        );

        const data = await caseLibraryApi.listCases({ defect_category: 'stringing', filament_material: 'PETG' });

        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/cases?defect_category=stringing&filament_material=PETG'));
        expect(data.count).toBe(1);
    });
});
