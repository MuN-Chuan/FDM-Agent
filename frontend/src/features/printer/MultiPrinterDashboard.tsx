import React from 'react';
import { Camera, Clock, MoreVertical, Play, Printer } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import type { DiscoveredPrinter, PrinterStatus } from './types';
import { formatPrinterStage, formatRemainingTime, isPrinterBusy, parseProgressPercent } from './statusDisplay';

interface MultiPrinterDashboardProps {
    printers: DiscoveredPrinter[];
    statuses: PrinterStatus[];
    onSelectPrinter: (id: string | null) => void;
}

export const MultiPrinterDashboard: React.FC<MultiPrinterDashboardProps> = ({
    printers,
    statuses,
    onSelectPrinter,
}) => {
    const { t } = useI18n();

    if (printers.length === 0) {
        return (
            <div className="flex h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--shell-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]">
                <Printer size={48} className="mb-4 opacity-20" />
                <p className="font-heading text-lg font-semibold">{t('printer.noDiscoveredPrinters')}</p>
                <p className="text-sm">{t('printer.discoveryHint')}</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {printers.map((machine) => {
                const status = statuses.find((s) => s.id === machine.id);
                return (
                    <PrinterCard
                        key={machine.id}
                        machine={machine}
                        status={status}
                        onSelect={() => onSelectPrinter(machine.id)}
                    />
                );
            })}
        </div>
    );
};

interface PrinterCardProps {
    machine: DiscoveredPrinter;
    status?: PrinterStatus;
    onSelect: () => void;
}

const PrinterCard: React.FC<PrinterCardProps> = ({ machine, status, onSelect }) => {
    const { t, locale } = useI18n();
    const isPrinting = status ? isPrinterBusy(status) : false;
    const progress = parseProgressPercent(status?.progress_percent);
    const stageLabel = status ? formatPrinterStage(status, t) : t('printer.stageUnknown');
    const remainingLabel = formatRemainingTime(status?.remaining_time, locale);

    return (
        <div 
            onClick={onSelect}
            className="group relative flex cursor-pointer flex-col overflow-hidden rounded bg-[var(--color-surface)] shadow-md ring-1 ring-[var(--shell-border)] transition-all hover:-translate-y-1 hover:shadow-lg"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isPrinting ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'}`}>
                        {isPrinting ? <Play size={20} className="fill-current" /> : <Printer size={20} />}
                    </div>
                    <div>
                        <h3 className="font-heading text-base font-bold text-slate-900 group-hover:text-[var(--color-primary)] transition-colors">
                            {machine.name || machine.id}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)]">
                                {machine.make || machine.model || 'Unknown Model'}
                            </span>
                            <span className={`h-1.5 w-1.5 rounded-full ${status?.online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        </div>
                    </div>
                </div>
                <button className="text-[var(--color-text-muted)] hover:text-slate-900">
                    <MoreVertical size={18} />
                </button>
            </div>

            {/* Content / Camera Preview Handle */}
            <div className="relative aspect-video w-full bg-slate-900 flex items-center justify-center overflow-hidden">
                {/* Simplified Camera Placeholder - In a real app this would be an image or RTSP canvas */}
                <div className="absolute inset-0 z-0 bg-gradient-to-br from-slate-800 to-slate-950 opacity-90" />
                <Camera size={32} className="relative z-10 text-white opacity-20" />
                
                {/* Status Overlay */}
                <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between text-white drop-shadow-md">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                            <span className={`h-1.5 w-1.5 rounded-full ${status?.online ? 'bg-emerald-400' : 'bg-rose-400 animate-pulse'}`} />
                            {status?.online ? t('printer.online') : t('printer.offline')}
                        </div>
                        {status?.online && (
                            <div className="flex gap-1">
                                {status.lan_online && (
                                    <span className="bg-sky-500/80 backdrop-blur-sm px-1.5 py-0.5 rounded-[2px] text-[8px] font-black uppercase">LAN</span>
                                )}
                                {status.cloud_online && (
                                    <span className="bg-emerald-500/80 backdrop-blur-sm px-1.5 py-0.5 rounded-[2px] text-[8px] font-black uppercase">Cloud</span>
                                )}
                                {status.local_mode_required && (
                                    <span className="bg-amber-500/80 backdrop-blur-sm px-1.5 py-0.5 rounded-[2px] text-[8px] font-black uppercase">Cloud Only</span>
                                )}
                            </div>
                        )}
                    </div>
                    {isPrinting && (
                        <div className="flex items-center gap-1.5 text-xs font-semibold bg-black/40 backdrop-blur-md px-2 py-1 rounded">
                            <Clock size={12} />
                            {remainingLabel}
                        </div>
                    )}
                </div>
            </div>

            {/* Progress / Info Footer */}
            <div className="px-5 py-4 bg-[var(--color-surface-muted)]/40">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                        {stageLabel}
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                        {status?.progress_percent || '0%'}
                    </span>
                </div>
                
                {/* Progress Bar */}
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-[var(--color-primary)] transition-all duration-500 rounded-full shadow-[0_0_8px_rgba(13,99,27,0.3)]"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {isPrinting && (
                    <div className="mt-3 flex items-center gap-3 text-[11px] text-[var(--color-text-muted)]">
                        <span className="truncate flex-1 font-medium">{status?.task_name}</span>
                    </div>
                )}
            </div>

            {/* Selection Highlight */}
            {machine.selected && (
                <div className="absolute inset-x-0 top-0 h-1 bg-[var(--color-primary)]" />
            )}
        </div>
    );
};
