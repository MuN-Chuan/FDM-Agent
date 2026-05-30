import React from 'react';
import { useEffect, useState } from 'react';

import { caseLibraryApi } from '../api/caseLibraryApi';
import { CaseDetailDrawer } from '../features/case-library/CaseDetailDrawer';
import { CaseFilterBar } from '../features/case-library/CaseFilterBar';
import { CaseList } from '../features/case-library/CaseList';
import type { CaseFilters, CaseListItem } from '../features/case-library/types';

export const CaseLibraryPage: React.FC = () => {
    const [filters, setFilters] = useState<CaseFilters>({
        defect_category: '',
        printer_model: '',
        filament_material: '',
        query: '',
    });
    const [cases, setCases] = useState<CaseListItem[]>([]);
    const [selectedCase, setSelectedCase] = useState<CaseListItem | null>(null);

    useEffect(() => {
        let cancelled = false;

        void caseLibraryApi.listCases(filters).then((data) => {
            if (!cancelled) {
                setCases(data.items);
                setSelectedCase((current) => data.items.find((item) => item.case_id === current?.case_id) ?? data.items[0] ?? null);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [filters]);

    return (
        <section className="flex h-full flex-col gap-4 p-6">
            <header className="space-y-2">
                <h2 className="font-heading text-2xl font-bold tracking-tight text-slate-900">FDM Case Library</h2>
                <p className="max-w-3xl text-sm text-slate-600">
                    Browse open FDM defect cases by defect category, printer, material, and slicing parameters.
                </p>
            </header>

            <CaseFilterBar filters={filters} onChange={setFilters} />

            <div className="grid flex-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
                <CaseList items={cases} onSelect={setSelectedCase} />
                <CaseDetailDrawer item={selectedCase} />
            </div>
        </section>
    );
};
