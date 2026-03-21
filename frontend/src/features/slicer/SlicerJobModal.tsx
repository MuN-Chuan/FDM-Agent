import React, { useRef } from 'react';
import { Download, FileBox, Loader2, Upload, X, AlertTriangle } from 'lucide-react';

import type { Modification } from '../../api/api';
import type { SlicerJobPhase } from './useSlicerJob';
import { useSlicerJob } from './useSlicerJob';

interface SlicerJobModalProps {
    isOpen: boolean;
    onClose: () => void;
    modifications?: Modification[];
    presetData?: Record<string, unknown>;
}

const phaseLabels: Record<SlicerJobPhase, string> = {
    idle: '选择3MF文件',
    uploading: '上传中...',
    processing: '正在处理...',
    done: '处理完成！',
    error: '处理失败',
};

const phaseDescriptions: Record<SlicerJobPhase, string> = {
    idle: '上传一个3MF文件，引擎将应用AI参数修改并导出优化后的3MF文件',
    uploading: '正在上传文件到服务器...',
    processing: '引擎正在应用预设修改、自动摆放及导出...',
    done: '已成功生成带参数修改的3MF文件，可直接在拓竹切片软件中打开',
    error: '',
};

export const SlicerJobModal: React.FC<SlicerJobModalProps> = ({
    isOpen,
    onClose,
    modifications,
    presetData,
}) => {
    const { phase, error, submitJob, downloadUrl, reset } = useSlicerJob();
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        event.target.value = '';
        await submitJob(file, modifications, presetData);
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="relative mx-4 w-full max-w-lg overflow-hidden rounded-3xl border border-cta/20 bg-white shadow-2xl dark:bg-[#1a1a1a]">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-secondary/10 bg-cta/5 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cta/15">
                            <FileBox size={20} className="text-cta" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-text-light dark:text-text-dark">
                                生成3MF文件
                            </h3>
                            <p className="text-xs text-text-light/50 dark:text-text-dark/50">
                                Headless Slicer Engine
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="rounded-full p-2 text-text-light/40 transition-colors hover:bg-secondary/10 hover:text-text-light"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-8">
                    <div className="text-center">
                        <p className="mb-2 text-lg font-semibold text-text-light dark:text-text-dark">
                            {phaseLabels[phase]}
                        </p>
                        <p className="mb-6 text-sm text-text-light/60 dark:text-text-dark/50">
                            {phase === 'error' ? error : phaseDescriptions[phase]}
                        </p>

                        {/* Idle — file upload */}
                        {phase === 'idle' && (
                            <>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".3mf,.stl,.step,.stp,.obj"
                                    className="hidden"
                                    onChange={(e) => void handleFileSelect(e)}
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="mx-auto flex items-center gap-3 rounded-2xl border-2 border-dashed border-cta/30 bg-cta/5 px-8 py-6 text-cta transition-all hover:border-cta/50 hover:bg-cta/10"
                                >
                                    <Upload size={24} />
                                    <span className="text-sm font-bold">选择3MF文件</span>
                                </button>

                                {modifications && modifications.length > 0 && (
                                    <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-2 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                        将应用 {modifications.length} 项AI参数修改
                                    </div>
                                )}
                            </>
                        )}

                        {/* Processing spinner */}
                        {(phase === 'uploading' || phase === 'processing') && (
                            <div className="flex flex-col items-center gap-4">
                                <div className="relative">
                                    <div className="absolute inset-[-4px] animate-spin rounded-full border-2 border-cta/20 border-t-cta" />
                                    <Loader2 size={40} className="animate-spin text-cta" />
                                </div>
                            </div>
                        )}

                        {/* Done — download */}
                        {phase === 'done' && downloadUrl && (
                            <div className="flex flex-col items-center gap-4">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cta/15">
                                    <Download size={28} className="text-cta" />
                                </div>
                                <a
                                    href={downloadUrl}
                                    className="inline-flex items-center gap-2 rounded-2xl bg-cta px-6 py-3 text-sm font-bold text-white shadow-lg shadow-cta/20 transition-all hover:-translate-y-0.5 hover:bg-[#1fb457]"
                                >
                                    <Download size={16} />
                                    下载3MF文件
                                </a>
                                <button
                                    onClick={() => reset()}
                                    className="text-xs text-text-light/40 transition-colors hover:text-cta"
                                >
                                    重新处理
                                </button>
                            </div>
                        )}

                        {/* Error */}
                        {phase === 'error' && (
                            <div className="flex flex-col items-center gap-4">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/30">
                                    <AlertTriangle size={28} className="text-rose-500" />
                                </div>
                                <button
                                    onClick={() => reset()}
                                    className="inline-flex items-center gap-2 rounded-2xl bg-cta px-6 py-3 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5"
                                >
                                    重试
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
