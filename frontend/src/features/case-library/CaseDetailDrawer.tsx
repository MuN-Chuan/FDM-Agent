import React from 'react';

import type { CaseListItem } from './types';

interface CaseDetailDrawerProps {
    item: CaseListItem | null;
}

export const CaseDetailDrawer: React.FC<CaseDetailDrawerProps> = ({ item }) => {
    if (!item) {
        return (
            <aside className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
                Select a case to inspect its summary and provenance.
            </aside>
        );
    }

    return (
        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-green-700">{item.defect_category}</p>
            <h3 className="mt-2 text-lg font-bold text-slate-900">{item.title}</h3>
            <p className="mt-3 text-sm text-slate-600">{item.solution_summary}</p>
        </aside>
    );
};
