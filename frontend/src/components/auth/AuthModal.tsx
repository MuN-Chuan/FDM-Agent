import React, { useEffect, useState } from 'react';
import { Loader2, LogIn, Mail, UserPlus, X } from 'lucide-react';

import { api } from '../../api/api';
import type { RegistrationPolicy, UserProfile } from '../../api/api';
import { useI18n } from '../../i18n/I18nProvider';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAuthSuccess: (user: UserProfile) => void;
}

type Mode = 'login' | 'register';
type LoginMethod = 'password' | 'email_code';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess }) => {
    const { t } = useI18n();
    const [mode, setMode] = useState<Mode>('login');
    const [loginMethod, setLoginMethod] = useState<LoginMethod>('password');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [emailCode, setEmailCode] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSendingCode, setIsSendingCode] = useState(false);
    const [codeMessage, setCodeMessage] = useState<string | null>(null);
    const [debugCode, setDebugCode] = useState<string | null>(null);
    const [policy, setPolicy] = useState<RegistrationPolicy | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        void api
            .getRegistrationPolicy()
            .then(setPolicy)
            .catch(() => {
                setPolicy({
                    mode: 'open',
                    invite_required: false,
                    registration_enabled: true,
                });
            });
    }, [isOpen]);

    if (!isOpen) return null;

    const reset = () => {
        setEmail('');
        setPassword('');
        setEmailCode('');
        setInviteCode('');
        setError(null);
        setCodeMessage(null);
        setDebugCode(null);
        setIsSubmitting(false);
        setIsSendingCode(false);
        setLoginMethod('password');
        setMode('login');
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    const handleSendCode = async () => {
        setError(null);
        setCodeMessage(null);
        setDebugCode(null);
        setIsSendingCode(true);

        try {
            const response = await api.requestEmailCode({ email });
            setCodeMessage(response.message || t('auth.codeSent'));
            setDebugCode(response.debug_code ?? null);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsSendingCode(false);
        }
    };

    const handleSendRegisterCode = async () => {
        setError(null);
        setCodeMessage(null);
        setDebugCode(null);
        setIsSendingCode(true);

        try {
            const response = await api.requestEmailCode({ email, purpose: 'register' });
            setCodeMessage(response.message || t('auth.codeSent'));
            setDebugCode(response.debug_code ?? null);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsSendingCode(false);
        }
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            if (mode === 'register' && policy?.registration_enabled === false) {
                throw new Error(t('auth.registrationClosed'));
            }

            let user: UserProfile;
            if (mode === 'register') {
                user = await api.registerWithEmailCode({ email, code: emailCode, invite_code: inviteCode || undefined });
            } else if (loginMethod === 'password') {
                user = await api.login({ email, password });
            } else {
                user = await api.loginWithEmailCode({ email, code: emailCode });
            }

            onAuthSuccess(user);
            handleClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-white shadow-2xl">
                <div className="flex items-start justify-between px-6 pb-4 pt-6">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.24em] text-cta/80">{t('auth.account')}</p>
                        <h2 className="mt-2 text-2xl font-heading font-bold text-text-light">
                            {mode === 'login' ? t('auth.loginTitle') : t('auth.registerTitle')}
                        </h2>
                        <p className="mt-2 text-sm text-text-light/60">
                            {mode === 'login'
                                ? t('auth.loginDesc')
                                : policy?.registration_enabled === false
                                  ? t('auth.registrationClosed')
                                  : policy?.invite_required
                                    ? t('auth.inviteRequired')
                                    : t('auth.registerDesc')}
                        </p>
                    </div>
                    <button
                        onClick={handleClose}
                        className="rounded-full p-2 text-text-light/40 transition-colors hover:bg-secondary/10 hover:text-text-light"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="px-6">
                    <div className="grid grid-cols-2 gap-2 rounded-2xl bg-secondary/5 p-1">
                        <button
                            type="button"
                            onClick={() => {
                                setMode('login');
                                setError(null);
                            }}
                            className={`rounded-2xl px-4 py-2.5 text-sm font-bold transition-all ${
                                mode === 'login' ? 'bg-white text-cta shadow-sm' : 'text-text-light/55'
                            }`}
                        >
                            {t('auth.loginTab')}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setMode('register');
                                setError(null);
                            }}
                            className={`rounded-2xl px-4 py-2.5 text-sm font-bold transition-all ${
                                mode === 'register' ? 'bg-white text-cta shadow-sm' : 'text-text-light/55'
                            }`}
                            disabled={policy?.registration_enabled === false}
                        >
                            {t('auth.registerTab')}
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 px-6 py-6">
                    {mode === 'login' && (
                        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-secondary/5 p-1">
                            <button
                                type="button"
                                onClick={() => setLoginMethod('password')}
                                className={`rounded-2xl px-4 py-2 text-xs font-bold transition-all ${
                                    loginMethod === 'password' ? 'bg-white text-cta shadow-sm' : 'text-text-light/55'
                                }`}
                            >
                                {t('auth.passwordMode')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setLoginMethod('email_code')}
                                className={`rounded-2xl px-4 py-2 text-xs font-bold transition-all ${
                                    loginMethod === 'email_code' ? 'bg-white text-cta shadow-sm' : 'text-text-light/55'
                                }`}
                            >
                                {t('auth.emailCodeMode')}
                            </button>
                        </div>
                    )}

                    <label className="block">
                        <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-text-light/45">
                            {t('auth.email')}
                        </span>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full rounded-2xl border border-secondary/15 bg-secondary/5 px-4 py-3 text-sm outline-none transition focus:border-cta/40 focus:ring-4 focus:ring-cta/10"
                            placeholder={t('auth.emailPlaceholder')}
                        />
                    </label>

                    {mode === 'login' && loginMethod === 'password' && (
                        <label className="block">
                            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-text-light/45">
                                {t('auth.password')}
                            </span>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={8}
                                className="w-full rounded-2xl border border-secondary/15 bg-secondary/5 px-4 py-3 text-sm outline-none transition focus:border-cta/40 focus:ring-4 focus:ring-cta/10"
                                placeholder={t('auth.passwordPlaceholder')}
                            />
                        </label>
                    )}

                    {(mode === 'register' || (mode === 'login' && loginMethod === 'email_code')) && (
                        <>
                            <div className="flex gap-2">
                                <label className="block flex-1">
                                    <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-text-light/45">
                                        {t('auth.code')}
                                    </span>
                                    <input
                                        type="text"
                                        value={emailCode}
                                        onChange={(e) => setEmailCode(e.target.value)}
                                        required
                                        className="w-full rounded-2xl border border-secondary/15 bg-secondary/5 px-4 py-3 text-sm outline-none transition focus:border-cta/40 focus:ring-4 focus:ring-cta/10"
                                        placeholder={t('auth.codePlaceholder')}
                                    />
                                </label>
                                <button
                                    type="button"
                                    onClick={() =>
                                        void (mode === 'register' ? handleSendRegisterCode() : handleSendCode())
                                    }
                                    disabled={isSendingCode || !email}
                                    className="mt-7 flex items-center gap-2 rounded-2xl border border-cta/20 bg-cta/10 px-4 py-3 text-sm font-bold text-cta transition hover:bg-cta/15 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isSendingCode ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                                    {codeMessage ? t('auth.resendCode') : t('auth.sendCode')}
                                </button>
                            </div>
                            {codeMessage && (
                                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                                    <p>{t('auth.codeSent')}</p>
                                    {debugCode && (
                                        <p className="mt-2 font-mono text-xs">
                                            {t('auth.debugCode')}: {debugCode}
                                        </p>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {mode === 'register' && policy?.registration_enabled !== false && (
                        <label className="block">
                            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-text-light/45">
                                {t('auth.inviteCode')} {policy?.invite_required ? '*' : ''}
                            </span>
                            <input
                                type="text"
                                value={inviteCode}
                                onChange={(e) => setInviteCode(e.target.value)}
                                required={policy?.invite_required}
                                className="w-full rounded-2xl border border-secondary/15 bg-secondary/5 px-4 py-3 text-sm outline-none transition focus:border-cta/40 focus:ring-4 focus:ring-cta/10"
                                placeholder={policy?.invite_required ? t('auth.inviteRequiredPlaceholder') : t('auth.inviteOptionalPlaceholder')}
                            />
                        </label>
                    )}

                    {error && (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cta px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-cta/20 transition hover:bg-cta disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        {isSubmitting ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : mode === 'register' ? (
                            <UserPlus size={18} />
                        ) : loginMethod === 'email_code' ? (
                            <Mail size={18} />
                        ) : (
                            <LogIn size={18} />
                        )}
                        {mode === 'register'
                            ? t('auth.codeRegisterSubmit')
                            : loginMethod === 'email_code'
                              ? t('auth.codeLoginSubmit')
                              : t('auth.loginSubmit')}
                    </button>
                </form>
            </div>
        </div>
    );
};
