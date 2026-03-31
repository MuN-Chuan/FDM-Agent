import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, LogIn, MailCheck, ShieldCheck, Smartphone, X } from 'lucide-react';

import { useI18n } from '../../i18n/I18nProvider';
import type { BambuAccountType, BambuCloudRegion } from '../slicer/ClientAgentBridge';

type LoginStage = 'password' | 'verify_code';
type LoginMethod = 'password' | 'code';

interface BambuLoginModalProps {
    isOpen: boolean;
    stage: LoginStage;
    isSubmitting: boolean;
    error: string;
    lockedAccount?: string;
    lockedAccountType?: BambuAccountType;
    lockedRegion?: BambuCloudRegion;
    onClose: () => void;
    onSubmitPassword: (account: string, password: string, accountType: BambuAccountType, region: BambuCloudRegion) => void;
    onSubmitCode: (account: string, code: string, accountType: BambuAccountType, region: BambuCloudRegion) => void;
    onSendCode: (account: string, accountType: BambuAccountType, region: BambuCloudRegion) => void;
}

function defaultRegionForAccountType(accountType: BambuAccountType): BambuCloudRegion {
    return accountType === 'phone' ? 'cn' : 'global';
}

export const BambuLoginModal: React.FC<BambuLoginModalProps> = ({
    isOpen,
    stage,
    isSubmitting,
    error,
    lockedAccount,
    lockedAccountType,
    lockedRegion,
    onClose,
    onSubmitPassword,
    onSubmitCode,
    onSendCode,
}) => {
    const { t } = useI18n();
    const [account, setAccount] = useState('');
    const [password, setPassword] = useState('');
    const [code, setCode] = useState('');
    const [accountType, setAccountType] = useState<BambuAccountType>('email');
    const [region, setRegion] = useState<BambuCloudRegion>('global');
    const [method, setMethod] = useState<LoginMethod>('password');

    useEffect(() => {
        if (!isOpen) {
            setAccount('');
            setPassword('');
            setCode('');
            setAccountType('email');
            setRegion('global');
            setMethod('password');
        }
    }, [isOpen]);

    useEffect(() => {
        const trimmedAccount = account.trim();
        // Auto-detect Chinese phone number (11 digits starting with 1)
        if (/^1\d{10}$/.test(trimmedAccount)) {
            if (accountType !== 'phone' || region !== 'cn') {
                setAccountType('phone');
                setRegion('cn');
            }
        }
    }, [account, accountType, region]);

    useEffect(() => {
        if (stage === 'verify_code') {
            if (lockedAccount) {
                setAccount(lockedAccount);
            }
            if (lockedAccountType) {
                setAccountType(lockedAccountType);
            }
            if (lockedRegion) {
                setRegion(lockedRegion);
            }
            setMethod('code');
        }
    }, [lockedAccount, lockedAccountType, lockedRegion, stage]);

    const accountPlaceholder = useMemo(
        () => (accountType === 'phone' ? t('printer.loginPhonePlaceholder') : t('printer.loginEmailPlaceholder')),
        [accountType, t],
    );

    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-white/10 bg-white shadow-2xl">
                <div className="flex items-start justify-between px-6 pb-4 pt-6">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-[var(--color-primary)]">
                            <ShieldCheck size={15} />
                            Bambu Lab
                        </div>
                        <h2 className="mt-3 text-2xl font-heading font-bold text-text-light">
                            {stage === 'password' ? t('printer.loginModalTitle') : t('printer.verifyModalTitle')}
                        </h2>
                        <p className="mt-2 text-sm text-text-light/60">
                            {stage === 'password' ? t('printer.loginModalSubtitle') : t('printer.verifyModalSubtitle')}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-full p-2 text-text-light/40 transition-colors hover:bg-secondary/10 hover:text-text-light"
                    >
                        <X size={18} />
                    </button>
                </div>

                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (stage === 'verify_code') {
                            onSubmitCode(account.trim(), code.trim(), accountType, region);
                            return;
                        }
                        if (method === 'password') {
                            onSubmitPassword(account.trim(), password, accountType, region);
                            return;
                        }
                        onSubmitCode(account.trim(), code.trim(), accountType, region);
                    }}
                    className="space-y-5 px-6 pb-6"
                >
                    <div className="grid gap-4 md:grid-cols-3">
                        <label className="block">
                            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-text-light/45">
                                {t('printer.accountTypeLabel')}
                            </span>
                            <select
                                value={accountType}
                                onChange={(event) => {
                                    const nextType = event.target.value as BambuAccountType;
                                    setAccountType(nextType);
                                    if (stage !== 'verify_code') {
                                        setRegion(defaultRegionForAccountType(nextType));
                                    }
                                }}
                                disabled={stage === 'verify_code'}
                                className="w-full rounded-2xl border border-secondary/15 bg-secondary/5 px-4 py-3 text-sm outline-none transition focus:border-cta/40 focus:ring-4 focus:ring-cta/10 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                <option value="email">{t('printer.accountTypeEmail')}</option>
                                <option value="phone">{t('printer.accountTypePhone')}</option>
                            </select>
                        </label>

                        <label className="block">
                            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-text-light/45">
                                {t('printer.loginMethodLabel')}
                            </span>
                            <select
                                value={stage === 'verify_code' ? 'code' : method}
                                onChange={(event) => setMethod(event.target.value as LoginMethod)}
                                disabled={stage === 'verify_code'}
                                className="w-full rounded-2xl border border-secondary/15 bg-secondary/5 px-4 py-3 text-sm outline-none transition focus:border-cta/40 focus:ring-4 focus:ring-cta/10 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                <option value="password">{t('printer.loginMethodPassword')}</option>
                                <option value="code">{t('printer.loginMethodCode')}</option>
                            </select>
                        </label>

                        <label className="block">
                            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-text-light/45">
                                {t('printer.loginRegionLabel')}
                            </span>
                            <select
                                value={region}
                                onChange={(event) => setRegion(event.target.value as BambuCloudRegion)}
                                disabled={stage === 'verify_code'}
                                className="w-full rounded-2xl border border-secondary/15 bg-secondary/5 px-4 py-3 text-sm outline-none transition focus:border-cta/40 focus:ring-4 focus:ring-cta/10 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                <option value="global">{t('printer.loginRegionGlobal')}</option>
                                <option value="cn">{t('printer.loginRegionCn')}</option>
                            </select>
                        </label>
                    </div>

                    <label className="block">
                        <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-text-light/45">
                            {accountType === 'phone' ? t('printer.loginPhone') : t('printer.loginEmail')}
                        </span>
                        <input
                            type={accountType === 'phone' ? 'tel' : 'email'}
                            value={account}
                            onChange={(event) => setAccount(event.target.value)}
                            required
                            disabled={stage === 'verify_code'}
                            className="w-full rounded-2xl border border-secondary/15 bg-secondary/5 px-4 py-3 text-sm outline-none transition focus:border-cta/40 focus:ring-4 focus:ring-cta/10 disabled:cursor-not-allowed disabled:opacity-70"
                            placeholder={accountPlaceholder}
                        />
                    </label>

                    {stage === 'password' && method === 'password' ? (
                        <label className="block">
                            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-text-light/45">
                                {t('printer.loginPassword')}
                            </span>
                            <input
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                required
                                className="w-full rounded-2xl border border-secondary/15 bg-secondary/5 px-4 py-3 text-sm outline-none transition focus:border-cta/40 focus:ring-4 focus:ring-cta/10"
                                placeholder={t('auth.passwordPlaceholder')}
                            />
                        </label>
                    ) : null}

                    {(stage === 'verify_code' || method === 'code') ? (
                        <div className="space-y-4 rounded-3xl border border-secondary/15 bg-secondary/5 p-4">
                            <div className="flex flex-wrap items-center gap-2 text-sm text-text-light/70">
                                <CheckCircle2 size={16} className="text-emerald-600" />
                                <span>{t('printer.verifyTarget')}:</span>
                                <span className="font-semibold text-text-light">{account || '-'}</span>
                            </div>
                            <label className="block">
                                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-text-light/45">
                                    {t('printer.verifyCodeLabel')}
                                </span>
                                <input
                                    type="text"
                                    value={code}
                                    onChange={(event) => setCode(event.target.value)}
                                    required={stage === 'verify_code' || method === 'code'}
                                    className="w-full rounded-2xl border border-secondary/15 bg-white px-4 py-3 text-sm outline-none transition focus:border-cta/40 focus:ring-4 focus:ring-cta/10"
                                    placeholder={t('printer.verifyCodePlaceholder')}
                                />
                            </label>
                            <div className="flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    disabled={isSubmitting || !account.trim()}
                                    onClick={() => onSendCode(account.trim(), accountType, region)}
                                    className="inline-flex items-center gap-2 rounded-2xl border border-cta/20 bg-cta/10 px-4 py-2 text-sm font-bold text-cta transition hover:bg-cta/15 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {accountType === 'phone' ? <Smartphone size={16} /> : <MailCheck size={16} />}
                                    {t('printer.verifySendCode')}
                                </button>
                                {stage === 'verify_code' ? (
                                    <button
                                        type="button"
                                        disabled={isSubmitting || !account.trim()}
                                        onClick={() => onSendCode(account.trim(), accountType, region)}
                                        className="inline-flex items-center gap-2 rounded-2xl border border-cta/20 bg-white px-4 py-2 text-sm font-bold text-cta transition hover:bg-cta/10 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <MailCheck size={16} />
                                        {t('printer.verifyResend')}
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    ) : null}

                    <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                        {stage === 'password'
                            ? method === 'password'
                                ? t('printer.loginModalNotice')
                                : t('printer.codeLoginNotice')
                            : t('printer.verifyModalNotice')}
                    </div>

                    {error ? (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {error}
                        </div>
                    ) : null}

                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="inline-flex items-center justify-center rounded-2xl border border-secondary/15 bg-white px-4 py-3 text-sm font-semibold text-text-light/70 transition hover:bg-secondary/5 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {t('chat.cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={
                                isSubmitting
                                || !account.trim()
                                || ((stage === 'password' && method === 'password') ? !password : false)
                                || ((stage === 'verify_code' || method === 'code') ? !code.trim() : false)
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cta px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-cta/20 transition hover:bg-cta disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {isSubmitting ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : stage === 'password' && method === 'password' ? (
                                <LogIn size={18} />
                            ) : (
                                <MailCheck size={18} />
                            )}
                            {isSubmitting
                                ? stage === 'password' && method === 'password'
                                    ? t('printer.loginSubmitting')
                                    : t('printer.verifySubmitting')
                                : t('printer.confirmButton')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
