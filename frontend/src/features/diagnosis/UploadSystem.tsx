import React, { useRef, useState } from 'react';
import {
    ImageIcon, FileCode, ShieldCheck, Loader2,
    Search, MessageCircle, Zap
} from 'lucide-react';
import { usePresetParser } from './usePresetParser';
import { PresetSelector, LoadingSpinner, PresetErrorBanner } from './PresetSelector';

export type DiagnosisMode = 'detect' | 'chat' | 'deep';

interface UploadSystemProps {
    onStartDiagnosis: (mode: DiagnosisMode, payload: DiagnosisPayload) => void;
    onImageChange?: (file: File | null) => void;
    onPresetChange?: (hasPreset: boolean) => void;
    onParsingChange?: (isParsing: boolean) => void;
    isInferencing: boolean;
    isModelReady: boolean;
}

export interface DiagnosisPayload {
    imageFile?: File;
    description?: string;
    safetyConstraints?: string;
    presetBundle?: ReturnType<typeof usePresetParser>['bundle'];
    presetSelection?: ReturnType<typeof usePresetParser>['selection'];
}

export const UploadSystem: React.FC<UploadSystemProps> = ({
    onStartDiagnosis,
    onImageChange,
    onPresetChange,
    onParsingChange,
    isInferencing,
    isModelReady,
}) => {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [presetFile, setPresetFile] = useState<File | null>(null);
    const [description, setDescription] = useState('');
    const [safetyConstraints, setSafetyConstraints] = useState('');

    const imageInputRef = useRef<HTMLInputElement>(null);
    const presetInputRef = useRef<HTMLInputElement>(null);

    const {
        bundle, parseError, isParsing, selection,
        parsePresetFile, updateSelection, validateSelection,
    } = usePresetParser();

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        setImageFile(file);
        onImageChange?.(file);
    };

    const handlePresetChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPresetFile(file);
        await parsePresetFile(file);
        onPresetChange?.(true);
    };

    // Watch parsing state
    React.useEffect(() => {
        onParsingChange?.(isParsing);
    }, [isParsing, onParsingChange]);

    const buildPayload = (): DiagnosisPayload => ({
        imageFile: imageFile ?? undefined,
        description: description.trim() || undefined,
        safetyConstraints: safetyConstraints.trim() || undefined,
        presetBundle: bundle ?? undefined,
        presetSelection: selection,
    });

    // Validation per mode
    const canDetect = !!imageFile && isModelReady && !isInferencing;
    const canChat = description.trim().length > 0;
    const canDeep = !!presetFile && !!bundle && !parseError && !!validateSelection() === false
        && (!!imageFile || description.trim().length > 0);
    const presetValidationError = bundle ? validateSelection() : null;

    const triggerDiagnosis = (mode: DiagnosisMode) => onStartDiagnosis(mode, buildPayload());

    return (
        <div className="space-y-6">
            {/* === UPLOAD ROW === */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Image Upload */}
                <div
                    onClick={() => imageInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 transition-all text-center cursor-pointer group ${imageFile
                        ? 'border-cta/40 bg-cta/5'
                        : 'border-secondary/10 hover:border-cta/30 hover:bg-cta/5'
                        }`}
                >
                    <input
                        type="file" accept="image/*"
                        className="hidden" ref={imageInputRef}
                        onChange={handleImageChange}
                    />
                    {imageFile ? (
                        <div className="flex flex-col items-center gap-2">
                            <img
                                src={URL.createObjectURL(imageFile)}
                                alt="Preview"
                                className="h-20 object-contain rounded"
                            />
                            <p className="text-xs font-bold text-cta truncate max-w-full px-2">{imageFile.name}</p>
                            <p className="text-[10px] text-text-light/40">点击更换</p>
                        </div>
                    ) : (
                        <>
                            <div className="w-10 h-10 bg-secondary/5 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                                <ImageIcon size={18} className="text-text-light/40 group-hover:text-cta" />
                            </div>
                            <p className="text-sm font-bold mb-0.5">缺陷图片</p>
                            <p className="text-xs text-text-light/40">点击或拖拽上传</p>
                        </>
                    )}
                </div>

                {/* Preset File Upload */}
                <div
                    onClick={() => presetInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 transition-all text-center cursor-pointer group ${presetFile
                        ? 'border-cta/40 bg-cta/5'
                        : 'border-secondary/10 hover:border-cta/30 hover:bg-cta/5'
                        }`}
                >
                    <input
                        type="file"
                        accept=".bbscfg,.orca_printer"
                        className="hidden" ref={presetInputRef}
                        onChange={handlePresetChange}
                    />
                    {isParsing ? (
                        <div className="flex flex-col items-center gap-3 py-2">
                            <Loader2 size={24} className="animate-spin text-cta" />
                            <p className="text-sm text-text-light/50">解析中...</p>
                        </div>
                    ) : bundle ? (
                        <div className="flex flex-col items-center gap-2">
                            <FileCode size={28} className="text-cta" />
                            <p className="text-xs font-bold text-cta truncate max-w-full px-2">{presetFile?.name}</p>
                            <p className="text-[10px] text-text-light/40">
                                {bundle.printers.length}机 · {bundle.filaments.length}材 · {bundle.processes.length}工艺 · 点击更换
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="w-10 h-10 bg-secondary/5 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                                <FileCode size={18} className="text-text-light/40 group-hover:text-cta" />
                            </div>
                            <p className="text-sm font-bold mb-0.5">打印机预设包</p>
                            <p className="text-xs text-text-light/40">.bbscfg 或 .orca_printer</p>
                        </>
                    )}
                </div>
            </div>

            {/* Parse error */}
            {parseError && <PresetErrorBanner message={parseError.message} />}

            {/* Preset selector */}
            {bundle && (
                <PresetSelector
                    bundle={bundle}
                    selection={selection}
                    onUpdateSelection={updateSelection}
                />
            )}

            {/* Preset validation warning */}
            {presetValidationError && bundle && (
                <PresetErrorBanner message={presetValidationError} />
            )}

            {/* === TEXT INPUTS === */}
            <div className="space-y-4">
                <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-text-light/40 block mb-2">问题补充说明</label>
                    <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        className="w-full bg-secondary/5 border border-secondary/10 rounded-lg p-4 text-sm min-h-[90px] focus:outline-none focus:ring-2 focus:ring-cta/20 focus:border-cta/40 transition-all font-body"
                        placeholder="描述您在打印过程中遇到的具体情况..."
                    />
                </div>

                <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-text-light/40 block mb-2 flex items-center gap-2">
                        <ShieldCheck size={13} className="text-cta" />
                        参数安全限制 (AI 调参边界)
                    </label>
                    <textarea
                        value={safetyConstraints}
                        onChange={e => setSafetyConstraints(e.target.value)}
                        className="w-full bg-secondary/5 border border-secondary/10 rounded-lg p-4 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-cta/20 focus:border-cta/40 transition-all font-body"
                        placeholder="输入对 AI 调参的硬性要求（例如：不要修改打印温度、保持原有支撑设置...）"
                    />
                </div>
            </div>

            {/* === THREE ACTION BUTTONS === */}
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 仅识别缺陷 */}
                <ActionButton
                    icon={<Search size={16} />}
                    label={isInferencing ? '识别中...' : '仅识别缺陷'}
                    sublabel="需要图片"
                    enabled={canDetect}
                    variant="secondary"
                    loading={isInferencing}
                    loadingLabel={!isModelReady ? '模型加载中...' : undefined}
                    tooltip={
                        !isModelReady
                            ? '等待 AI 模型初始化...'
                            : !imageFile
                                ? '请先上传缺陷图片'
                                : undefined
                    }
                    onClick={() => triggerDiagnosis('detect')}
                />

                {/* 仅AI聊天 */}
                <ActionButton
                    icon={<MessageCircle size={16} />}
                    label="仅AI聊天"
                    sublabel="需要问题说明"
                    enabled={canChat}
                    variant="secondary"
                    tooltip={!canChat ? '请先输入问题补充说明' : undefined}
                    onClick={() => triggerDiagnosis('chat')}
                />

                {/* 深度AI诊断 */}
                <ActionButton
                    icon={<Zap size={16} />}
                    label="深度AI诊断"
                    sublabel="需要预设 + (图/说明)"
                    enabled={canDeep}
                    variant="primary"
                    tooltip={
                        !presetFile
                            ? '请先上传预设包'
                            : parseError
                                ? '预设包解析失败'
                                : presetValidationError
                                    ? presetValidationError
                                    : (!imageFile && !description.trim())
                                        ? '请提供缺陷图片或问题说明（至少一项）'
                                        : undefined
                    }
                    onClick={() => triggerDiagnosis('deep')}
                />
            </div>
        </div>
    );
};

