import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BellDot, MessageSquareMore, RefreshCw, Users } from 'lucide-react';

import { api } from '../api/api';
import type {
    DeveloperFeedbackItem,
    DeveloperOverview,
    DeveloperSessionItem,
    DeveloperSessionStatus,
} from '../api/api';
import { DeveloperAuthPanel } from '../features/developer/components/DeveloperAuthPanel';
import { DeveloperFeedbackPanel } from '../features/developer/components/DeveloperFeedbackPanel';
import { DeveloperMetricCard } from '../features/developer/components/DeveloperMetricCard';
import { DeveloperSessionPanel } from '../features/developer/components/DeveloperSessionPanel';
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

    const feedbackRate = useMemo(() => {
        const total = overview?.feedback ?? 0;
        const negative = overview?.negative_feedback ?? 0;

        if (!total) {
            return '0%';
        }

        return `${Math.max(0, Math.round(((total - negative) / total) * 100))}%`;
    }, [overview]);

    const negativeRate = useMemo(() => {
        const total = overview?.feedback ?? 0;
        const negative = overview?.negative_feedback ?? 0;

        if (!total) {
            return '0% of feedback';
        }

        return `${Math.round((negative / total) * 100)}% of feedback`;
    }, [overview]);

    const sessionPeak = useMemo(() => {
        if (!sessions.length) {
            return '0 concurrent peaks';
        }

        return `${Math.max(1, Math.min(sessions.length, Math.ceil(sessions.length * 0.35)))} concurrent peaks`;
    }, [sessions]);

    const featureLabels = useMemo(
        () => [t('developer.feedbackTitle'), t('developer.sessionsTitle'), t('developer.metricFeedback')],
        [t],
    );

    if (authLoading) {
        return (
            <div className="flex h-full min-h-[440px] items-center justify-center">
                <div className="rounded bg-white px-6 py-4 text-sm text-slate-600 shadow-sm ring-1 ring-[rgba(191,202,186,0.35)]">
                    {t('developer.loading')}
                </div>
            </div>
        );
    }

    if (!session) {
        return (
            <DeveloperAuthPanel
                title={t('developer.authTitle')}
                subtitle={t('developer.authSubtitle')}
                emailLabel={t('auth.email')}
                passwordLabel={t('auth.password')}
                submitLabel={t('developer.authSubmit')}
                submittingLabel={t('developer.authSubmitting')}
                email={email}
                password={password}
                authSubmitting={authSubmitting}
                authError={authError}
                featureLabels={featureLabels}
                onEmailChange={setEmail}
                onPasswordChange={setPassword}
                onSubmit={handleLogin}
            />
        );
    }

    return (
        <div className="space-y-8">
            <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
                        <span>Infrastructure</span>
                        <span>&gt;</span>
                        <span>Diagnostics</span>
                        <span>&gt;</span>
                        <span className="font-semibold text-[var(--color-primary)]">Report Center</span>
                    </div>
                    <h1 className="font-heading text-3xl font-extrabold tracking-tight text-slate-950">
                        {t('developer.title')}
                    </h1>
                    <p className="mt-2 max-w-3xl text-sm text-slate-600">{t('developer.subtitle')}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="rounded bg-[var(--color-surface-muted)] px-3 py-2 text-xs text-slate-600">
                        Signed in as <span className="font-semibold text-slate-900">{session.email}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="inline-flex items-center gap-2 rounded bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-[rgba(191,202,186,0.35)] transition-colors hover:bg-[var(--color-surface-muted)]"
                    >
                        <RefreshCw size={15} />
                        {t('developer.refresh')}
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleLogout()}
                        className="inline-flex items-center gap-2 rounded bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-container)]"
                    >
                        {t('developer.logout')}
                    </button>
                </div>
            </section>

            {error ? (
                <div className="flex items-start gap-3 rounded bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-100">
                    <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                </div>
            ) : null}

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                <DeveloperMetricCard
                    label="Total Users"
                    value={overview?.users ?? 0}
                    icon={Users}
                    tone="tertiary"
                    supportingText={`${sessions.length} tracked sessions`}
                />
                <DeveloperMetricCard
                    label="Active Sessions"
                    value={overview?.chat_sessions ?? 0}
                    icon={MessageSquareMore}
                    tone="secondary"
                    supportingText={sessionPeak}
                />
                <DeveloperMetricCard
                    label="Total Feedback"
                    value={overview?.feedback ?? 0}
                    icon={BellDot}
                    tone="primary"
                    supportingText={`${feedbackRate} positive rate`}
                />
                <DeveloperMetricCard
                    label="Negative Feedback"
                    value={overview?.negative_feedback ?? 0}
                    icon={AlertTriangle}
                    tone="danger"
                    supportingText={negativeRate}
                />
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <DeveloperFeedbackPanel
                        loading={loading}
                        feedback={feedback}
                        ratingFilter={ratingFilter}
                        onFilterChange={setRatingFilter}
                    />
                </div>
                <div>
                    <DeveloperSessionPanel loading={loading} sessions={sessions} positiveRate={feedbackRate} />
                </div>
            </div>
        </div>
    );
};
