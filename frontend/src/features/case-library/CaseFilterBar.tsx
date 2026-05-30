import React from 'react';

import type { CaseFilters } from './types';

interface CaseFilterBarProps {
    filters: CaseFilters;
    onChange: (filters: CaseFilters) => void;
}

export const CaseFilterBar: React.FC<CaseFilterBarProps> = ({ filters, onChange }) => {
    const update = (key: keyof CaseFilters, value: string) => {
        onChange({ ...filters, [key]: value });
    };

    return (
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col gap-2 text-sm text-slate-600">
                <span>Defect Category</span>
                <input
                    value={filters.defect_category}
                    onChange={(event) => update('defect_category', event.target.value)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none"
                />
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-600">
                <span>Printer Model</span>
                <input
                    value={filters.printer_model}
                    onChange={(event) => update('printer_model', event.target.value)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none"
                />
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-600">
                <span>Material</span>
                <input
                    value={filters.filament_material}
                    onChange={(event) => update('filament_material', event.target.value)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none"
                />
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-600">
                <span>Search</span>
                <input
                    value={filters.query}
                    onChange={(event) => update('query', event.target.value)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none"
                />
            </label>
        </div>
    );
};
