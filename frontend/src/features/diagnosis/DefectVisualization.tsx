import React, { useState, useRef, useEffect } from 'react';
import { Maximize2, Tag, Crosshair, Zap, Plus, X, Check, ChevronDown } from 'lucide-react';
import type { InferenceResult } from './useOnnxModel';

interface DefectVisualizationProps {
    imageFile: File | null;
    results: InferenceResult[] | null;
    selectedClasses?: string[];
    onSelectionChange?: (classes: string[]) => void;
    /** If provided, shows a "继续深度诊断" button (detect-only mode) */
    onContinueDeep?: () => void;
    /** Called when user manually corrects/reorders the results */
    onResultsUpdated?: (results: InferenceResult[]) => void;
}

const LABELS_CN: Record<string, string> = {
    "Blob of Death": "死亡团块",
    "Blobs and Zits": "疙瘩与斑点",
    "Bridging Failure": "桥接失效",
    "Layer Separation": "层间剥离",
    "Layer Shifting": "层移",
    "No Defect": "无缺陷",
    "Nozzle Clog": "喷嘴堵塞",
    "Overhang Sagging": "悬垂下垂",
    "Spaghetti": "炒面 (乱丝)",
    "Stringing": "拉丝",
    "Under Extrusion": "挤出不足",
    "Warping": "翘曲",
    "Z-Banding": "Z轴纹路",
    "Bed Adhesion": "热床粘附失效",
    "Over Extrusion": "过度挤出"
};

const formatClassName = (name: string) => LABELS_CN[name] || name;

