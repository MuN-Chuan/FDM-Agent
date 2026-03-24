import React from 'react';
import { ExternalLink, ImageIcon, ThumbsDown, ThumbsUp } from 'lucide-react';

import type { DeveloperFeedbackItem } from '../../../api/api';
import { useI18n } from '../../../i18n/I18nProvider';
import { formatDeveloperTimestamp } from '../utils';

interface DeveloperFeedbackPanelProps {
    loading: boolean;
    feedback: DeveloperFeedbackItem[];
    ratingFilter: 'all' | 'up' | 'down';
    onFilterChange: (value: 'all' | 'up' | 'down') => void;
}

export const DeveloperFeedbackPanel: React.FC<DeveloperFeedbackPanelProps> = ({
    loading,
    feedback,
    ratingFilter,
    onFilterChange,
}) => {
    const { t } = useI18n();
    const filterLabel =
        ratingFilter === 'all'
            ? `Filter: ${t('developer.filter.all')}`
            : ratingFilter === 'down'
              ? 'Filter: Negative'
              : 'Filter: Positive';

    return (
        <section className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <h3 className="font-heading text-lg font-bold tracking-tight text-slate-950">AI Interaction Feedback</h3>
                <div className="flex gap-2">
                    <div className="flex overflow-hidden rounded bg-[var(--color-surface-subtle)]">
                        {(['all', 'down', 'up'] as const).map((option) => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => onFilterChange(option)}
                                className={`px-3 py-1 text-xs font-semibold transition-colors ${
                                    ratingFilter === option
                                        ? 'bg-[var(--color-primary)] text-white'
                                        : 'text-slate-600 hover:bg-white hover:text-slate-900'
                                }`}
                                title={t(`developer.filter.${option}`)}
                            >
                                {option === 'all' ? filterLabel : t(`developer.filter.${option}`)}
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        className="rounded bg-[var(--color-surface-subtle)] px-3 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-white"
                    >
                        Export CSV
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {loading ? (
                    <DeveloperEmptyState label={t('developer.loading')} />
                ) : feedback.length === 0 ? (
                    <DeveloperEmptyState label={t('developer.noFeedback')} />
                ) : (
                    feedback.map((item) => {
                        const isNegative = item.rating === 'down';

                        return (
                            <article
                                key={item.id}
                                className="rounded border border-[rgba(191,202,186,0.35)] bg-white p-5"
                            >
                                <div className="mb-4 flex items-start justify-between gap-4">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span
                                            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${
                                                isNegative
                                                    ? 'bg-rose-50 text-rose-700'
                                                    : 'bg-green-50 text-green-700'
                                            }`}
                                        >
                                            {isNegative ? <ThumbsDown size={12} /> : <ThumbsUp size={12} />}
                                            {isNegative ? 'Inaccurate' : 'Helpful'}
                                        </span>
                                        <span className="text-[11px] text-slate-500">ID: {item.id.slice(0, 8)}</span>
                                        <span className="text-[11px] text-slate-500">
                                            {formatDeveloperTimestamp(item.created_at)}
                                        </span>
                                    </div>
                                    <button type="button" className="text-slate-400 transition-colors hover:text-green-800">
                                        <ExternalLink size={16} />
                                    </button>
                                </div>

                                <div className="mb-4 grid gap-4 md:grid-cols-2">
                                    <div className="rounded border-l-2 border-[var(--color-secondary)] bg-[var(--color-surface-muted)] p-3">
                                        <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                                            {t('developer.userQuestion')}
                                        </div>
                                        <p className="line-clamp-3 text-xs italic text-slate-800">
                                            "{item.user_message_content}"
                                        </p>
                                    </div>

                                    <div className="rounded border-l-2 border-[var(--color-primary)] bg-[rgba(13,99,27,0.06)] p-3">
                                        <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-primary)]">
                                            Diagnostic Architecture
                                        </div>
                                        <p className="line-clamp-3 whitespace-pre-wrap text-xs text-slate-800">
                                            "{item.assistant_message_content}"
                                        </p>
                                    </div>
                                </div>

                                {item.feedback_text ? (
                                    <div className="mb-4 rounded bg-[var(--color-surface-subtle)] p-3">
                                        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                                            Additional Text Feedback
                                        </div>
                                        <p className="whitespace-pre-wrap text-xs text-slate-800">{item.feedback_text}</p>
                                    </div>
                                ) : null}

                                {item.feedback_images.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {item.feedback_images.map((image, index) => (
                                            <figure
                                                key={`${image.name}-${index}`}
                                                className="group relative h-16 w-16 overflow-hidden rounded border border-[rgba(191,202,186,0.45)] bg-[var(--color-surface-subtle)]"
                                            >
                                                <img
                                                    src={image.preview_url}
                                                    alt={image.name}
                                                    className="h-full w-full object-cover grayscale transition duration-200 group-hover:grayscale-0"
                                                />
                                                <figcaption className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-[rgba(13,99,27,0.72)] px-1.5 py-1 text-[9px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                                                    <ImageIcon size={10} />
                                                    <span className="truncate">{image.name}</span>
                                                </figcaption>
                                            </figure>
                                        ))}
                                    </div>
                                ) : null}
                            </article>
                        );
                    })
                )}
            </div>
        </section>
    );
};

const DeveloperEmptyState: React.FC<{ label: string }> = ({ label }) => (
    <div className="flex min-h-[240px] items-center justify-center rounded border border-dashed border-[var(--shell-border)] bg-white px-4 text-sm text-slate-500">
        {label}
    </div>
);
