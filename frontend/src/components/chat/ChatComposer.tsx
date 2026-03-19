import React from 'react';
import { AlertTriangle, FileText, Image as ImageIcon, Loader2, Package, Paperclip, Scan, Send, Sparkles, X } from 'lucide-react';

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
    onRemovePendingFile: (index: number) => void;
    onClearPreset: () => void;
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
    onRemovePendingFile,
    onClearPreset,
}) => (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-6 sm:px-6">
        <div className="mx-auto max-w-4xl">
            <div className="pointer-events-auto flex flex-col rounded-[32px] border border-secondary/20 bg-white shadow-xl transition-all focus-within:border-cta/40 focus-within:ring-4 focus-within:ring-cta/10 dark:bg-secondary/10">
                {(pendingImage || presetFileName || pendingFiles.length > 0) && (
                    <div className="flex flex-wrap gap-3 px-4 pt-4">
                        {pendingImage && (
                            <div className="overflow-hidden rounded-xl border border-secondary/20 shadow-sm">
                                <img src={pendingImage.previewUrl} alt="preview" className="h-16 w-16 object-cover" />
                            </div>
                        )}
                        {presetFileName && (
                            <div className="flex items-center gap-2 rounded-xl border border-cta/20 bg-cta/10 px-3 py-2 text-xs text-cta shadow-sm">
                                <Package size={16} />
                                <span className="max-w-[220px] truncate font-medium">{presetFileName}</span>
                                <button onClick={onOpenPresetModal} className="rounded p-1 hover:bg-cta/10" title="配置预设">
                                    <Sparkles size={14} />
                                </button>
                                <button onClick={onClearPreset} className="rounded p-1 hover:bg-cta/10" title="移除预设">
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                        {pendingFiles.map((file, index) => (
                            <div
                                key={`${file.name}-${index}`}
                                className="flex items-center gap-2 rounded-xl border border-secondary/20 bg-secondary/5 px-3 py-2 text-xs text-text-light shadow-sm dark:text-text-dark"
                            >
                                <FileText size={16} className="shrink-0 opacity-70" />
                                <div className="min-w-0">
                                    <p className="max-w-[220px] truncate font-medium">{file.name}</p>
                                    <p className="text-[10px] opacity-50">{Math.max(1, Math.round(file.size / 1024))} KB</p>
                                </div>
                                <button
                                    onClick={() => onRemovePendingFile(index)}
                                    className="rounded p-1 hover:bg-secondary/10"
                                    title="移除附件"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
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
                    placeholder="描述您的问题、上传预设、附件或图片..."
                    rows={1}
                    disabled={isStreaming}
                    className="min-h-[60px] max-h-[300px] w-full resize-none bg-transparent px-6 pb-2 pt-5 text-base leading-relaxed text-text-light outline-none placeholder:text-text-light/40 disabled:opacity-50 dark:text-text-dark dark:placeholder:text-text-dark/40"
                />

                <div className="flex flex-wrap items-center justify-between px-4 pb-3 pt-1">
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => imageInputRef.current?.click()}
                            disabled={isStreaming}
                            className="rounded-full p-2.5 text-text-light/60 transition-all hover:bg-cta/5 hover:text-cta disabled:opacity-40"
                            title="上传图片"
                        >
                            <ImageIcon size={20} />
                        </button>
                        <button
                            onClick={() => presetInputRef.current?.click()}
                            disabled={isStreaming || isParsingPreset}
                            className="rounded-full p-2.5 text-text-light/60 transition-all hover:bg-cta/5 hover:text-cta disabled:opacity-40"
                            title="上传参数预设包"
                        >
                            {isParsingPreset ? <Loader2 size={18} className="animate-spin text-cta" /> : <Package size={18} />}
                        </button>
                        <div className="mx-1 h-4 w-px bg-secondary/10" />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isStreaming}
                            className="rounded-full p-2.5 text-text-light/60 transition-all hover:bg-cta/5 hover:text-cta disabled:opacity-40"
                            title="上传附件文档"
                        >
                            <Paperclip size={18} />
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={onOpenDefectRecognition}
                            className="rounded-full p-2.5 text-text-light/60 transition-all hover:bg-cta/5 hover:text-cta"
                            title="打印缺陷识别"
                        >
                            <Scan size={18} />
                        </button>
                        <button
                            onClick={onOpenSettings}
                            className="flex items-center gap-2 rounded-full border border-cta/20 bg-cta/10 px-3 py-1.5 text-[12px] font-bold text-cta shadow-sm transition-all hover:bg-cta/15"
                        >
                            <Sparkles size={14} className="text-cta" />
                            <span>{modelName}</span>
                        </button>
                        {presetValidationError && (
                            <div className="group relative">
                                <AlertTriangle size={20} className="animate-pulse text-yellow-500" />
                                <span className="pointer-events-none absolute bottom-full right-0 z-50 mb-2 w-48 rounded border border-yellow-500/30 bg-background-dark px-3 py-2 text-[10px] text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                                    预设选择不完整或不匹配，请点击预设文件修正后再发送。
                                </span>
                            </div>
                        )}
                        <button
                            onClick={() => void onSubmit()}
                            disabled={isStreaming || (!input.trim() && !pendingImage && pendingFiles.length === 0) || !!presetValidationError}
                            className={`rounded-full p-2.5 shadow-md transition-all ${
                                isStreaming || (!input.trim() && !pendingImage && pendingFiles.length === 0) || !!presetValidationError
                                    ? 'cursor-not-allowed border border-secondary/10 bg-secondary/20 text-text-light/20'
                                    : 'bg-cta text-white shadow-lg shadow-cta/20 hover:scale-105 hover:bg-cta active:scale-95'
                            }`}
                        >
                            {isStreaming ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                        </button>
                    </div>
                </div>
            </div>
            <p className="mt-3 text-center text-[10px] text-text-light/30 dark:text-text-dark/30">
                AI 可能会产生误差，建议在正式打印前检查关键参数。
            </p>
        </div>
    </div>
);