export const DefectVisualization: React.FC<DefectVisualizationProps> = ({ 
    imageFile, 
    results, 
    selectedClasses = [],
    onSelectionChange,
    onContinueDeep
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [addingDefect, setAddingDefect] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        if (isDropdownOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isDropdownOpen]);

    if (!imageFile || !results || results.length === 0) {
        return (
            <div className="flex items-center justify-center p-12 text-sm text-text-light/40 border border-secondary/10 border-dashed rounded-xl">
                等待图片上传与 AI 诊断...
            </div>
        );
    }

    const toggleSelection = (className: string) => {
        if (!onSelectionChange) return;
        if (selectedClasses.includes(className)) {
            onSelectionChange(selectedClasses.filter(c => c !== className));
        } else {
            onSelectionChange([...selectedClasses, className]);
        }
    };

    const handleAddManualDefect = (className: string) => {
        if (!onSelectionChange) return;
        if (!selectedClasses.includes(className)) {
            onSelectionChange([...selectedClasses, className]);
        }
        setAddingDefect(false);
    };

    const topResults = results.slice(0, 3);
    const primaryResult = topResults[0];

    // Combine top results with any manually selected classes that aren't in topResults
    const displayResults = [...topResults];
    selectedClasses.forEach(cls => {
        if (!displayResults.find(r => r.className === cls)) {
            const classIndex = Object.keys(LABELS_CN).indexOf(cls);
            displayResults.push({ className: cls, probability: 0.99, classIndex: classIndex !== -1 ? classIndex : 99 });
        }
    });

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Mockup of detected image */}
                <div className="relative rounded-xl overflow-hidden border border-secondary/10 bg-black group flex items-center justify-center min-h-[300px]">
                    <img
                        src={URL.createObjectURL(imageFile)}
                        alt="FDM Defect"
                        className="w-full h-auto max-h-[400px] object-contain opacity-90 group-hover:scale-105 transition-transform duration-500"
                    />

                    {/* Bounding Box Mock (Can be implemented properly if object detection is used) */}
                    <div className="absolute inset-x-0 bottom-4 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="bg-black/70 backdrop-blur-md text-white font-bold px-4 py-2 rounded-full shadow-xl">
                            {formatClassName(primaryResult.className)} ({(primaryResult.probability * 100).toFixed(1)}%)
                        </span>
                    </div>
                    <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white cursor-pointer hover:scale-110 transition-transform">
                            <Maximize2 size={16} />
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="card bg-secondary/5 border border-secondary/10 p-4 rounded-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-text-light/40 flex items-center gap-2">
                                <Tag size={14} />
                                已识别缺陷
                            </h3>
                            {onSelectionChange && (
                                <button 
                                    onClick={() => {
                                        setIsEditing(!isEditing);
                                        setAddingDefect(false);
                                    }}
                                    className="text-[10px] font-bold text-cta hover:underline"
                                >
                                    {isEditing ? '完成编辑' : '手动修正结果'}
                                </button>
                            )}
                        </div>

                        <div className="space-y-3">
                            {displayResults.map((res, i) => {
                                const isSelected = selectedClasses.includes(res.className) || (!onSelectionChange && i === 0);
                                return (
                                <div key={i} className={`flex items-center justify-between ${!isSelected ? 'opacity-40 grayscale' : ''} transition-all`}>
                                    <div className="flex items-center gap-3">
                                        {onSelectionChange && isEditing && (
                                            <button 
                                                onClick={() => toggleSelection(res.className)}
                                                className={`flex-shrink-0 w-5 h-5 rounded flex items-center justify-center transition-all ${
                                                    isSelected 
                                                        ? 'bg-cta border-cta shadow-[0_0_10px_rgba(var(--color-cta),0.5)]' 
                                                        : 'border border-secondary/30 hover:border-cta/50 bg-white/50 dark:bg-black/20'
                                                }`}
                                            >
                                                {isSelected && <Check size={14} strokeWidth={3} className="text-white" />}
                                            </button>
                                        )}
                                        <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-cta shadow-[0_0_8px_rgba(var(--color-cta),0.8)]' : 'bg-secondary/40'}`} />
                                        <span className="text-sm font-bold truncate max-w-[150px]">{formatClassName(res.className)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 w-24">
                                        <div className="flex-1 h-1 bg-secondary/10 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full ${isSelected ? 'bg-cta' : 'bg-secondary/40'}`}
                                                style={{ width: `${res.probability * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-[10px] font-mono">{(res.probability * 100).toFixed(1)}%</span>
                                    </div>
                                </div>
                            )})}
                        </div>

                        {isEditing && (
                            <div className="mt-4 pt-4 border-t border-secondary/10">
                                {!addingDefect ? (
                                    <button 
                                        onClick={() => setAddingDefect(true)}
                                        className="text-xs flex items-center gap-1 text-text-light/60 hover:text-cta transition-colors"
                                    >
                                        <Plus size={14} /> 添加未识别出的缺陷
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-2 relative">
                                        <div className="flex-1 relative" ref={dropdownRef}>
                                            <button 
                                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                                className="w-full text-left bg-white/80 hover:bg-white dark:bg-black/40 dark:hover:bg-black/60 border border-secondary/20 hover:border-cta/40 transition-colors rounded-lg px-3 py-2.5 text-xs text-text-light dark:text-text-dark outline-none flex items-center justify-between shadow-inner"
                                            >
                                                <span className="opacity-80">选择要添加的缺陷...</span>
                                                <ChevronDown size={14} className={`opacity-40 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                                            </button>
                                            
                                            {/* Custom Dropdown Menu */}
                                            {isDropdownOpen && (
                                                <div className="absolute z-50 left-0 right-0 top-full mt-2 py-1.5 bg-white/95 dark:bg-[#1a1c23]/95 backdrop-blur-xl border border-secondary/20 rounded-xl shadow-2xl overflow-y-auto max-h-56 custom-scrollbar animate-in fade-in zoom-in-95 duration-200">
                                                    {Object.entries(LABELS_CN).map(([eng, chn]) => {
                                                        const exists = displayResults.some(r => r.className === eng);
                                                        if (exists) return null;
                                                        
                                                        return (
                                                            <button
                                                                key={eng}
                                                                onClick={() => {
                                                                    handleAddManualDefect(eng);
                                                                    setIsDropdownOpen(false);
                                                                }}
                                                                className="w-full text-left px-3 py-2.5 text-xs hover:bg-secondary/10 hover:text-cta transition-colors text-text-light dark:text-text-dark opacity-80 hover:opacity-100 flex items-center justify-between group"
                                                            >
                                                                <span>{chn}</span>
                                                                <Plus size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            </button>
                                                        );
                                                    })}
                                                    {Object.entries(LABELS_CN).every(([eng]) => displayResults.some(r => r.className === eng)) && (
                                                        <div className="px-3 py-4 text-center text-xs text-text-light/30 italic">
                                                            所有缺陷类型均已添加
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={() => {
                                            setAddingDefect(false);
                                            setIsDropdownOpen(false);
                                        }} className="p-2 hover:bg-red-500/10 rounded-lg hover:text-red-400 text-text-light/40 transition-colors">
                                            <X size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-cta/5 border border-cta/10 rounded-xl text-xs space-y-2">
                        <p className="font-bold flex items-center gap-2">
                            <Crosshair size={14} />
                            本地推理引擎 (ONNX)
                        </p>
                        <p className="text-text-light/60">
                            最高置信度识别结果为 <strong>{formatClassName(primaryResult.className)}</strong>，置信度 <strong>{(primaryResult.probability * 100).toFixed(1)}%</strong>。模型已通过 640px WebAssembly 后端完成本地加速推理。
                        </p>
                    </div>

                    {/* 继续深度诊断 button — shown only in detect-only mode */}
                    {onContinueDeep && (
                        <button
                            onClick={onContinueDeep}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-cta text-white font-bold text-sm hover:bg-cta/90 hover:scale-[1.01] transition-all shadow-lg shadow-cta/20"
                        >
                            <Zap size={16} />
                            继续深度诊断
                            <span className="text-xs font-normal text-white/70 ml-1">（使用以上识别结果，无需重新检测）</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
