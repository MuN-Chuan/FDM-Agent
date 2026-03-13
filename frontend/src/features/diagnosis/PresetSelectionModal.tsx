import React from 'react';
import { X, Check } from 'lucide-react';
import { PresetSelector } from './PresetSelector';
import type { ParsedBundle, PresetSelection } from './usePresetParser';

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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background-dark/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-background-light dark:bg-background-dark border border-secondary/20 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-secondary/10 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-heading font-bold text-text-light dark:text-text-dark">配置预设选择</h2>
                        <p className="text-xs text-text-light/40 dark:text-text-dark/40">请确认或更新您的打印机配置以继续对话</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-secondary/10 rounded-lg text-text-light/40 hover:text-text-light transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
                    <PresetSelector 
                        bundle={bundle}
                        selection={selection}
                        onUpdateSelection={onUpdateSelection}
                    />
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-secondary/10 bg-secondary/5 flex items-center justify-between gap-4">
                    <div className="flex-1">
                        {validationError && (
                            <p className="text-xs text-amber-500 font-medium">⚠️ {validationError}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-semibold text-text-light/60 hover:text-text-light transition-colors"
                        >
                            取消
                        </button>
                        <button
                            onClick={onConfirm}
                            className="btn-cta px-6 py-2 rounded-xl flex items-center gap-2"
                        >
                            <Check size={18} />
                            确认配置
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
