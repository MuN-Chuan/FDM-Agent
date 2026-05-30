import React from 'react';

import type { CaseListItem } from './types';

interface CaseListProps {
    items: CaseListItem[];
    onSelect?: (item: CaseListItem) => void;
}

export const CaseList: React.FC<CaseListProps> = ({ items, onSelect }) => {
    if (items.length === 0) {
        return (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
                No cases matched the current filters.
            </div>
        );
    }

    return (
        <div className="grid gap-4 lg:grid-cols-2">
            {items.map((item) => (
                <button
                    key={item.case_id}
                    type="button"
                    onClick={() => onSelect?.(item)}
                    className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-green-400"
                >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-green-700">{item.defect_category}</p>
                    <h3 className="mt-2 text-lg font-bold text-slate-900">{item.title}</h3>
                    <p className="mt-2 text-sm text-slate-600">{item.solution_summary}</p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                        {item.printer_model ? <span>{item.printer_model}</span> : null}
                        {item.filament_material ? <span>{item.filament_material}</span> : null}
                    </div>
                </button>
            ))}
        </div>
    );
};
