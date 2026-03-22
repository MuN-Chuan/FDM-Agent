import React, { useRef } from 'react';
import { Download, FileBox, Loader2, Upload, X, AlertTriangle, Settings, CheckCircle2 } from 'lucide-react';

import type { Modification, ThreeMFParseResult } from '../../api/api';
import type { SlicerJobPhase } from './useSlicerJob';
import { useSlicerJob } from './useSlicerJob';

interface SlicerJobModalProps {
    isOpen: boolean;
    onClose: () => void;
    modifications?: Modification[];
    existingParseResult?: ThreeMFParseResult;
    // Triggered when 3MF is parsed so the parent chat can append the preset context
    onParsed: (result: ThreeMFParseResult) => void;
}

const phaseLabels: Record<SlicerJobPhase, string> = {
    idle: '上传3MF提取预设',
    parsing: '解析预设中...',
    wait_for_ai: '等待AI优化...',
    modifying: '应用预设修改中...',
    done_repack: '内部修改完成！',
    done_cli: '等待Client Agent打包...',
    error: '处理失败',
};

const phaseDescriptions: Record<SlicerJobPhase, string> = {
    idle: '上传你的3MF项目文件，系统将自动解析其中的打印参数，以便AI深入优化。',
    parsing: '正在提取3MF中的预设参数摘要 (project_settings.config)...',
    wait_for_ai: '解析完成！预设信息已发送给AI，请在聊天中等待AI给出参数修改建议，随后将自动应用到3MF中。',
    modifying: '正在将AI的修改写入3MF...',
    done_repack: '已成功将修改后的预设打包进3MF中，可直接在Bambu Studio中打开查看。',
    done_cli: '客户端代理正在后台调用BambuStudio进行切片级打包...',
    error: '',
};

export const SlicerJobModal: React.FC<SlicerJobModalProps> = ({
    isOpen,
    onClose,
    modifications,
    existingParseResult,
    onParsed,
}) => {
    const { 
        phase, 
        parseResult, 
        error, 
        uploadAndParse, 
        setExistingJob,
        applyModifications, 
        downloadUrl, 
        reset 
    } = useSlicerJob();
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Apply modifications automatically if we are in wait_for_ai and modifications arrive
    React.useEffect(() => {
        if (phase === 'wait_for_ai' && modifications && modifications.length > 0) {
            void applyModifications(modifications);
        }
    }, [phase, modifications, applyModifications]);

    // Use existing job if provided
    React.useEffect(() => {
        if (isOpen && existingParseResult && phase === 'idle') {
            setExistingJob(existingParseResult);
        }
    }, [isOpen, existingParseResult, phase, setExistingJob]);

    if (!isOpen) return null;

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        event.target.value = '';
        const res = await uploadAndParse(file);
        if (res) {
            onParsed(res);
            // Auto close after 3 seconds so user can see AI generating mods in background
            setTimeout(() => {
                onClose();
            }, 3000);
        }
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
                                3MF 预设优化
                            </h3>
                            <p className="text-xs text-text-light/50 dark:text-text-dark/50">
                                Parsing & Repacking
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

                        {/* Step 1: Upload 3MF */}
                        {phase === 'idle' && (
                            <>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".3mf"
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
                            </>
                        )}

                        {/* Processing spinner UI for async wait */}
                        {(phase === 'parsing' || phase === 'modifying') && (
                            <div className="flex flex-col items-center gap-4">
                                <div className="relative">
                                    <div className="absolute inset-[-4px] animate-spin rounded-full border-2 border-cta/20 border-t-cta" />
                                    <Loader2 size={40} className="animate-spin text-cta" />
                                </div>
                            </div>
                        )}

                        {/* Step 2: Parsed successfully, showing summary and wait for AI */}
                        {phase === 'wait_for_ai' && parseResult && (
                            <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                                    <CheckCircle2 size={32} className="text-emerald-500" />
                                </div>
                                <div className="w-full text-left rounded-xl bg-secondary/5 p-4 mt-2">
                                    <div className="text-xs font-semibold text-text-light/70 dark:text-text-dark/70 mb-2 flex items-center gap-2">
                                        <Settings size={14} /> 预设信息摘要
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="text-text-light/60">打印机:</div>
                                        <div className="font-medium truncate">{parseResult.printer_model || parseResult.printer_settings_id}</div>
                                        <div className="text-text-light/60">预设配置:</div>
                                        <div className="font-medium truncate">{parseResult.print_settings_id}</div>
                                        <div className="text-text-light/60">层高:</div>
                                        <div className="font-medium truncate">{parseResult.summary['layer_height'] ?? 'N/A'} mm</div>
                                        <div className="text-text-light/60">模型数量:</div>
                                        <div className="font-medium truncate">{parseResult.objects.length} 个</div>
                                    </div>
                                </div>
                                <p className="text-xs text-cta/80 mt-2 animate-pulse font-medium">窗口将自动关闭，转交AI处理...</p>
                            </div>
                        )}

                        {/* Step 3: Done and Download */}
                        {phase === 'done_repack' && downloadUrl && (
                            <div className="flex flex-col items-center gap-4 animate-in slide-in-from-bottom flex duration-500">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cta/15">
                                    <Download size={28} className="text-cta" />
                                </div>
                                <a
                                    href={downloadUrl}
                                    className="inline-flex items-center gap-2 rounded-2xl bg-cta px-6 py-3 text-sm font-bold text-white shadow-lg shadow-cta/20 transition-all hover:-translate-y-0.5 hover:bg-[#1fb457]"
                                >
                                    <Download size={16} />
                                    下载修改后的 3MF
                                </a>
                                <button
                                    onClick={() => reset()}
                                    className="text-xs text-text-light/40 transition-colors hover:text-cta"
                                >
                                    处理新文件
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