/* ─────────────────────────── Sub-components ─────────────────────────── */

interface ActionButtonProps {
    icon: React.ReactNode;
    label: string;
    sublabel: string;
    enabled: boolean;
    variant: 'primary' | 'secondary';
    onClick: () => void;
    tooltip?: string;
    loading?: boolean;
    loadingLabel?: string;
}

function ActionButton({
    icon, label, sublabel, enabled, variant, onClick, tooltip, loading, loadingLabel,
}: ActionButtonProps) {
    const base =
        'flex flex-col items-center justify-center gap-1.5 px-4 py-3 rounded-xl font-bold text-sm w-full transition-all relative group';
    const primary =
        'bg-cta text-white shadow-lg shadow-cta/20 hover:bg-cta/90 hover:shadow-cta/30 hover:scale-[1.02]';
    const secondary =
        'bg-secondary/10 border border-secondary/10 hover:border-cta/30 hover:bg-cta/5 hover:text-cta';
    const disabled = 'opacity-40 cursor-not-allowed pointer-events-none';

    return (
        <div className="relative">
            <button
                className={`${base} ${variant === 'primary' ? primary : secondary} ${!enabled ? disabled : ''}`}
                onClick={enabled ? onClick : undefined}
            >
                {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
                <span>{loadingLabel ?? label}</span>
                <span className={`text-[10px] font-normal ${variant === 'primary' ? 'text-white/70' : 'text-text-light/40'}`}>
                    {sublabel}
                </span>
            </button>
            {/* Tooltip on disabled hover */}
            {tooltip && !enabled && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 hidden group-hover:block pointer-events-none">
                    <div className="bg-primary border border-secondary/20 text-text-light text-xs px-3 py-2 rounded-lg whitespace-nowrap shadow-lg max-w-[200px] text-center">
                        {tooltip}
                    </div>
                </div>
            )}
        </div>
    );
}

void LoadingSpinner;
