import React from 'react';
import { Info } from 'lucide-react';

export interface ParameterModification {
    name: string;
    old: string;
    new: string;
    range: string;
    reason: string;
    risk: 'low' | 'medium' | 'high';
}

interface ParameterDiffViewerProps {
    modifications?: ParameterModification[];
}

export const ParameterDiffViewer: React.FC<ParameterDiffViewerProps> = ({ modifications = [] }) => {
    if (modifications.length === 0) {
        return (
            <div className="bg-[var(--color-surface-muted)] p-8 text-center text-slate-400">
                <Info size={24} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No parameter changes were generated for this answer.</p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden bg-white">
            <table className="w-full border-collapse text-left">
                <thead className="bg-[#f4f4f2] text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                    <tr>
                        <th className="px-5 py-4">Parameter</th>
                        <th className="px-5 py-4">Current</th>
                        <th className="px-5 py-4">Proposed</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(191,202,186,0.28)] bg-white">
                    {modifications.map((item) => (
                        <tr key={item.name} className="align-top transition-colors hover:bg-[#fafbf9]">
                            <td className="px-5 py-4">
                                <p className="font-mono text-sm text-slate-800">{item.name}</p>
                            </td>
                            <td className="px-5 py-4 text-sm text-slate-600">{item.old}</td>
                            <td className="px-5 py-4">
                                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">
                                    <span>{item.new}</span>
                                </div>
                                {item.range ? <p className="mt-2 text-xs text-slate-400">Range: {item.range}</p> : null}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
