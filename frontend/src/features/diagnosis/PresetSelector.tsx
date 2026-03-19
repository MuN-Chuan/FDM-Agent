import React from 'react';
import { AlertCircle, CircleCheck, Loader2, Star } from 'lucide-react';

import type { ParsedBundle, PresetSelection, RawPreset } from './presetTypes';

interface PresetSelectorProps {
    bundle: ParsedBundle | null;
    selection: PresetSelection;
    onUpdateSelection: (patch: Partial<PresetSelection>) => void;
}

function PresetCard({
    preset,
    selected,
    onClick,
}: {
    preset: RawPreset;
    selected: boolean;
    onClick: () => void;
}) {
    const displayName = preset.name.replace(/@.*/, '').trim();
    const suffix = preset.name.match(/@(.+)/)?.[1] ?? '';

    return (
        <button
            onClick={onClick}
            className={`relative w-full rounded-xl border px-4 py-3 text-left transition-all ${
                selected
                    ? 'border-cta bg-cta/10 shadow-sm'
                    : 'border-secondary/10 bg-secondary/5 hover:border-cta/30 hover:bg-cta/5'
            }`}
        >
            <div className="flex items-center gap-3">
                <div
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                        selected ? 'border-cta bg-cta' : 'border-secondary/20'
                    }`}
                >
                    {selected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                </div>
                <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{displayName}</p>
                    {suffix && <p className="truncate text-[10px] text-text-light/40">{suffix}</p>}
                </div>
            </div>
        </button>
    );
}

function MaterialCard({
    preset,
    selected,
    onToggle,
    isDefect,
    onToggleDefect,
    showDefectPicker,
}: {
    preset: RawPreset;
    selected: boolean;
    onToggle: () => void;
    isDefect: boolean;
    onToggleDefect: () => void;
    showDefectPicker: boolean;
}) {
    const displayName = preset.name.replace(/@.*/, '').trim();
    const suffix = preset.name.match(/@(.+)/)?.[1] ?? '';

    return (
        <div className={`rounded-xl border transition-all ${selected ? 'border-cta bg-cta/10' : 'border-secondary/10 bg-secondary/5'}`}>
            <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <div
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-all ${
                        selected ? 'border-cta bg-cta' : 'border-secondary/20'
                    }`}
                >
                    {selected && <div className="h-2 w-2 bg-white" />}
                </div>
                <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{displayName}</p>
                    {suffix && <p className="truncate text-[10px] text-text-light/40">{suffix}</p>}
                </div>
            </button>
            {selected && showDefectPicker && (
                <div className="flex items-center gap-2 px-4 pb-3">
                    <button
                        onClick={onToggleDefect}
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
                            isDefect
                                ? 'border-amber-500 bg-amber-500/20 text-amber-400'
                                : 'border-secondary/10 text-text-light/40 hover:border-amber-500/50 hover:text-amber-500'
                        }`}
                    >
                        <Star size={10} className={isDefect ? 'fill-amber-400' : ''} />
                        {isDefect ? '已标记为缺陷源' : '标记为缺陷源'}
                    </button>
                    {isDefect && (
                        <span className="text-[10px] text-amber-400/70">AI 将优先围绕此材料参数进行深度诊断</span>
                    )}
                </div>
            )}
        </div>
    );
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({ bundle, selection, onUpdateSelection }) => {
    if (!bundle) return null;

    const formatLabel = bundle.format === 'bambu' ? 'BambuLab (.bbscfg)' : 'OrcaSlicer (.orca_printer)';
    const multiMaterial = selection.filaments.length > 1;

    const toggleMaterial = (preset: RawPreset) => {
        const isSelected = selection.filaments.some((p) => p.path === preset.path);
        const next = isSelected
            ? selection.filaments.filter((p) => p.path !== preset.path)
            : [...selection.filaments, preset];
        onUpdateSelection({ filaments: next });
    };

    const toggleDefectMaterial = (preset: RawPreset) => {
        const isDefect = selection.defectFilaments.some((df) => df.path === preset.path);
        const next = isDefect
            ? selection.defectFilaments.filter((df) => df.path !== preset.path)
            : [...selection.defectFilaments, preset];
        onUpdateSelection({ defectFilaments: next });
    };

    return (
        <div className="mt-4 space-y-6">
            <div className="flex items-center gap-3 rounded-xl border border-green-500/20 bg-green-500/10 p-3">
                <CircleCheck size={16} className="shrink-0 text-green-400" />
                <div>
                    <p className="text-sm font-bold text-green-400">预设包解析成功</p>
                    <p className="text-xs text-text-light/50">
                        {formatLabel} · {bundle.printers.length} 机器 · {bundle.filaments.length} 材料 · {bundle.processes.length} 工艺
                    </p>
                </div>
            </div>

            <SectionHeader index={1} title="选择机器预设" subtitle="单选" />
            <div className="space-y-2">
                {bundle.printers.map((preset) => (
                    <PresetCard
                        key={preset.path}
                        preset={preset}
                        selected={selection.printer?.path === preset.path}
                        onClick={() => onUpdateSelection({ printer: preset })}
                    />
                ))}
            </div>

            <SectionHeader index={2} title="选择工艺预设" subtitle="单选" />
            <div className="space-y-2">
                {bundle.processes.map((preset) => (
                    <PresetCard
                        key={preset.path}
                        preset={preset}
                        selected={selection.process?.path === preset.path}
                        onClick={() => onUpdateSelection({ process: preset })}
                    />
                ))}
            </div>

            <SectionHeader
                index={3}
                title="选择材料预设"
                subtitle={multiMaterial ? '多选 · 请标记缺陷材料' : '多选（多色打印可选择多个）'}
            />
            {multiMaterial && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-400">
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <p>检测到多色或多材料打印。请点击对应材料上的<strong>“标记为缺陷源”</strong>，告诉 AI 哪些材料出现了缺陷，支持多选。</p>
                </div>
            )}
            <div className="space-y-2">
                {bundle.filaments.map((preset) => (
                    <MaterialCard
                        key={preset.path}
                        preset={preset}
                        selected={selection.filaments.some((selectedPreset) => selectedPreset.path === preset.path)}
                        onToggle={() => toggleMaterial(preset)}
                        isDefect={selection.defectFilaments.some((defectPreset) => defectPreset.path === preset.path)}
                        onToggleDefect={() => toggleDefectMaterial(preset)}
                        showDefectPicker={multiMaterial}
                    />
                ))}
            </div>

            {(selection.printer || selection.process || selection.filaments.length > 0) && (
                <div className="space-y-1.5 rounded-xl border border-secondary/10 bg-secondary/5 p-3 text-xs">
                    <p className="mb-2 font-bold uppercase tracking-wider text-text-light/60">已选配置</p>
                    {selection.printer && <Row label="机器" value={selection.printer.name} />}
                    {selection.process && <Row label="工艺" value={selection.process.name} />}
                    {selection.filaments.length > 0 && (
                        <Row label="材料" value={selection.filaments.map((preset) => preset.name).join(' + ')} />
                    )}
                    {multiMaterial && selection.defectFilaments.length > 0 && (
                        <Row
                            label="缺陷材料"
                            value={selection.defectFilaments.map((preset) => preset.name).join(', ')}
                            className="text-amber-400"
                        />
                    )}
                </div>
            )}
        </div>
    );
};

function SectionHeader({ index, title, subtitle }: { index: number; title: string; subtitle: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cta text-[10px] font-bold text-white">
                {index}
            </div>
            <div>
                <p className="text-sm font-bold">{title}</p>
                <p className="text-[10px] text-text-light/40">{subtitle}</p>
            </div>
        </div>
    );
}

function Row({ label, value, className = '' }: { label: string; value: string; className?: string }) {
    return (
        <div className={`flex gap-2 ${className}`}>
            <span className="w-16 shrink-0 text-text-light/40">{label}</span>
            <span className="truncate font-medium">{value}</span>
        </div>
    );
}

export function LoadingSpinner() {
    return (
        <div className="flex items-center gap-2 text-sm text-text-light/40">
            <Loader2 size={16} className="animate-spin" />
            正在解析预设包...
        </div>
    );
}

export function PresetErrorBanner({ message }: { message: string }) {
    return (
        <div className="mt-2 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <p>{message}</p>
        </div>
    );
}
