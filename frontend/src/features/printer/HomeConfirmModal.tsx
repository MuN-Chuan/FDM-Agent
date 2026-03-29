import React from 'react';
import { AlertTriangle, Home, X } from 'lucide-react';

import { useI18n } from '../../i18n/I18nProvider';

interface HomeConfirmModalProps {
    isOpen: boolean;
    printerName: string;
    stageLabel: string;
    isBusy: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export const HomeConfirmModal: React.FC<HomeConfirmModalProps> = ({
    isOpen,
    printerName,
    stageLabel,
    isBusy,
    onClose,
    onConfirm,
}) => {
    const { t } = useI18n();

    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg overflow-hidden rounded-[28px] border border-white/10 bg-white shadow-2xl">
                <div className="flex items-start justify-between px-6 pb-4 pt-6">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-[var(--color-primary)]">
                            <Home size={15} />
                            {t('printer.homeDialogEyebrow')}
                        </div>
                        <h2 className="mt-3 text-2xl font-heading font-bold text-text-light">
                            {t('printer.homeDialogTitle')}
                        </h2>
                        <p className="mt-2 text-sm text-text-light/60">
                            {t('printer.homeDialogSubtitle')}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-full p-2 text-text-light/40 transition-colors hover:bg-secondary/10 hover:text-text-light"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-4 px-6 pb-6">
                    <div className="rounded-2xl border border-secondary/15 bg-secondary/5 px-4 py-4">
                        <div className="flex items-center justify-between gap-4 text-sm">
                            <div>
                                <div className="text-xs font-bold uppercase tracking-[0.16em] text-text-light/45">
                                    {t('printer.homeDialogMachine')}
                                </div>
                                <div className="mt-1 font-semibold text-text-light">{printerName}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs font-bold uppercase tracking-[0.16em] text-text-light/45">
                                    {t('printer.currentStage')}
                                </div>
                                <div className="mt-1 font-semibold text-text-light">{stageLabel}</div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                        <div className="flex items-start gap-3">
                            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
                            <div className="space-y-2">
                                <p>{t('printer.homeDialogWarning')}</p>
                                {isBusy ? (
                                    <p className="font-semibold">{t('printer.homeDialogBusyWarning')}</p>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-2xl border border-secondary/15 bg-white px-4 py-2 text-sm font-bold text-text-light transition hover:bg-secondary/5"
                        >
                            {t('printer.cancelButton')}
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            className="inline-flex items-center gap-2 rounded-2xl bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--color-primary-container)]"
                        >
                            <Home size={16} />
                            {t('printer.confirmHomeAction')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
