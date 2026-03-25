import React from 'react';
import {
    AlertTriangle,
    Camera,
    FileBox,
    FileText,
    ImageIcon,
    Loader2,
    Package,
    Paperclip,
    Scan,
    Send,
    Settings2,
    X,
} from 'lucide-react';

import { useI18n } from '../../i18n/I18nProvider';
import type { ThreeMFParseResult } from '../../api/api';

interface PendingImage {
    base64: string;
    previewUrl: string;
}

interface PendingFile {
    name: string;
    size: number;
    content: string;
}

interface ChatComposerProps {
    input: string;
    isStreaming: boolean;
    isParsingPreset: boolean;
    pendingImage: PendingImage | null;
    pendingFiles: PendingFile[];
    presetFileName: string | null;
    presetValidationError: string | null;
    modelName: string;
    imageInputRef: React.RefObject<HTMLInputElement | null>;
    presetInputRef: React.RefObject<HTMLInputElement | null>;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    textareaRef: React.RefObject<HTMLTextAreaElement | null>;
    onInputChange: (value: string) => void;
    onSubmit: () => void | Promise<void>;
    onOpenSettings: () => void;
    onOpenPresetModal: () => void;
    onOpenDefectRecognition: () => void;
    onOpenSlicerModal: () => void;
    onRemovePendingFile: (index: number) => void;
    onClearPreset: () => void;
    pendingSlicerResult: ThreeMFParseResult | null;
    onClearSlicerResult: () => void;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
    input,
    isStreaming,
    isParsingPreset,
    pendingImage,
    pendingFiles,
    presetFileName,
    presetValidationError,
    modelName,
    imageInputRef,
    presetInputRef,
    fileInputRef,
    textareaRef,
    onInputChange,
    onSubmit,
    onOpenSettings,
    onOpenPresetModal,
    onOpenDefectRecognition,
    onOpenSlicerModal,
    onRemovePendingFile,
    onClearPreset,
    pendingSlicerResult,
    onClearSlicerResult,
}) => {
    const { t } = useI18n();
    const canSubmit = !!input.trim() || !!pendingImage || pendingFiles.length > 0 || !!pendingSlicerResult;

    return (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-4 pb-5 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl">
                <div className="pointer-events-auto rounded-3xl overflow-hidden border border-slate-300 bg-[var(--color-background-light)] shadow-[0_12px_32px_rgba(25,28,29,0.06)]">
                    {(pendingImage || presetFileName || pendingFiles.length > 0 || pendingSlicerResult) && (
                        <div className="flex flex-wrap gap-3 bg-[#e7e8e9] px-5 py-3">
                            {pendingImage && (
                                <AttachmentChip
                                    icon={<ImageIcon size={18} className="text-slate-600" />}
                                    label={t('chat.imageAttachment')}
                                    preview={pendingImage.previewUrl}
                                    onRemove={() => imageInputRef.current && imageInputRef.current.value === ''}
                                    hideRemove
                                />
                            )}

                            {presetFileName && (
                                <AttachmentChip
                                    icon={<Package size={18} className="text-[var(--color-primary)]" />}
                                    label={presetFileName}
                                    onPrimaryAction={onOpenPresetModal}
                                    onRemove={onClearPreset}
                                    accent
                                />
                            )}

                            {pendingFiles.map((file, index) => (
                                <AttachmentChip
                                    key={`${file.name}-${index}`}
                                    icon={<FileText size={18} className="text-slate-600" />}
                                    label={file.name}
                                    onRemove={() => onRemovePendingFile(index)}
                                />
                            ))}

                            {pendingSlicerResult && (
                                <AttachmentChip
                                    icon={<FileBox size={18} className="text-[var(--color-primary)]" />}
                                    label={`3MF ${pendingSlicerResult.printer_model || 'Project'}`}
                                    onPrimaryAction={onOpenSlicerModal}
                                    onRemove={onClearSlicerResult}
                                    accent
                                />
                            )}
                        </div>
                    )}

                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(event) => onInputChange(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                                event.preventDefault();
                                void onSubmit();
                            }
                        }}
                        placeholder={t('chat.inputPlaceholder')}
                        rows={1}
                        disabled={isStreaming}
                        className="min-h-[80px] max-h-[320px] w-full resize-none border-0 bg-[var(--color-background-light)] px-5 py-3.5 text-sm leading-7 text-slate-800 outline-none placeholder:text-sm placeholder:text-slate-500 disabled:opacity-50"
                    />

                    <div className="flex flex-col gap-3 border-t border-slate-300 bg-[#edf2f7] px-5 py-2.5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-1 text-slate-500">
                                <IconButton
                                    title={t('chat.uploadImage')}
                                    disabled={isStreaming}
                                    onClick={() => imageInputRef.current?.click()}
                                    icon={<Camera size={19} />}
                                />
                                <IconButton
                                    title={t('chat.uploadPreset')}
                                    disabled={isStreaming || isParsingPreset}
                                    onClick={() => presetInputRef.current?.click()}
                                    icon={
                                        isParsingPreset ? <Loader2 size={19} className="animate-spin" /> : <FileText size={19} />
                                    }
                                />
                                <IconButton
                                    title={t('chat.uploadAttachment')}
                                    disabled={isStreaming}
                                    onClick={() => fileInputRef.current?.click()}
                                    icon={<Paperclip size={19} />}
                                />
                            </div>

                            <div className="hidden h-8 w-px bg-[rgba(112,122,108,0.25)] sm:block" />

                            <button
                                type="button"
                                onClick={onOpenDefectRecognition}
                                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-[var(--color-tertiary)] transition-colors hover:bg-white/70"
                            >
                                <Scan size={17} />
                                <span>{t('chat.defectRecognition')}</span>
                            </button>

                            <button
                                type="button"
                                onClick={onOpenSlicerModal}
                                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-white/70"
                            >
                                <FileBox size={17} />
                                <span>{t('chat.uploadSlicer')}</span>
                            </button>

                        </div>

                        <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                            <button
                                type="button"
                                onClick={onOpenSettings}
                                className="inline-flex items-center gap-2 bg-[var(--color-surface)] px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-[#fbfbfa]"
                            >
                                <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{t('chat.modelLabel')}</span>
                                <span className="font-semibold">{modelName}</span>
                                <Settings2 size={15} className="text-slate-500" />
                            </button>

                            {presetValidationError && (
                                <div className="inline-flex items-center gap-2 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                                    <AlertTriangle size={15} />
                                    <span>{t('chat.presetValidation')}</span>
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={() => void onSubmit()}
                                disabled={isStreaming || !canSubmit || !!presetValidationError}
                                className={`inline-flex min-w-[180px] items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold transition-all ${
                                    isStreaming || !canSubmit || !!presetValidationError
                                        ? 'cursor-not-allowed bg-slate-300 text-slate-100'
                                        : 'bg-[var(--color-primary)] text-white shadow-[0_8px_20px_rgba(13,99,27,0.18)] hover:bg-[var(--color-primary-container)] rounded-xl'
                                }`}
                            >
                                {isStreaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                <span>{t('chat.sendAnalysis')}</span>
                            </button>
                        </div>
                    </div>
                </div>

                <p className="mt-3 text-center text-[10px] text-slate-400">{t('chat.warning')}</p>
            </div>
        </div>
    );
};

const IconButton: React.FC<{
    title: string;
    disabled?: boolean;
    onClick: () => void;
    icon: React.ReactNode;
}> = ({ title, disabled, onClick, icon }) => (
    <button
        type="button"
        title={title}
        disabled={disabled}
        onClick={onClick}
        className="rounded border border-transparent p-2.5 transition-colors hover:bg-white hover:text-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-40"
    >
        {icon}
    </button>
);

const AttachmentChip: React.FC<{
    icon: React.ReactNode;
    label: string;
    preview?: string;
    accent?: boolean;
    hideRemove?: boolean;
    onPrimaryAction?: () => void;
    onRemove?: () => void;
}> = ({ icon, label, preview, accent = false, hideRemove = false, onPrimaryAction, onRemove }) => {
    const { t } = useI18n();

    return (
        <div
            className={`flex min-w-[220px] items-center gap-3 px-3 py-1.5 ${
                accent
                    ? 'bg-[rgba(13,99,27,0.08)]'
                    : 'bg-[#e7e8e9]'
            }`}
        >
            {preview ? (
                <img src={preview} alt={label} className="h-11 w-11 object-cover" />
            ) : (
                <div className="flex h-11 w-11 items-center justify-center bg-[var(--color-surface)]">
                    {icon}
                </div>
            )}

            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-700">{label}</p>
            </div>

            {onPrimaryAction ? (
                <button
                    type="button"
                    onClick={onPrimaryAction}
                    className="px-2 py-1 text-xs font-semibold text-[var(--color-primary)] transition-colors hover:bg-white"
                >
                    {t('chat.view')}
                </button>
            ) : null}

            {!hideRemove && onRemove ? (
                <button
                    type="button"
                    onClick={onRemove}
                    className="p-1 text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
                >
                    <X size={15} />
                </button>
            ) : null}
        </div>
    );
};
