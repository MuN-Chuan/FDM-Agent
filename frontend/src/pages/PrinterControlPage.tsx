import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Cpu, HardDriveDownload, Printer, RefreshCw, ShieldCheck, Wifi } from 'lucide-react';

import { BambuLoginModal } from '../features/printer/BambuLoginModal';
import { useClientAgent } from '../features/slicer/useClientAgent';
import type { AgentMessage, BambuAccountType, BambuCloudRegion } from '../features/slicer/ClientAgentBridge';
import { useI18n } from '../i18n/I18nProvider';

interface PrinterLogEntry {
    id: string;
    ts: number;
    type: AgentMessage['type'];
    cmd?: string;
    message: string;
    raw?: string;
}

interface DiscoveredPrinter {
    id: string;
    name: string;
    ip: string | null;
    ip_source?: string | null;
    model: string | null;
    make: string | null;
    has_access_code: boolean;
    selected: boolean;
    cloud_online?: boolean;
}

interface PrinterStatus {
    id: string;
    name: string;
    ip: string | null;
    ip_source?: string | null;
    model: string | null;
    make: string | null;
    selected: boolean;
    online: boolean;
    cloud_online?: boolean;
    lan_online?: boolean;
    ftp: boolean;
    mqtt: boolean;
    printing_stage: string;
    task_name: string;
    progress_percent: string;
    remaining_time: string;
    speed: string;
    nozzle_diameter: string;
    ams_modules: string[];
    active_tray: string | null;
    has_external_spool: boolean;
    hms_errors: Array<{ code: string; message: string }>;
}

interface DiscoveryResponse {
    config_file: string;
    username: string | null;
    mqtt_user: string | null;
    account_linked?: boolean;
    login_required: boolean;
    binding_required?: boolean;
    selected_printer_id: string | null;
    machines: DiscoveredPrinter[];
}

interface StatusResponse extends DiscoveryResponse {
    checked_at?: string;
    message?: string;
    statuses: PrinterStatus[];
}

interface VerificationRequiredResponse {
    requires_verification_code: true;
    account: string;
    region?: BambuCloudRegion;
    account_type?: BambuAccountType;
    tfa_key?: string | null;
}

interface SendCodeResponse {
    sent: true;
    region: BambuCloudRegion;
    account_type: BambuAccountType;
    account: string;
}

