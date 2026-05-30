import React from 'react';
import { Info } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';

export interface ParameterModification {
    name: string;
    old: unknown;
    new: unknown;
    range: string;
    reason: string;
    risk: 'low' | 'medium' | 'high';
}

interface ParameterDiffViewerProps {
    modifications?: ParameterModification[];
}

function formatParameterValue(value: unknown) {
    if (value === null || value === undefined || value === '') {
        return '-';
    }
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }
    return String(value);
}

export const ParameterDiffViewer: React.FC<ParameterDiffViewerProps> = ({ modifications = [] }) => {
    const { t } = useI18n();

    if (modifications.length === 0) {
        return (
            <div className="bg-[var(--color-surface-muted)] p-8 text-center text-slate-400">
                <Info size={24} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">{t('chat.noParameterChanges')}</p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden bg-white">
            <table className="w-full border-collapse text-left">
                <thead className="bg-[#f4f4f2] text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                    <tr>
                        <th className="px-5 py-4">{t('chat.parameter')}</th>
                        <th className="px-5 py-4">{t('chat.current')}</th>
                        <th className="px-5 py-4">{t('chat.proposed')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(191,202,186,0.28)] bg-white">
                    {modifications.map((item) => (
                        <tr key={item.name} className="align-top transition-colors hover:bg-[#fafbf9]">
                            <td className="px-5 py-4">
                                <p className="font-mono text-sm text-slate-800">{item.name}</p>
                            </td>
                            <td className="px-5 py-4 text-sm text-slate-600">{formatParameterValue(item.old)}</td>
                            <td className="px-5 py-4">
                                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">
                                    <span>{formatParameterValue(item.new)}</span>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
