import React from 'react';
import { LockKeyhole, ShieldCheck } from 'lucide-react';

interface DeveloperAuthPanelProps {
    title: string;
    subtitle: string;
    emailLabel: string;
    passwordLabel: string;
    submitLabel: string;
    submittingLabel: string;
    email: string;
    password: string;
    authSubmitting: boolean;
    authError: string;
    featureLabels: string[];
    onEmailChange: (value: string) => void;
    onPasswordChange: (value: string) => void;
    onSubmit: () => void | Promise<void>;
}

export const DeveloperAuthPanel: React.FC<DeveloperAuthPanelProps> = ({
    title,
    subtitle,
    emailLabel,
    passwordLabel,
    submitLabel,
    submittingLabel,
    email,
    password,
    authSubmitting,
    authError,
    featureLabels,
    onEmailChange,
    onPasswordChange,
    onSubmit,
}) => (
    <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded bg-white p-8 shadow-sm ring-1 ring-[rgba(191,202,186,0.35)] lg:p-10">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-primary)]">
                <ShieldCheck size={15} />
                Developer Access
            </div>
            <h1 className="mt-5 max-w-xl font-heading text-4xl font-extrabold tracking-tight text-slate-950">
                {title}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">{subtitle}</p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {featureLabels.map((label) => (
                    <div key={label} className="rounded bg-[var(--color-surface-muted)] p-4">
                        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Scope</div>
                        <p className="mt-3 text-sm font-medium text-slate-700">{label}</p>
                    </div>
                ))}
            </div>
        </section>

        <section className="rounded bg-white p-6 shadow-sm ring-1 ring-[rgba(191,202,186,0.35)] lg:p-8">
            <div className="flex items-center gap-3 text-slate-900">
                <div className="flex h-11 w-11 items-center justify-center rounded bg-[var(--color-primary)] text-white">
                    <LockKeyhole size={18} />
                </div>
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Secure sign-in</p>
                    <p className="mt-1 text-sm text-slate-600">Review runtime data in an isolated developer workspace.</p>
                </div>
            </div>

            <div className="mt-8 space-y-4">
                <label className="block">
                    <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                        {emailLabel}
                    </span>
                    <input
                        type="email"
                        value={email}
                        onChange={(event) => onEmailChange(event.target.value)}
                        className="w-full rounded border border-[var(--shell-border)] bg-[var(--color-surface-muted)] px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-[var(--color-primary)] focus:bg-white"
                    />
                </label>

                <label className="block">
                    <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                        {passwordLabel}
                    </span>
                    <input
                        type="password"
                        value={password}
                        onChange={(event) => onPasswordChange(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                void onSubmit();
                            }
                        }}
                        className="w-full rounded border border-[var(--shell-border)] bg-[var(--color-surface-muted)] px-4 py-3 text-sm text-slate-900 outline-none transition-all focus:border-[var(--color-primary)] focus:bg-white"
                    />
                </label>
            </div>

            {authError ? (
                <div className="mt-4 rounded bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-100">
                    {authError}
                </div>
            ) : null}

            <button
                type="button"
                onClick={() => void onSubmit()}
                disabled={authSubmitting || !email.trim() || !password}
                className="mt-6 inline-flex w-full items-center justify-center rounded bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-container)] disabled:cursor-not-allowed disabled:opacity-60"
            >
                {authSubmitting ? submittingLabel : submitLabel}
            </button>
        </section>
    </div>
);
