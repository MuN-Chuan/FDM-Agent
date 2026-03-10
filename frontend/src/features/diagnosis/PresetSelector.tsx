import React from 'react';
import { CircleCheck, AlertCircle, Loader2, Star } from 'lucide-react';
import type { ParsedBundle, PresetSelection, RawPreset } from './usePresetParser';

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
    const displayName = preset.name.replace(/@.*/, '').trim();      // Remove @BBL xxx suffix for cleaner display
    const suffix = preset.name.match(/@(.+)/)?.[1] ?? '';
    return (
        <button
            onClick={onClick}
            className={`w-full text-left px-4 py-3 rounded-xl border transition-all relative ${selected
                ? 'border-cta bg-cta/10 shadow-sm'
                : 'border-secondary/10 bg-secondary/5 hover:border-cta/30 hover:bg-cta/5'
                }`}
        >
            <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${selected ? 'border-cta bg-cta' : 'border-secondary/20'}`}>
                    {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{displayName}</p>
                    {suffix && <p className="text-[10px] text-text-light/40 truncate">{suffix}</p>}
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
            <button onClick={onToggle} className="w-full text-left px-4 py-3 flex items-center gap-3">
                <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-all ${selected ? 'border-cta bg-cta' : 'border-secondary/20'}`}>
                    {selected && <div className="w-2 h-2 bg-white" />}
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{displayName}</p>
                    {suffix && <p className="text-[10px] text-text-light/40 truncate">{suffix}</p>}
                </div>
            </button>
            {selected && showDefectPicker && (
                <div className="px-4 pb-3 flex items-center gap-2">
                    <button
                        onClick={onToggleDefect}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${isDefect
                            ? 'border-amber-500 bg-amber-500/20 text-amber-400'
                            : 'border-secondary/10 text-text-light/40 hover:border-amber-500/50 hover:text-amber-500'
                            }`}
                    >
                        <Star size={10} className={isDefect ? 'fill-amber-400' : ''} />
                        {isDefect ? '标记为缺陷源' : '标记为缺陷源'}
                    </button>
                    {isDefect && (
                        <span className="text-[10px] text-amber-400/70">AI 将针对此材料参数进行深度诊断</span>
                    )}
                </div>
            )}
        </div>
    );
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({
    bundle,
    selection,
    onUpdateSelection,
}) => {
    if (!bundle) return null;

    const formatLabel = bundle.format === 'bambu'
        ? '拓竹 BambuLab (.bbscfg)'
        : 'OrcaSlicer (.orca_printer)';

    const multiMaterial = selection.filaments.length > 1;

    const toggleMaterial = (preset: RawPreset) => {
        const isSelected = selection.filaments.some(p => p.path === preset.path);
        let next: RawPreset[];
        if (isSelected) {
            next = selection.filaments.filter(p => p.path !== preset.path);
        } else {
            next = [...selection.filaments, preset];
        }
        onUpdateSelection({ filaments: next });
    };

    const toggleDefectMaterial = (preset: RawPreset) => {
        const isDefect = selection.defectFilaments.some(df => df.path === preset.path);
        let next: RawPreset[];
        if (isDefect) {
            next = selection.defectFilaments.filter(df => df.path !== preset.path);
        } else {
            next = [...selection.defectFilaments, preset];
        }
        onUpdateSelection({ defectFilaments: next });
    };

    return (
        <div className="space-y-6 mt-4">
            {/* Header Banner */}
            <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                <CircleCheck size={16} className="text-green-400 shrink-0" />
                <div>
                    <p className="text-sm font-bold text-green-400">预设包解析成功</p>
                    <p className="text-xs text-text-light/50">{formatLabel} · {bundle.printers.length} 机器 · {bundle.filaments.length} 材料 · {bundle.processes.length} 工艺</p>
                </div>
            </div>

            {/* Step 1: Machine Preset */}
            <SectionHeader index={1} title="选择机器预设" subtitle="单选" />
            <div className="space-y-2">
                {bundle.printers.map(p => (
                    <PresetCard
                        key={p.path}
                        preset={p}
                        selected={selection.printer?.path === p.path}
                        onClick={() => onUpdateSelection({ printer: p })}
                    />
                ))}
            </div>

            {/* Step 2: Process Preset */}
            <SectionHeader index={2} title="选择工艺预设" subtitle="单选" />
            <div className="space-y-2">
                {bundle.processes.map(p => (
                    <PresetCard
                        key={p.path}
                        preset={p}
                        selected={selection.process?.path === p.path}
                        onClick={() => onUpdateSelection({ process: p })}
                    />
                ))}
            </div>

            {/* Step 3: Material Presets */}
            <SectionHeader
                index={3}
                title="选择材料预设"
                subtitle={multiMaterial ? '多选 · 请标记缺陷材料' : '多选（多色打印可多选）'}
            />
            {multiMaterial && (
                <div className="flex items-start gap-2 p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 text-xs text-amber-400">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <p>检测到多色/多材料打印。请点击相应材料上的<strong>「标记为缺陷源」</strong>以告知 AI 哪些材料出现了缺陷，支持多选。</p>
                </div>
            )}
            <div className="space-y-2">
                {bundle.filaments.map(p => (
                    <MaterialCard
                        key={p.path}
                        preset={p}
                        selected={selection.filaments.some(s => s.path === p.path)}
                        onToggle={() => toggleMaterial(p)}
                        isDefect={selection.defectFilaments.some(df => df.path === p.path)}
                        onToggleDefect={() => toggleDefectMaterial(p)}
                        showDefectPicker={multiMaterial}
                    />
                ))}
            </div>

            {/* Selection summary */}
            {(selection.printer || selection.process || selection.filaments.length > 0) && (
                <div className="p-3 bg-secondary/5 border border-secondary/10 rounded-xl text-xs space-y-1.5">
                    <p className="font-bold text-text-light/60 uppercase tracking-wider mb-2">已选配置</p>
                    {selection.printer && <Row label="机器" value={selection.printer.name} />}
                    {selection.process && <Row label="工艺" value={selection.process.name} />}
                    {selection.filaments.length > 0 && (
                        <Row label="材料" value={selection.filaments.map(p => p.name).join(' + ')} />
                    )}
                    {multiMaterial && selection.defectFilaments.length > 0 && (
                        <Row label="缺陷材料" value={selection.defectFilaments.map(p => p.name).join(', ')} className="text-amber-400" />
                    )}
                </div>
            )}
        </div>
    );
};

function SectionHeader({ index, title, subtitle }: { index: number; title: string; subtitle: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-cta flex items-center justify-center text-white text-[10px] font-bold shrink-0">
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
            <span className="text-text-light/40 w-16 shrink-0">{label}</span>
            <span className="font-medium truncate">{value}</span>
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
        <div className="flex items-start gap-2 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-400 mt-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <p>{message}</p>
        </div>
    );
}