function stringifyAgentPayload(value: unknown): string {
    if (typeof value === 'string') {
        return value;
    }

    if (value == null) {
        return '';
    }

    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

function createLogEntry(msg: AgentMessage): PrinterLogEntry {
    const raw = stringifyAgentPayload(msg.data);
    const text = msg.message || raw || msg.type;

    return {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        ts: Date.now(),
        type: msg.type,
        cmd: msg.cmd,
        message: text,
        raw: raw || undefined,
    };
}

function asDiscoveryResponse(data: unknown): DiscoveryResponse | null {
    if (!data || typeof data !== 'object') {
        return null;
    }
    return data as DiscoveryResponse;
}

function asStatusResponse(data: unknown): StatusResponse | null {
    if (!data || typeof data !== 'object') {
        return null;
    }
    return data as StatusResponse;
}

export const PrinterControlPage: React.FC = () => {
    const { t } = useI18n();
    const { agentStatus, capabilities, lastMessage, connect, disconnect, bridge } = useClientAgent();

    const [actionError, setActionError] = useState('');
    const [logs, setLogs] = useState<PrinterLogEntry[]>([]);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [discovery, setDiscovery] = useState<DiscoveryResponse | null>(null);
    const [statusData, setStatusData] = useState<StatusResponse | null>(null);
    const [loginHint, setLoginHint] = useState<string>('');
    const [statusOutput, setStatusOutput] = useState('');
    const [ipDrafts, setIpDrafts] = useState<Record<string, string>>({});
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [isLoginSubmitting, setIsLoginSubmitting] = useState(false);
    const [loginModalError, setLoginModalError] = useState('');
    const [loginStage, setLoginStage] = useState<'password' | 'verify_code'>('password');
    const [pendingVerifyAccount, setPendingVerifyAccount] = useState('');
    const [pendingVerifyAccountType, setPendingVerifyAccountType] = useState<BambuAccountType>('email');
    const [pendingVerifyRegion, setPendingVerifyRegion] = useState<BambuCloudRegion>('global');

    const supportedCommands = capabilities?.capabilities ?? [];
    const printerCount = statusData?.statuses.length ?? discovery?.machines.length ?? capabilities?.printer_count ?? 0;

    const summaryItems = useMemo(
        () => [
            { label: t('printer.summary.agent'), value: agentStatus },
            { label: t('printer.summary.host'), value: capabilities?.printer_host || t('printer.notConfigured') },
            { label: t('printer.summary.devices'), value: String(printerCount) },
        ],
        [agentStatus, capabilities?.printer_host, printerCount, t],
    );

    useEffect(() => {
        if (!lastMessage) {
            return;
        }

        setLogs((current) => [createLogEntry(lastMessage), ...current].slice(0, 24));

        if (lastMessage.type === 'error') {
            if (lastMessage.cmd === 'printer_login') {
                setIsLoginSubmitting(false);
                setLoginModalError(lastMessage.message || t('printer.loginFailed'));
            }
            if (lastMessage.cmd === 'printer_login_verify_code') {
                setIsLoginSubmitting(false);
                setLoginModalError(lastMessage.message || t('printer.verifyFailed'));
            }
            if (lastMessage.cmd === 'printer_send_login_code') {
                setIsLoginSubmitting(false);
                setLoginModalError(lastMessage.message || t('printer.verifyCodeSendFailed'));
            }
            setActionError(lastMessage.message || t('printer.actionFailed'));
            return;
        }

        setActionError('');

        if (lastMessage.type !== 'done') {
            return;
        }

        if (lastMessage.cmd === 'printer_discover') {
            const parsed = asDiscoveryResponse(lastMessage.data);
            if (parsed) {
                setDiscovery(parsed);
                setIpDrafts((current) => {
                    const next = { ...current };
                    parsed.machines.forEach((machine) => {
                        next[machine.id] = current[machine.id] ?? machine.ip ?? '';
                    });
                    return next;
                });
            }
        }

        if (lastMessage.cmd === 'printer_status') {
            const parsed = asStatusResponse(lastMessage.data);
            if (parsed) {
                setStatusData(parsed);
                setDiscovery(parsed);
                setStatusOutput(JSON.stringify(parsed.statuses, null, 2));
                setIpDrafts((current) => {
                    const next = { ...current };
                    parsed.machines.forEach((machine) => {
                        next[machine.id] = machine.ip ?? current[machine.id] ?? '';
                    });
                    return next;
                });
            }
        }

        if (lastMessage.cmd === 'printer_login') {
            const data = lastMessage.data as VerificationRequiredResponse | StatusResponse | null;
            if (data && typeof data === 'object' && 'requires_verification_code' in data) {
                setPendingVerifyAccount(data.account);
                setPendingVerifyAccountType(data.account_type || 'email');
                setPendingVerifyRegion(data.region || 'global');
                setLoginStage('verify_code');
                setIsLoginSubmitting(false);
                setLoginModalError('');
                return;
            }

            const parsed = asStatusResponse(data);
            if (parsed) {
                setDiscovery(parsed);
                setStatusData(parsed);
                setStatusOutput(JSON.stringify(parsed.statuses, null, 2));
                setIpDrafts((current) => {
                    const next = { ...current };
                    parsed.machines.forEach((machine) => {
                        next[machine.id] = machine.ip ?? current[machine.id] ?? '';
                    });
                    return next;
                });
                setIsLoginSubmitting(false);
                setLoginModalError('');
                setPendingVerifyAccount('');
                setPendingVerifyAccountType('email');
                setPendingVerifyRegion('global');
                setLoginStage('password');
                setIsLoginModalOpen(false);
            }
        }

        if (lastMessage.cmd === 'printer_login_verify_code') {
            const parsed = asStatusResponse(lastMessage.data);
            if (parsed) {
                setDiscovery(parsed);
                setStatusData(parsed);
                setStatusOutput(JSON.stringify(parsed.statuses, null, 2));
                setIpDrafts((current) => {
                    const next = { ...current };
                    parsed.machines.forEach((machine) => {
                        next[machine.id] = machine.ip ?? current[machine.id] ?? '';
                    });
                    return next;
                });
                setIsLoginSubmitting(false);
                setLoginModalError('');
                setPendingVerifyAccount('');
                setPendingVerifyAccountType('email');
                setPendingVerifyRegion('global');
                setLoginStage('password');
                setIsLoginModalOpen(false);
            }
        }

        if (lastMessage.cmd === 'printer_send_login_code') {
            const data = lastMessage.data as SendCodeResponse | null;
            if (data?.sent) {
                setPendingVerifyAccount(data.account);
                setPendingVerifyAccountType(data.account_type);
                setPendingVerifyRegion(data.region);
                setLoginStage('verify_code');
                setIsLoginSubmitting(false);
                setLoginModalError('');
            }
        }

        if (lastMessage.cmd === 'printer_set_ip') {
            const parsed = asStatusResponse(lastMessage.data);
            if (parsed) {
                setDiscovery(parsed);
                setStatusData(parsed);
                setStatusOutput(JSON.stringify(parsed.statuses, null, 2));
                setIpDrafts((current) => {
                    const next = { ...current };
                    parsed.machines.forEach((machine) => {
                        next[machine.id] = machine.ip ?? current[machine.id] ?? '';
                    });
                    return next;
                });
            }
        }

        if (lastMessage.cmd === 'printer_login_hint') {
            const raw = stringifyAgentPayload(lastMessage.data);
            setLoginHint(raw);
        }
    }, [lastMessage, t]);

    useEffect(() => {
        if (agentStatus !== 'connected') {
            return;
        }

        bridge.discoverPrinters();
        bridge.getPrinterStatus();
    }, [agentStatus, bridge]);

    useEffect(() => {
        if (!autoRefresh || agentStatus !== 'connected' || !supportedCommands.includes('printer_status')) {
            return;
        }

        const timer = window.setInterval(() => {
            bridge.getPrinterStatus();
        }, 15000);

        return () => window.clearInterval(timer);
    }, [agentStatus, autoRefresh, bridge, supportedCommands]);

    const handleConnectToggle = () => {
        if (agentStatus === 'connected') {
            disconnect();
            return;
        }
        connect();
    };

    const runAction = (action: () => boolean, fallbackMessage: string) => {
        const ok = action();
        if (!ok) {
            setActionError(fallbackMessage);
            return;
        }
        setActionError('');
    };

    const handleLoginSubmit = (
        account: string,
        password: string,
        accountType: BambuAccountType,
        region: BambuCloudRegion,
    ) => {
        const ok = bridge.loginBambuAccount(account, password, accountType, region);
        if (!ok) {
            setLoginModalError(t('printer.agentUnavailable'));
            return;
        }
        setPendingVerifyAccount(account);
        setPendingVerifyAccountType(accountType);
        setPendingVerifyRegion(region);
        setLoginModalError('');
        setIsLoginSubmitting(true);
    };

    const handleVerifyCodeSubmit = (
        accountInput: string,
        code: string,
        accountType: BambuAccountType,
        region: BambuCloudRegion,
    ) => {
        const account = pendingVerifyAccount || accountInput;
        const finalAccountType = pendingVerifyAccountType || accountType;
        const finalRegion = pendingVerifyRegion || region;
        const ok = bridge.verifyBambuLoginCode(account, code, finalAccountType, finalRegion);
        if (!ok) {
            setLoginModalError(t('printer.agentUnavailable'));
            return;
        }
        setLoginModalError('');
        setIsLoginSubmitting(true);
    };

    const handleSendCode = (
        accountInput: string,
        accountType: BambuAccountType,
        region: BambuCloudRegion,
    ) => {
        const account = pendingVerifyAccount || accountInput;
        const finalAccountType = pendingVerifyAccount || !accountInput ? pendingVerifyAccountType : accountType;
        const finalRegion = pendingVerifyAccount || !accountInput ? pendingVerifyRegion : region;
        setLoginModalError('');
        const ok = bridge.sendBambuLoginCode(account, finalAccountType, finalRegion);
        if (!ok) {
            setLoginModalError(t('printer.agentUnavailable'));
            return;
        }
        setPendingVerifyAccount(account);
        setPendingVerifyAccountType(finalAccountType);
        setPendingVerifyRegion(finalRegion);
        setLoginModalError(t('printer.verifyResendHint'));
        setIsLoginSubmitting(true);
    };

    const handleSavePrinterIp = (printerId: string) => {
        const ip = ipDrafts[printerId]?.trim() || '';
        if (!ip) {
            setActionError(t('printer.ipRequired'));
            return;
        }
        runAction(() => bridge.setPrinterIp(printerId, ip), t('printer.agentUnavailable'));
    };

    return (
        <>
            <div className="custom-scrollbar h-full overflow-y-auto pr-1 text-slate-900">
            <div className="space-y-8 pb-8">
                <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <div className="mb-2 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                        <span>Infrastructure</span>
                        <span>&gt;</span>
                        <span>Automation</span>
                        <span>&gt;</span>
                        <span className="font-semibold text-[var(--color-primary)]">{t('printer.title')}</span>
                    </div>
                    <h1 className="font-heading text-3xl font-extrabold tracking-tighter text-slate-950">
                        {t('printer.title')}
                    </h1>
                    <p className="mt-2 max-w-3xl text-sm text-[var(--color-text-muted)]">{t('printer.subtitle')}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={handleConnectToggle}
                        className={`inline-flex items-center gap-2 rounded px-4 py-2 text-sm font-semibold transition-all ${
                            agentStatus === 'connected'
                                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100'
                                : 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-container)]'
                        }`}
                    >
                        <Cpu size={16} />
                        {agentStatus === 'connected' ? t('printer.disconnectAgent') : t('printer.connectAgent')}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setLoginModalError('');
                            setLoginStage('password');
                            setPendingVerifyAccount('');
                            setPendingVerifyAccountType('email');
                            setPendingVerifyRegion('global');
                            setIsLoginModalOpen(true);
                        }}
                        className="inline-flex items-center gap-2 rounded border border-[var(--color-outline-variant)] bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50"
                    >
                        <ShieldCheck size={15} />
                        {t('printer.loginButton')}
                    </button>
                    <button
                        type="button"
                        onClick={() => runAction(() => bridge.discoverPrinters(), t('printer.agentUnavailable'))}
                        className="inline-flex items-center gap-2 rounded border border-[var(--color-outline-variant)] bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50"
                    >
                        <HardDriveDownload size={15} />
                        {t('printer.discover')}
                    </button>
                    <button
                        type="button"
                        onClick={() => runAction(() => bridge.getPrinterStatus(), t('printer.agentUnavailable'))}
                        className="inline-flex items-center gap-2 rounded border border-[var(--color-outline-variant)] bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50"
                    >
                        <RefreshCw size={15} />
                        {t('printer.refreshStatus')}
                    </button>
                </div>
                </section>

                {actionError ? (
                    <div className="flex items-start gap-3 rounded bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-100">
                        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                        <span>{actionError}</span>
                    </div>
                ) : null}

                <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                    <section className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-3">
                        {summaryItems.map((item) => (
                            <div
                                key={item.label}
                                className="rounded bg-white px-5 py-4 shadow-sm ring-1 ring-[rgba(191,202,186,0.35)]"
                            >
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                    {item.label}
                                </p>
                                <p className="mt-3 text-lg font-bold tracking-tight text-slate-950">{item.value}</p>
                            </div>
                        ))}
                    </div>

                    <div className="rounded bg-white p-6 shadow-sm ring-1 ring-[rgba(191,202,186,0.35)]">
                        <h2 className="font-heading text-xl font-bold tracking-tight text-slate-950">
                            {t('printer.capabilityPanel')}
                        </h2>
                        <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t('printer.capabilityPanelHint')}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                            {supportedCommands.length > 0 ? (
                                supportedCommands.map((cmd) => (
                                    <span
                                        key={cmd}
                                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                                    >
                                        {cmd}
                                    </span>
                                ))
                            ) : (
                                <span className="text-sm text-slate-500">{t('printer.noCapabilities')}</span>
                            )}
                        </div>
                    </div>

                    <div className="rounded bg-white p-6 shadow-sm ring-1 ring-[rgba(191,202,186,0.35)]">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="font-heading text-xl font-bold tracking-tight text-slate-950">
                                    {t('printer.discoveryTitle')}
                                </h2>
                                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                                    {t('printer.discoveryHint')}
                                </p>
                            </div>
                            <label className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                <input
                                    type="checkbox"
                                    checked={autoRefresh}
                                    onChange={(event) => setAutoRefresh(event.target.checked)}
                                    className="h-3.5 w-3.5 rounded border-slate-300 text-green-700 focus:ring-green-700"
                                />
                                {t('printer.autoRefresh')}
                            </label>
                        </div>

                        {discovery?.login_required ? (
                            <div className="mt-5 rounded bg-amber-50 px-4 py-4 text-sm text-amber-900 ring-1 ring-amber-200">
                                <div className="flex items-start gap-3">
                                    <ShieldCheck size={18} className="mt-0.5 shrink-0" />
                                    <div className="space-y-3">
                                        <p>{t('printer.loginRequired')}</p>
                                        <p className="text-xs text-amber-800">
                                            {t('printer.configFile')}: {discovery.config_file}
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setLoginModalError('');
                                                    setLoginStage('password');
                                                    setPendingVerifyAccount('');
                                                    setPendingVerifyAccountType('email');
                                                    setPendingVerifyRegion('global');
                                                    setIsLoginModalOpen(true);
                                                }}
                                                className="inline-flex items-center gap-2 rounded bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900 transition hover:bg-amber-200"
                                            >
                                                {t('printer.loginButton')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => runAction(() => bridge.getPrinterLoginHint(), t('printer.agentUnavailable'))}
                                                className="inline-flex items-center gap-2 rounded bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900 transition hover:bg-amber-200"
                                            >
                                                {t('printer.showLoginHint')}
                                            </button>
                                        </div>
                                        {loginHint ? (
                                            <pre className="max-h-40 overflow-auto rounded bg-amber-950/95 p-3 text-[11px] leading-5 text-amber-100">
                                                {loginHint}
                                            </pre>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        {discovery?.binding_required ? (
                            <div className="mt-5 rounded bg-sky-50 px-4 py-4 text-sm text-sky-900 ring-1 ring-sky-200">
                                <div className="flex items-start gap-3">
                                    <ShieldCheck size={18} className="mt-0.5 shrink-0" />
                                    <div className="space-y-2">
                                        <p>{t('printer.bindingRequired')}</p>
                                        <p className="text-xs text-sky-800">
                                            {t('printer.machineAccount')}: {discovery.username || 'n/a'}
                                        </p>
                                        <p className="text-xs text-sky-800">
                                            {t('printer.bindingHint')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        <div className="mt-5 grid gap-4 lg:grid-cols-2">
                            {(discovery?.machines ?? []).map((machine) => {
                                const status = statusData?.statuses.find((entry) => entry.id === machine.id);
                                return (
                                    <div
                                        key={machine.id}
                                        className={`rounded border px-4 py-4 ${
                                            machine.selected
                                                ? 'border-green-200 bg-green-50/50'
                                                : 'border-slate-200 bg-slate-50'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <h3 className="text-base font-semibold text-slate-950">
                                                    {machine.name || machine.id}
                                                </h3>
                                                <p className="mt-1 text-xs text-slate-500">{machine.id}</p>
                                            </div>
                                            <div
                                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                                    !machine.ip
                                                        ? 'bg-amber-100 text-amber-800'
                                                        : status?.cloud_online && !status?.lan_online
                                                        ? 'bg-sky-100 text-sky-800'
                                                        : status?.online
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : 'bg-slate-200 text-slate-600'
                                                }`}
                                            >
                                                {!machine.ip
                                                    ? t('printer.ipSyncRequired')
                                                    : status?.cloud_online && !status?.lan_online
                                                        ? t('printer.cloudOnlineOnly')
                                                    : status?.online
                                                        ? t('printer.online')
                                                        : t('printer.offline')}
                                            </div>
                                        </div>

                                        <div className="mt-4 space-y-2 text-sm text-slate-600">
                                            <p>{t('printer.machineIp')}: {machine.ip || t('printer.notConfigured')}</p>
                                            <p>{t('printer.machineIpSource')}: {status?.ip_source || machine.ip_source || 'n/a'}</p>
                                            <p>{t('printer.machineModel')}: {machine.make || machine.model || 'n/a'}</p>
                                            <p>{t('printer.machineAccount')}: {discovery?.username || 'n/a'}</p>
                                            <p>{t('printer.machineTask')}: {status?.task_name || 'n/a'}</p>
                                            <p>{t('printer.machineProgress')}: {status?.progress_percent || 'n/a'}</p>
                                        </div>

                                        <div className="mt-4 rounded border border-slate-200 bg-white/70 p-3">
                                            <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                                {t('printer.manualIpLabel')}
                                            </label>
                                            <div className="mt-2 flex gap-2">
                                                <input
                                                    type="text"
                                                    value={ipDrafts[machine.id] ?? machine.ip ?? ''}
                                                    onChange={(event) =>
                                                        setIpDrafts((current) => ({
                                                            ...current,
                                                            [machine.id]: event.target.value,
                                                        }))
                                                    }
                                                    placeholder={t('printer.manualIpPlaceholder')}
                                                    className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-[var(--color-primary)]"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleSavePrinterIp(machine.id)}
                                                    className="rounded bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[var(--color-primary-container)]"
                                                >
                                                    {t('printer.saveIp')}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="mt-4 flex flex-wrap gap-2">
                                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status?.cloud_online ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                                                Cloud: {status?.cloud_online ? 'OK' : 'n/a'}
                                            </span>
                                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status?.mqtt ? 'bg-sky-100 text-sky-800' : 'bg-slate-200 text-slate-600'}`}>
                                                MQTT: {status?.mqtt ? 'OK' : 'n/a'}
                                            </span>
                                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status?.ftp ? 'bg-violet-100 text-violet-800' : 'bg-slate-200 text-slate-600'}`}>
                                                FTP: {status?.ftp ? 'OK' : 'n/a'}
                                            </span>
                                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                                AMS: {status?.ams_modules?.join(', ') || 'n/a'}
                                            </span>
                                        </div>

                                        {/* Light Control Buttons */}
                                        {status?.cloud_online && supportedCommands.includes('printer_light_control') ? (
                                            <div className="mt-4 rounded border border-amber-200 bg-amber-50/50 p-3">
                                                <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">
                                                    {t('printer.lightControl')}
                                                </label>
                                                <div className="mt-2 flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => runAction(() => bridge.controlPrinterLight(machine.id, 'on'), t('printer.agentUnavailable'))}
                                                        className="flex-1 rounded bg-amber-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-600"
                                                    >
                                                        {t('printer.lightOn')}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => runAction(() => bridge.controlPrinterLight(machine.id, 'off'), t('printer.agentUnavailable'))}
                                                        className="flex-1 rounded bg-slate-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                                                    >
                                                        {t('printer.lightOff')}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => runAction(() => bridge.controlPrinterLight(machine.id, 'auto'), t('printer.agentUnavailable'))}
                                                        className="flex-1 rounded bg-sky-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-600"
                                                    >
                                                        {t('printer.lightAuto')}
                                                    </button>
                                                </div>
                                                <p className="mt-2 text-[11px] text-amber-700">
                                                    {t('printer.lightControlHint')}
                                                </p>
                                            </div>
                                        ) : null}
                                    </div>
                                );
                            })}

                            {!discovery?.login_required && (discovery?.machines.length ?? 0) === 0 ? (
                                <div className="rounded border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                                    {t('printer.noDiscoveredPrinters')}
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <div className="rounded bg-white p-6 shadow-sm ring-1 ring-[rgba(191,202,186,0.35)]">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="font-heading text-xl font-bold tracking-tight text-slate-950">
                                    {t('printer.machineActions')}
                                </h2>
                                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                                    {t('printer.machineActionsHint')}
                                </p>
                            </div>
                            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                {t('printer.futureCommands')}
                            </div>
                        </div>

                        <div className="mt-6 grid gap-3 md:grid-cols-3">
                            {[
                                { key: 'print_start', label: t('printer.sendAndPrint') },
                                { key: 'printer_home', label: t('printer.home') },
                                { key: 'ams_status', label: t('printer.refreshAms') },
                                { key: 'print_pause', label: t('printer.pause') },
                                { key: 'print_resume', label: t('printer.resume') },
                                { key: 'print_stop', label: t('printer.stop') },
                            ].map((item) => (
                                <button
                                    key={item.key}
                                    type="button"
                                    disabled
                                    className="cursor-not-allowed rounded border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-400"
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    </section>

                    <section className="space-y-6">
                    <div className="rounded bg-white p-6 shadow-sm ring-1 ring-[rgba(191,202,186,0.35)]">
                        <h2 className="font-heading text-xl font-bold tracking-tight text-slate-950">
                            {t('printer.statusPanel')}
                        </h2>
                        <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t('printer.statusPanelHint')}</p>
                        <pre className="mt-4 max-h-80 overflow-auto rounded bg-slate-950/95 p-4 text-xs leading-6 text-emerald-300">
                            {statusOutput || t('printer.noStatusData')}
                        </pre>
                    </div>

                    <div className="rounded bg-white p-6 shadow-sm ring-1 ring-[rgba(191,202,186,0.35)]">
                        <h2 className="font-heading text-xl font-bold tracking-tight text-slate-950">
                            {t('printer.activityLog')}
                        </h2>
                        <div className="mt-4 space-y-3">
                            {logs.length > 0 ? (
                                logs.map((entry) => (
                                    <div key={entry.id} className="rounded border border-slate-100 bg-slate-50 px-4 py-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="text-sm font-semibold text-slate-900">
                                                {entry.cmd || entry.type}
                                            </div>
                                            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                                {new Date(entry.ts).toLocaleTimeString()}
                                            </div>
                                        </div>
                                        <p className="mt-2 text-sm text-slate-600">{entry.message}</p>
                                        {entry.raw && entry.raw !== entry.message ? (
                                            <pre className="mt-3 max-h-40 overflow-auto rounded bg-slate-900 p-3 text-[11px] leading-5 text-slate-200">
                                                {entry.raw}
                                            </pre>
                                        ) : null}
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-slate-500">{t('printer.noLogs')}</p>
                            )}
                        </div>
                    </div>

                    <div className="rounded bg-white p-6 shadow-sm ring-1 ring-[rgba(191,202,186,0.35)]">
                        <h2 className="font-heading text-xl font-bold tracking-tight text-slate-950">
                            {t('printer.workflowTitle')}
                        </h2>
                        <div className="mt-4 space-y-3 text-sm text-slate-600">
                            <div className="flex items-start gap-3">
                                <Wifi size={16} className="mt-0.5 shrink-0 text-green-700" />
                                <p>{t('printer.workflowStep1')}</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <Printer size={16} className="mt-0.5 shrink-0 text-green-700" />
                                <p>{t('printer.workflowStep2')}</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-green-700" />
                                <p>{t('printer.workflowStep3')}</p>
                            </div>
                        </div>
                    </div>
                    </section>
                </div>
            </div>
            </div>

            <BambuLoginModal
                isOpen={isLoginModalOpen}
                stage={loginStage}
                isSubmitting={isLoginSubmitting}
                error={loginModalError}
                lockedAccount={pendingVerifyAccount || undefined}
                lockedAccountType={pendingVerifyAccountType}
                lockedRegion={pendingVerifyRegion}
                onClose={() => {
                    if (!isLoginSubmitting) {
                        setIsLoginModalOpen(false);
                        setLoginStage('password');
                        setPendingVerifyAccount('');
                        setPendingVerifyAccountType('email');
                        setPendingVerifyRegion('global');
                    }
                }}
                onSubmitPassword={handleLoginSubmit}
                onSubmitCode={handleVerifyCodeSubmit}
                onSendCode={handleSendCode}
            />
        </>
    );
};
