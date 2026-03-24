import React from 'react';
import type { LucideIcon } from 'lucide-react';

import { formatCompactNumber } from '../utils';

interface DeveloperMetricCardProps {
    label: string;
    value: number;
    icon: LucideIcon;
    tone?: 'primary' | 'secondary' | 'tertiary' | 'danger';
    supportingText?: string;
}

const toneStyles: Record<NonNullable<DeveloperMetricCardProps['tone']>, string> = {
    primary: 'border-[var(--color-primary)] text-[var(--color-primary)]',
    secondary: 'border-[var(--color-secondary)] text-[var(--color-secondary)]',
    tertiary: 'border-[var(--color-tertiary)] text-[var(--color-tertiary)]',
    danger: 'border-[var(--color-danger)] text-[var(--color-danger)]',
};

export const DeveloperMetricCard: React.FC<DeveloperMetricCardProps> = ({
    label,
    value,
    icon: Icon,
    tone = 'primary',
    supportingText,
}) => (
    <article className={`rounded bg-white p-6 shadow-sm ring-1 ring-[rgba(191,202,186,0.35)] border-l-4 ${toneStyles[tone]}`}>
        <div className="mb-4 flex items-start justify-between gap-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">{label}</span>
            <Icon size={18} />
        </div>
        <div className="text-2xl font-bold text-slate-950">{formatCompactNumber(value)}</div>
        {supportingText ? <div className="mt-1 text-[10px] font-semibold text-current/90">{supportingText}</div> : null}
    </article>
);
