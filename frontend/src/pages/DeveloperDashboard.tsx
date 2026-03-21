import React, { useEffect, useState } from 'react';

import { api } from '../api/api';
import type {
    DeveloperFeedbackItem,
    DeveloperOverview,
    DeveloperSessionItem,
    DeveloperSessionStatus,
} from '../api/api';
import { useI18n } from '../i18n/I18nProvider';

export const DeveloperDashboard: React.FC = () => {
    const { t } = useI18n();
    const [overview, setOverview] = useState<DeveloperOverview | null>(null);
    const [feedback, setFeedback] = useState<DeveloperFeedbackItem[]>([]);
    const [sessions, setSessions] = useState<DeveloperSessionItem[]>([]);
    const [ratingFilter, setRatingFilter] = useState<'all' | 'up' | 'down'>('all');
    const [session, setSession] = useState<DeveloperSessionStatus | null>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(true);
    const [authLoading, setAuthLoading] = useState(true);
    const [authSubmitting, setAuthSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [authError, setAuthError] = useState('');

    useEffect(() => {
        let cancelled = false;

        void (async () => {
            try {
                const currentSession = await api.getDeveloperSession();
                if (!cancelled) {
                    setSession(currentSession);
                    setEmail(currentSession?.email ?? '');
                }
            } catch (err) {
                if (!cancelled) {
                    setAuthError(err instanceof Error ? err.message : t('developer.authLoadError'));
                }
            } finally {
                if (!cancelled) {
                    setAuthLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [t]);

    useEffect(() => {
        if (!session) {
            setLoading(false);
            return;
        }

        let cancelled = false;

        void (async () => {
            try {
                setLoading(true);
                setError('');
                const [nextOverview, nextFeedback, nextSessions] = await Promise.all([
                    api.getDeveloperOverview(),
                    api.getDeveloperFeedback(ratingFilter === 'all' ? undefined : ratingFilter),
                    api.getDeveloperSessions(),
                ]);
                if (!cancelled) {
                    setOverview(nextOverview);
                    setFeedback(nextFeedback);
                    setSessions(nextSessions);
                }
            } catch (err) {
                if (!cancelled) {
                    const nextError = err instanceof Error ? err.message : t('developer.loadError');
                    if (nextError === 'DEV_UNAUTHORIZED') {
                        setSession(null);
                        setAuthError(t('developer.authExpired'));
                    } else {
                        setError(nextError);
                    }
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [ratingFilter, session, t]);

    const handleLogin = async () => {
        try {
            setAuthSubmitting(true);
            setAuthError('');
            const nextSession = await api.loginDeveloper(email, password);
            setSession(nextSession);
            setPassword('');
        } catch (err) {
            setAuthError(err instanceof Error ? err.message : t('developer.authError'));
        } finally {
            setAuthSubmitting(false);
        }
    };

    const handleLogout = async () => {
        try {
            await api.logoutDeveloper();
        } finally {
            setSession(null);
            setOverview(null);
            setFeedback([]);
            setSessions([]);
            setPassword('');
        }
    };

    if (authLoading) {
        return <LoadingState label={t('developer.loading')} />;
    }

    if (!session) {
        return (
            <div className="mx-auto flex h-full max-w-xl items-center justify-center">
                <div className="w-full rounded-[28px] border border-secondary/10 bg-white p-8 shadow-xl">
                    <h1 className="text-2xl font-heading font-bold text-text-light">{t('developer.authTitle')}</h1>
                    <p className="mt-2 text-sm text-text-light/55">{t('developer.authSubtitle')}</p>

                    <div className="mt-6 space-y-4">
                        <label className="block">
                            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-text-light/40">
                                {t('auth.email')}
                            </span>
                            <input
                                type="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                className="w-full rounded-2xl border border-secondary/15 bg-background-light px-4 py-3 text-sm outline-none transition-all focus:border-cta/40 focus:ring-4 focus:ring-cta/10"
                            />
                        </label>
                        <label className="block">
                            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-text-light/40">
                                {t('auth.password')}
                            </span>
                            <input
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                className="w-full rounded-2xl border border-secondary/15 bg-background-light px-4 py-3 text-sm outline-none transition-all focus:border-cta/40 focus:ring-4 focus:ring-cta/10"
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        void handleLogin();
                                    }
                                }}
                            />
                        </label>
                    </div>

                    {authError && <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{authError}</div>}

                    <button
                        onClick={() => void handleLogin()}
                        disabled={authSubmitting || !email.trim() || !password}
                        className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-cta px-5 py-3 text-sm font-bold text-white shadow-md shadow-cta/20 transition-all hover:bg-[#1fb457] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {authSubmitting ? t('developer.authSubmitting') : t('developer.authSubmit')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-heading font-bold text-text-light">{t('developer.title')}</h1>
                    <p className="mt-2 text-sm text-text-light/55">{t('developer.subtitle')}</p>
                    <p className="mt-2 text-xs text-text-light/35">{session.email}</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => window.location.reload()}
                        className="rounded-xl border border-cta/20 bg-white px-4 py-2 text-sm font-bold text-cta shadow-sm transition-all hover:bg-cta/5"
                    >
                        {t('developer.refresh')}
                    </button>
                    <button
                        onClick={() => void handleLogout()}
                        className="rounded-xl border border-secondary/15 bg-white px-4 py-2 text-sm font-bold text-text-light/60 shadow-sm transition-all hover:bg-secondary/5"
                    >
                        {t('developer.logout')}
                    </button>
                </div>
            </div>

            {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>}

            <div className="grid gap-4 md:grid-cols-4">
                <MetricCard label={t('developer.metricUsers')} value={overview?.users ?? 0} />
                <MetricCard label={t('developer.metricSessions')} value={overview?.chat_sessions ?? 0} />
                <MetricCard label={t('developer.metricFeedback')} value={overview?.feedback ?? 0} />
                <MetricCard label={t('developer.metricNegative')} value={overview?.negative_feedback ?? 0} />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
                <section className="rounded-3xl border border-secondary/10 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-heading font-bold text-text-light">{t('developer.feedbackTitle')}</h2>
                            <p className="text-xs text-text-light/45">{t('developer.feedbackHint')}</p>
                        </div>
                        <div className="flex rounded-xl bg-secondary/5 p-1">
                            {(['all', 'down', 'up'] as const).map((option) => (
                                <button
                                    key={option}
                                    onClick={() => setRatingFilter(option)}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                                        ratingFilter === option ? 'bg-cta text-white shadow-sm' : 'text-text-light/50 hover:text-text-light'
                                    }`}
                                >
                                    {t(`developer.filter.${option}`)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3">
                        {loading ? (
                            <EmptyState label={t('developer.loading')} />
                        ) : feedback.length === 0 ? (
                            <EmptyState label={t('developer.noFeedback')} />
                        ) : (
                            feedback.map((item) => (
                                <article key={item.id} className="rounded-2xl border border-secondary/10 bg-background-light p-4">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span
                                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                                                item.rating === 'down' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                                            }`}
                                        >
                                            {item.rating === 'down' ? t('developer.filter.down') : t('developer.filter.up')}
                                        </span>
                                        <span className="text-xs text-text-light/40">{new Date(item.created_at).toLocaleString()}</span>
                                        {item.session_id && <span className="text-xs text-text-light/30">Session: {item.session_id}</span>}
                                    </div>

                                    <div className="mt-3 space-y-3 text-sm text-text-light">
                                        <div>
                                            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-text-light/40">
                                                {t('developer.userQuestion')}
                                            </div>
                                            <div className="rounded-xl bg-white px-3 py-2 shadow-sm">{item.user_message_content}</div>
                                        </div>
                                        <div>
                                            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-text-light/40">
                                                {t('developer.aiAnswer')}
                                            </div>
                                            <div className="rounded-xl bg-white px-3 py-2 shadow-sm whitespace-pre-wrap">{item.assistant_message_content}</div>
                                        </div>
                                        {item.feedback_text && (
                                            <div>
                                                <div className="mb-1 text-xs font-bold uppercase tracking-wide text-text-light/40">
                                                    {t('developer.feedbackText')}
                                                </div>
                                                <div className="rounded-xl bg-white px-3 py-2 shadow-sm whitespace-pre-wrap">{item.feedback_text}</div>
                                            </div>
                                        )}
                                        {item.feedback_images.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {item.feedback_images.map((image, index) => (
                                                    <img
                                                        key={`${image.name}-${index}`}
                                                        src={image.preview_url}
                                                        alt={image.name}
                                                        className="h-20 w-20 rounded-xl border border-secondary/10 object-cover shadow-sm"
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </article>
                            ))
                        )}
                    </div>
                </section>

                <section className="rounded-3xl border border-secondary/10 bg-white p-5 shadow-sm">
                    <div className="mb-4">
                        <h2 className="text-lg font-heading font-bold text-text-light">{t('developer.sessionsTitle')}</h2>
                        <p className="text-xs text-text-light/45">{t('developer.sessionsHint')}</p>
                    </div>

                    <div className="space-y-3">
                        {loading ? (
                            <EmptyState label={t('developer.loading')} />
                        ) : sessions.length === 0 ? (
                            <EmptyState label={t('developer.noSessions')} />
                        ) : (
                            sessions.map((sessionItem) => (
                                <article key={sessionItem.id} className="rounded-2xl border border-secondary/10 bg-background-light px-4 py-3">
                                    <div className="text-sm font-bold text-text-light">{sessionItem.title}</div>
                                    <div className="mt-1 text-xs text-text-light/45">{new Date(sessionItem.updated_at).toLocaleString()}</div>
                                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-text-light/45">
                                        <span>{t('developer.sessionMessages')}: {sessionItem.message_count}</span>
                                        {sessionItem.preset_file_name && <span>{t('developer.sessionPreset')}: {sessionItem.preset_file_name}</span>}
                                    </div>
                                </article>
                            ))
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};

const MetricCard: React.FC<{ label: string; value: number }> = ({ label, value }) => (
    <div className="rounded-3xl border border-secondary/10 bg-white p-5 shadow-sm">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-text-light/35">{label}</div>
        <div className="mt-3 text-3xl font-heading font-bold text-cta">{value}</div>
    </div>
);

const EmptyState: React.FC<{ label: string }> = ({ label }) => (
    <div className="rounded-2xl border border-dashed border-secondary/15 px-4 py-8 text-center text-sm text-text-light/35">
        {label}
    </div>
);

const LoadingState: React.FC<{ label: string }> = ({ label }) => (
    <div className="flex h-full items-center justify-center">
        <div className="rounded-2xl border border-secondary/10 bg-white px-6 py-4 text-sm text-text-light/55 shadow-sm">{label}</div>
    </div>
);
