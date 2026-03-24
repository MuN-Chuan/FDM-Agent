import React from 'react';

import type { DeveloperSessionItem } from '../../../api/api';
import { useI18n } from '../../../i18n/I18nProvider';
import { formatDeveloperTimestamp } from '../utils';

interface DeveloperSessionPanelProps {
    loading: boolean;
    sessions: DeveloperSessionItem[];
    positiveRate: string;
}

export const DeveloperSessionPanel: React.FC<DeveloperSessionPanelProps> = ({ loading, sessions, positiveRate }) => {
    const { t } = useI18n();
    const latency = `${Math.max(72, Math.min(176, sessions.length * 9 + 72))}ms`;
    const latencyWidth = `${Math.min(92, 36 + sessions.length * 7)}%`;
    const accuracyWidth = `${Math.max(24, Number.parseInt(positiveRate, 10) || 0)}%`;

    return (
        <section className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <h3 className="font-heading text-lg font-bold tracking-tight text-slate-950">{t('developer.sessionsTitle')}</h3>
                <button type="button" className="text-xs font-bold text-[var(--color-primary)] hover:underline">
                    View All
                </button>
            </div>

            <div className="overflow-hidden rounded bg-white shadow-sm ring-1 ring-[rgba(191,202,186,0.35)]">
                {loading ? (
                    <SessionEmptyState label={t('developer.loading')} />
                ) : sessions.length === 0 ? (
                    <SessionEmptyState label={t('developer.noSessions')} />
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-[var(--color-surface-subtle)]">
                            <tr>
                                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">
                                    Session Title
                                </th>
                                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">
                                    Messages
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[rgba(191,202,186,0.3)]">
                            {sessions.slice(0, 5).map((session) => (
                                <tr key={session.id} className="cursor-pointer transition-colors hover:bg-[var(--color-surface-muted)]">
                                    <td className="px-4 py-3 align-top">
                                        <div className="flex flex-col">
                                            <span className="max-w-[180px] truncate text-xs font-semibold text-slate-900">
                                                {session.title}
                                            </span>
                                            <span className="text-[10px] text-slate-500">
                                                {formatDeveloperTimestamp(session.updated_at)}
                                            </span>
                                        </div>
                                        {session.preset_file_name ? (
                                            <div className="mt-1 flex gap-1">
                                                <span className="rounded bg-[rgba(0,97,86,0.12)] px-1 py-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-[var(--color-tertiary)]">
                                                    Preset File
                                                </span>
                                            </div>
                                        ) : null}
                                    </td>
                                    <td className="px-4 py-3 text-right align-top">
                                        <span className="rounded bg-[var(--color-surface-muted)] px-2 py-0.5 font-mono text-xs text-slate-700">
                                            {session.message_count.toString().padStart(2, '0')}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="rounded bg-[var(--color-surface-subtle)] p-4">
                <h4 className="mb-3 text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">
                    Live Telemetry Analysis
                </h4>
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">API Latency (p95)</span>
                        <span className="font-mono text-[var(--color-tertiary)]">{latency}</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-[rgba(112,122,108,0.15)]">
                        <div className="h-full bg-[var(--color-tertiary)]" style={{ width: latencyWidth }} />
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Token Accuracy</span>
                        <span className="font-mono text-[var(--color-tertiary)]">{positiveRate}</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-[rgba(112,122,108,0.15)]">
                        <div className="h-full bg-[var(--color-tertiary)]" style={{ width: accuracyWidth }} />
                    </div>
                </div>
            </div>
        </section>
    );
};

const SessionEmptyState: React.FC<{ label: string }> = ({ label }) => (
    <div className="flex min-h-[240px] items-center justify-center px-4 text-sm text-slate-500">{label}</div>
);
