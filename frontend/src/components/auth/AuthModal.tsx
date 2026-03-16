import React, { useEffect, useState } from 'react';
import { Loader2, LogIn, UserPlus, X } from 'lucide-react';
import { api } from '../../api/api';
import type { RegistrationPolicy, UserProfile } from '../../api/api';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAuthSuccess: (user: UserProfile) => void;
}

type Mode = 'login' | 'register';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess }) => {
    const [mode, setMode] = useState<Mode>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [policy, setPolicy] = useState<RegistrationPolicy | null>(null);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        void api.getRegistrationPolicy()
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
        setInviteCode('');
        setError(null);
        setIsSubmitting(false);
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            if (mode === 'register' && policy?.registration_enabled === false) {
                throw new Error('Registration is currently disabled');
            }

            const user = mode === 'login'
                ? await api.login({ email, password })
                : await api.register({ email, password, invite_code: inviteCode || undefined });
            onAuthSuccess(user);
            handleClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-white shadow-2xl overflow-hidden">
                <div className="px-6 pt-6 pb-4 flex items-start justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.24em] text-cta/80">
                            Account
                        </p>
                        <h2 className="mt-2 text-2xl font-heading font-bold text-text-light">
                            {mode === 'login' ? 'Sign in' : 'Create test account'}
                        </h2>
                        <p className="mt-2 text-sm text-text-light/60">
                            {mode === 'login'
                                ? 'After signing in, chat history will be stored in the cloud first.'
                                : policy?.registration_enabled === false
                                    ? 'Registration is currently closed. Existing test accounts can still sign in.'
                                    : policy?.invite_required
                                        ? 'Registration is enabled, but an invite code is required for new test accounts.'
                                        : 'For small-scale testing, you can register directly. Invite code is optional for now.'}
                        </p>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 rounded-full text-text-light/40 hover:text-text-light hover:bg-secondary/10 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="px-6">
                    <div className="grid grid-cols-2 gap-2 rounded-2xl bg-secondary/5 p-1">
                        <button
                            type="button"
                            onClick={() => { setMode('login'); setError(null); }}
                            className={`rounded-2xl px-4 py-2.5 text-sm font-bold transition-all ${
                                mode === 'login' ? 'bg-white text-cta shadow-sm' : 'text-text-light/55'
                            }`}
                        >
                            Sign in
                        </button>
                        <button
                            type="button"
                            onClick={() => { setMode('register'); setError(null); }}
                            className={`rounded-2xl px-4 py-2.5 text-sm font-bold transition-all ${
                                mode === 'register' ? 'bg-white text-cta shadow-sm' : 'text-text-light/55'
                            }`}
                            disabled={policy?.registration_enabled === false}
                        >
                            Register
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
                    <label className="block">
                        <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-text-light/45">
                            Email
                        </span>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full rounded-2xl border border-secondary/15 bg-secondary/5 px-4 py-3 text-sm outline-none transition focus:border-cta/40 focus:ring-4 focus:ring-cta/10"
                            placeholder="you@example.com"
                        />
                    </label>

                    <label className="block">
                        <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-text-light/45">
                            Password
                        </span>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={8}
                            className="w-full rounded-2xl border border-secondary/15 bg-secondary/5 px-4 py-3 text-sm outline-none transition focus:border-cta/40 focus:ring-4 focus:ring-cta/10"
                            placeholder="At least 8 characters"
                        />
                    </label>

                    {mode === 'register' && policy?.registration_enabled !== false && (
                        <label className="block">
                            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-text-light/45">
                                Invite Code {policy?.invite_required ? '*' : ''}
                            </span>
                            <input
                                type="text"
                                value={inviteCode}
                                onChange={(e) => setInviteCode(e.target.value)}
                                required={policy?.invite_required}
                                className="w-full rounded-2xl border border-secondary/15 bg-secondary/5 px-4 py-3 text-sm outline-none transition focus:border-cta/40 focus:ring-4 focus:ring-cta/10"
                                placeholder={policy?.invite_required ? 'Required' : 'Optional'}
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
                        className="w-full flex items-center justify-center gap-2 rounded-2xl bg-cta px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-cta/20 transition hover:bg-cta-hover disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        {isSubmitting ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : mode === 'login' ? (
                            <LogIn size={18} />
                        ) : (
                            <UserPlus size={18} />
                        )}
                        {mode === 'login' ? 'Sign in and sync chats' : 'Register and start using'}
                    </button>
                </form>
            </div>
        </div>
    );
};
