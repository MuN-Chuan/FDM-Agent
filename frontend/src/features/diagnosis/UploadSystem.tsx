import React, { useRef, useState } from 'react';
import { FileCode, ImageIcon, Loader2, Search, ShieldCheck, Zap } from 'lucide-react';

import { usePresetParser } from './usePresetParser';
import { LoadingSpinner, PresetErrorBanner, PresetSelector } from './PresetSelector';

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
        bundle,
        parseError,
        isParsing,
        selection,
        parsePresetFile,
        updateSelection,
        validateSelection,
    } = usePresetParser();

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] || null;
        setImageFile(file);
        onImageChange?.(file);
    };

    const handlePresetChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        setPresetFile(file);
        await parsePresetFile(file);
        onPresetChange?.(true);
    };

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

    const canDetect = !!imageFile && isModelReady && !isInferencing;
    const canDeep = !isInferencing && (!!imageFile || description.trim().length > 0);
    const presetValidationError = bundle ? validateSelection() : null;

    const triggerDiagnosis = (mode: DiagnosisMode) => onStartDiagnosis(mode, buildPayload());

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div
                    onClick={() => imageInputRef.current?.click()}
                    className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all group ${
                        imageFile
                            ? 'border-cta/40 bg-cta/5'
                            : 'border-secondary/10 hover:border-cta/30 hover:bg-cta/5'
                    }`}
                >
                    <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageChange}
                    />
                    {imageFile ? (
                        <div className="flex flex-col items-center gap-2">
                            <img
                                src={URL.createObjectURL(imageFile)}
                                alt="Preview"
                                className="h-20 rounded object-contain"
                            />
                            <p className="max-w-full truncate px-2 text-xs font-bold text-cta">
                                {imageFile.name}
                            </p>
                            <p className="text-[10px] text-text-light/40">点击更换</p>
                        </div>
                    ) : (
                        <>
                            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-secondary/5 transition-transform group-hover:scale-110">
                                <ImageIcon size={18} className="text-text-light/40 group-hover:text-cta" />
                            </div>
                            <p className="mb-0.5 text-sm font-bold">缺陷图片</p>
                            <p className="text-xs text-text-light/40">点击或拖拽上传</p>
                        </>
                    )}
                </div>

                <div
                    onClick={() => presetInputRef.current?.click()}
                    className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all group ${
                        presetFile
                            ? 'border-cta/40 bg-cta/5'
                            : 'border-secondary/10 hover:border-cta/30 hover:bg-cta/5'
                    }`}
                >
                    <input
                        ref={presetInputRef}
                        type="file"
                        accept=".bbscfg,.orca_printer"
                        className="hidden"
                        onChange={handlePresetChange}
                    />
                    {isParsing ? (
                        <div className="flex flex-col items-center gap-3 py-2">
                            <Loader2 size={24} className="animate-spin text-cta" />
                            <p className="text-sm text-text-light/50">正在解析预设...</p>
                        </div>
                    ) : bundle ? (
                        <div className="flex flex-col items-center gap-2">
                            <FileCode size={28} className="text-cta" />
                            <p className="max-w-full truncate px-2 text-xs font-bold text-cta">
                                {presetFile?.name}
                            </p>
                            <p className="text-[10px] text-text-light/40">
                                {bundle.printers.length} 机器 / {bundle.filaments.length} 材料 / {bundle.processes.length} 工艺
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-secondary/5 transition-transform group-hover:scale-110">
                                <FileCode size={18} className="text-text-light/40 group-hover:text-cta" />
                            </div>
                            <p className="mb-0.5 text-sm font-bold">打印预设包</p>
                            <p className="text-xs text-text-light/40">可选，仅在需要参数优化时使用</p>
                        </>
                    )}
                </div>
            </div>

            {parseError && <PresetErrorBanner message={parseError.message} />}

            {bundle && (
                <PresetSelector
                    bundle={bundle}
                    selection={selection}
                    onUpdateSelection={updateSelection}
                />
            )}

            {presetValidationError && bundle && <PresetErrorBanner message={presetValidationError} />}

            <div className="space-y-4">
                <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-text-light/40">
                        问题补充说明
                    </label>
                    <textarea
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        className="min-h-[90px] w-full rounded-lg border border-secondary/10 bg-secondary/5 p-4 text-sm transition-all focus:border-cta/40 focus:outline-none focus:ring-2 focus:ring-cta/20 font-body"
                        placeholder="描述你在打印过程中遇到的现象、出现阶段和期望结果..."
                    />
                </div>

                <div>
                    <label className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-light/40">
                        <ShieldCheck size={13} className="text-cta" />
                        安全约束
                    </label>
                    <textarea
                        value={safetyConstraints}
                        onChange={(event) => setSafetyConstraints(event.target.value)}
                        className="min-h-[80px] w-full rounded-lg border border-secondary/10 bg-secondary/5 p-4 text-sm transition-all focus:border-cta/40 focus:outline-none focus:ring-2 focus:ring-cta/20 font-body"
                        placeholder="例如：不要修改喷嘴温度、保持现有支撑策略、不超过某个速度范围。"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
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
                            ? '等待本地识别模型加载完成'
                            : !imageFile
                              ? '请先上传缺陷图片'
                              : undefined
                    }
                    onClick={() => triggerDiagnosis('detect')}
                />

                <ActionButton
                    icon={<Zap size={16} />}
                    label="深度缺陷分析"
                    sublabel="图片或说明即可"
                    enabled={canDeep}
                    variant="primary"
                    tooltip={!imageFile && !description.trim() ? '请至少提供缺陷图片或问题说明' : undefined}
                    onClick={() => triggerDiagnosis('deep')}
                />
            </div>
        </div>
    );
};

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
    icon,
    label,
    sublabel,
    enabled,
    variant,
    onClick,
    tooltip,
    loading,
    loadingLabel,
}: ActionButtonProps) {
    const base =
        'group relative flex w-full flex-col items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-sm font-bold transition-all';
    const primary =
        'bg-cta text-white shadow-lg shadow-cta/20 hover:scale-[1.02] hover:bg-cta/90 hover:shadow-cta/30';
    const secondary =
        'border border-secondary/10 bg-secondary/10 hover:border-cta/30 hover:bg-cta/5 hover:text-cta';
    const disabled = 'pointer-events-none cursor-not-allowed opacity-40';

    return (
        <div className="relative">
            <button
                className={`${base} ${variant === 'primary' ? primary : secondary} ${!enabled ? disabled : ''}`}
                onClick={enabled ? onClick : undefined}
            >
                {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
                <span>{loadingLabel ?? label}</span>
                <span
                    className={`text-[10px] font-normal ${
                        variant === 'primary' ? 'text-white/70' : 'text-text-light/40'
                    }`}
                >
                    {sublabel}
                </span>
            </button>
            {tooltip && !enabled && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 group-hover:block">
                    <div className="max-w-[220px] rounded-lg border border-secondary/20 bg-primary px-3 py-2 text-center text-xs text-text-light shadow-lg">
                        {tooltip}
                    </div>
                </div>
            )}
        </div>
    );
}

void LoadingSpinner;
