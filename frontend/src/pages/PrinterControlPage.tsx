import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Cpu, HardDriveDownload, RefreshCw, ShieldCheck } from 'lucide-react';

import { BambuLoginModal } from '../features/printer/BambuLoginModal';
import { MultiPrinterDashboard } from '../features/printer/MultiPrinterDashboard';
import { PrinterDetailView } from '../features/printer/PrinterDetailView';
import type { PrinterLogEntry, DiscoveryResponse, StatusResponse, AmsModule } from '../features/printer/types';
import { useClientAgent } from '../features/slicer/useClientAgent';
import type { AgentMessage, BambuAccountType, BambuCloudRegion } from '../features/slicer/ClientAgentBridge';
import { useI18n } from '../i18n/I18nProvider';

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

interface AmsStatusResponse {
    printer_id: string;
    ams_modules: AmsModule[];
    active_tray: string | null;
    has_external_spool: boolean;
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
    const { agentStatus, lastMessage, connect, disconnect, bridge } = useClientAgent();

    const [actionError, setActionError] = useState('');
    const [logs, setLogs] = useState<PrinterLogEntry[]>([]);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [discovery, setDiscovery] = useState<DiscoveryResponse | null>(null);
    const [statusData, setStatusData] = useState<StatusResponse | null>(null);
    const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(null);
    
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const [isLoginSubmitting, setIsLoginSubmitting] = useState(false);
    const [loginModalError, setLoginModalError] = useState('');
    const [loginStage, setLoginStage] = useState<'password' | 'verify_code'>('password');
    const [pendingVerifyAccount, setPendingVerifyAccount] = useState('');
    const [pendingVerifyAccountType, setPendingVerifyAccountType] = useState<BambuAccountType>('email');
    const [pendingVerifyRegion, setPendingVerifyRegion] = useState<BambuCloudRegion>('global');

    const selectedPrinterStatus = useMemo(() => {
        if (!selectedPrinterId || !statusData) return null;
        return statusData.statuses.find(s => s.id === selectedPrinterId) || null;
    }, [selectedPrinterId, statusData]);
    const studioStatus = statusData?.studio_status || discovery?.studio_status || null;

