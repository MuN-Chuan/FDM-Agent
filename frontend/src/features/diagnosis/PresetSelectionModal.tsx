import React from 'react';
import { Check, X } from 'lucide-react';

import type { ParsedBundle, PresetSelection } from './presetTypes';
import { PresetSelector } from './PresetSelector';

interface PresetSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    bundle: ParsedBundle | null;
    selection: PresetSelection;
    onUpdateSelection: (patch: Partial<PresetSelection>) => void;
    validationError: string | null;
}

export const PresetSelectionModal: React.FC<PresetSelectionModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    bundle,
    selection,
    onUpdateSelection,
    validationError,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background-dark/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-secondary/20 bg-background-light shadow-2xl animate-in zoom-in-95 duration-200 dark:bg-background-dark">
                <div className="flex items-center justify-between border-b border-secondary/10 px-6 py-4">
                    <div>
                        <h2 className="text-xl font-heading font-bold text-text-light dark:text-text-dark">配置预设选择</h2>
                        <p className="text-xs text-text-light/40 dark:text-text-dark/40">请确认或更新你的打印配置以继续对话</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 text-text-light/40 transition-colors hover:bg-secondary/10 hover:text-text-light"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="custom-scrollbar flex-1 overflow-y-auto px-6 py-4">
                    <PresetSelector bundle={bundle} selection={selection} onUpdateSelection={onUpdateSelection} />
                </div>

                <div className="flex items-center justify-between gap-4 border-t border-secondary/10 bg-secondary/5 px-6 py-4">
                    <div className="flex-1">
                        {validationError && <p className="text-xs font-medium text-amber-500">提示：{validationError}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-semibold text-text-light/60 transition-colors hover:text-text-light"
                        >
                            取消
                        </button>
                        <button onClick={onConfirm} className="btn-cta flex items-center gap-2 rounded-xl px-6 py-2">
                            <Check size={18} />
                            确认配置
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