    useEffect(() => {
        if (!lastMessage) return;

        setLogs((current) => [createLogEntry(lastMessage), ...current].slice(0, 50));

        if (lastMessage.type === 'error') {
            setIsLoginSubmitting(false);
            if (['printer_login', 'printer_login_verify_code', 'printer_send_login_code'].includes(lastMessage.cmd || '')) {
                setLoginModalError(lastMessage.message || t('printer.actionFailed'));
            }
            setActionError(lastMessage.message || t('printer.actionFailed'));
            return;
        }

        setActionError('');

        if (lastMessage.type !== 'done') return;

        if (lastMessage.cmd === 'printer_discover') {
            const parsed = asDiscoveryResponse(lastMessage.data);
            if (parsed) setDiscovery(parsed);
        }

        if (lastMessage.cmd === 'printer_status') {
            const parsed = asStatusResponse(lastMessage.data);
            if (parsed) {
                setStatusData(parsed);
                setDiscovery(parsed);
            }
        }

        if (lastMessage.cmd === 'ams_status') {
            const data = lastMessage.data as AmsStatusResponse | null;
            if (data?.printer_id) {
                setStatusData((current) => {
                    if (!current) return current;
                    return {
                        ...current,
                        statuses: current.statuses.map((status) =>
                            status.id === data.printer_id
                                ? {
                                      ...status,
                                      ams_modules: data.ams_modules,
                                      active_tray: data.active_tray,
                                      has_external_spool: data.has_external_spool,
                                  }
                                : status,
                        ),
                    };
                });
            }
        }

        if (lastMessage.cmd === 'printer_login' || lastMessage.cmd === 'printer_login_verify_code') {
            const data = lastMessage.data as VerificationRequiredResponse | StatusResponse | null;
            if (data && 'requires_verification_code' in data) {
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
                setIsLoginSubmitting(false);
                setLoginModalError('');
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
    }, [lastMessage, t]);

    useEffect(() => {
        if (agentStatus !== 'connected') return;
        bridge.discoverPrinters();
        bridge.getPrinterStatus();
    }, [agentStatus, bridge]);

    useEffect(() => {
        if (!autoRefresh || agentStatus !== 'connected') return;
        const timer = window.setInterval(() => bridge.getPrinterStatus(), 10000);
        return () => window.clearInterval(timer);
    }, [agentStatus, autoRefresh, bridge]);

    const handleConnectToggle = () => {
        agentStatus === 'connected' ? disconnect() : connect();
    };

    const handleLoginSubmit = (account: string, pass: string, type: BambuAccountType, reg: BambuCloudRegion) => {
        if (bridge.loginBambuAccount(account, pass, type, reg)) {
            setPendingVerifyAccount(account);
            setPendingVerifyAccountType(type);
            setPendingVerifyRegion(reg);
            setIsLoginSubmitting(true);
        } else {
            setLoginModalError(t('printer.agentUnavailable'));
        }
    };

    const handleVerifyCodeSubmit = (account: string, code: string, type: BambuAccountType, reg: BambuCloudRegion) => {
        if (bridge.verifyBambuLoginCode(pendingVerifyAccount || account, code, pendingVerifyAccountType || type, pendingVerifyRegion || reg)) {
            setIsLoginSubmitting(true);
        } else {
            setLoginModalError(t('printer.agentUnavailable'));
        }
    };

    const handleSendCode = (account: string, type: BambuAccountType, reg: BambuCloudRegion) => {
        if (bridge.sendBambuLoginCode(pendingVerifyAccount || account, pendingVerifyAccountType || type, pendingVerifyRegion || reg)) {
            setIsLoginSubmitting(true);
            setLoginModalError(t('printer.verifyResendHint'));
        } else {
            setLoginModalError(t('printer.agentUnavailable'));
        }
    };

    return (
        <div className="custom-scrollbar h-full overflow-y-auto pr-1 text-slate-900 animate-in fade-in duration-700">
            <div className="space-y-6 pb-8">
                {/* Global Actions Bar */}
                <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between py-4">
                    <div>
                        <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                            <span>Infrastructure</span>
                            <span>/</span>
                            <span>Automation</span>
                            <span>/</span>
                            <span className="text-[var(--color-primary)]">{t('printer.title')}</span>
                        </div>
                        <h1 className="font-heading text-3xl font-black tracking-tighter text-slate-950">
                            Engineering Workbench
                        </h1>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {studioStatus && (
                            <span className={`inline-flex items-center gap-2 rounded px-3 py-2 text-[11px] font-bold uppercase tracking-wide shadow-sm ring-1 ${
                                studioStatus.installed
                                    ? studioStatus.running
                                        ? 'bg-sky-50 text-sky-700 ring-sky-200'
                                        : 'bg-amber-50 text-amber-700 ring-amber-200'
                                    : 'bg-slate-100 text-slate-600 ring-slate-200'
                            }`}>
                                <Cpu size={12} />
                                {studioStatus.installed
                                    ? studioStatus.running
                                        ? 'Bambu Studio Running'
                                        : 'Bambu Studio Installed'
                                    : 'Bambu Studio Missing'}
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={handleConnectToggle}
                            className={`inline-flex items-center gap-2 rounded px-4 py-2 text-xs font-bold uppercase tracking-wide transition-all ${
                                agentStatus === 'connected'
                                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 shadow-sm hover:bg-emerald-100'
                                    : 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-container)] shadow-md'
                            }`}
                        >
                            <Cpu size={14} />
                            {agentStatus === 'connected' ? t('printer.disconnectAgent') : t('printer.connectAgent')}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setLoginModalError('');
                                setLoginStage('password');
                                setIsLoginModalOpen(true);
                            }}
                            className="inline-flex items-center gap-2 rounded border border-[var(--shell-border)] bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 transition-all hover:bg-slate-50 shadow-sm"
                        >
                            <ShieldCheck size={14} />
                            {t('printer.loginButton')}
                        </button>
                        <button
                            type="button"
                            onClick={() => bridge.discoverPrinters()}
                            className="inline-flex items-center gap-2 rounded border border-[var(--shell-border)] bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 transition-all hover:bg-slate-50 shadow-sm"
                        >
                            <HardDriveDownload size={14} />
                            {t('printer.discover')}
                        </button>
                        <button
                            type="button"
                            onClick={() => bridge.getPrinterStatus()}
                            className="inline-flex items-center gap-2 rounded border border-[var(--shell-border)] bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 transition-all hover:bg-slate-50 shadow-sm"
                        >
                            <RefreshCw size={14} />
                            {t('printer.refreshStatus')}
                        </button>
                    </div>
                </section>

                {actionError && (
                    <div className="flex items-start gap-3 rounded bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-100 shadow-sm animate-in slide-in-from-top-2">
                        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                        <span className="font-medium">{actionError}</span>
                    </div>
                )}

                {/* View Switcher */}
                <main className="min-h-[600px]">
                    {selectedPrinterStatus ? (
                        <PrinterDetailView 
                            printer={selectedPrinterStatus} 
                            logs={[...logs].reverse()}
                            onBack={() => setSelectedPrinterId(null)}
                        />
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="font-heading text-lg font-bold text-slate-900">Active Fleet Overview</h2>
                                <label className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                                    <input
                                        type="checkbox"
                                        checked={autoRefresh}
                                        onChange={(e) => setAutoRefresh(e.target.checked)}
                                        className="h-3.5 w-3.5 rounded border-slate-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                                    />
                                    {t('printer.autoRefresh')}
                                </label>
                            </div>
                            <MultiPrinterDashboard 
                                printers={discovery?.machines || []} 
                                statuses={statusData?.statuses || []}
                                onSelectPrinter={setSelectedPrinterId}
                            />
                        </div>
                    )}
                </main>
            </div>

            <BambuLoginModal
                isOpen={isLoginModalOpen}
                isSubmitting={isLoginSubmitting}
                error={loginModalError}
                stage={loginStage}
                onClose={() => setIsLoginModalOpen(false)}
                onSubmitPassword={handleLoginSubmit}
                onSubmitCode={handleVerifyCodeSubmit}
                onSendCode={handleSendCode}
            />
        </div>
    );
};
