import React, { useState } from 'react';
import { UploadSystem } from '../features/diagnosis/UploadSystem';
import type { DiagnosisMode, DiagnosisPayload } from '../features/diagnosis/UploadSystem';
import { AnalysisTimeline } from '../features/diagnosis/AnalysisTimeline';
import { DefectVisualization } from '../features/diagnosis/DefectVisualization';
import { ParameterDiffViewer } from '../features/diagnosis/ParameterDiffViewer';
import { AIResultMarkdown } from '../features/diagnosis/AIResultMarkdown';
import { useOnnxModel } from '../features/diagnosis/useOnnxModel';
import type { InferenceResult } from '../features/diagnosis/useOnnxModel';
import { api } from '../api/api';
import type { ParameterModification } from '../features/diagnosis/ParameterDiffViewer';

export const DiagnosisDashboard: React.FC = () => {
    const { isModelReady, isInferencing, modelError, runInference } = useOnnxModel();

    // State shared across sections
    const [currentImageFile, setCurrentImageFile] = useState<File | null>(null);
    const [inferenceResults, setInferenceResults] = useState<InferenceResult[] | null>(null);
    const [diagnosisMode, setDiagnosisMode] = useState<DiagnosisMode | null>(null);
    const [currentPayload, setCurrentPayload] = useState<DiagnosisPayload | null>(null);
    const [timelineStatus, setTimelineStatus] = useState<'idle' | 'detecting' | 'parsing' | 'analyzing' | 'completed'>('idle');
    const [hasPresetFile, setHasPresetFile] = useState(false);

    // AI Diagnosis results
    const [aiReasoning, setAiReasoning] = useState<string | null>(null);
    const [modifications, setModifications] = useState<ParameterModification[]>([]);

    const handleStartDiagnosis = async (mode: DiagnosisMode, payload: DiagnosisPayload) => {
        setDiagnosisMode(mode);
        setCurrentPayload(payload);

        let detections: InferenceResult[] = [];
        if (mode === 'detect' || mode === 'deep') {
            if (payload.imageFile) {
                setInferenceResults(null);
                setTimelineStatus('detecting');
                const res = await runInference(payload.imageFile);
                if (res) {
                    setInferenceResults(res);
                    detections = res;
                }
            }
        }

        // Deep/Chat diagnosis backend call
        if (mode === 'deep' || mode === 'chat') {
            setTimelineStatus('analyzing');
            try {
                const response = await api.diagnose({
                    detections: detections.map(d => ({ label: d.className, confidence: d.probability })),
                    description: payload.description,
                    safety_constraints: payload.safetyConstraints,
                    preset_data: payload.presetBundle
                });
                setAiReasoning(response.reasoning_markdown);
                setModifications(response.modifications as ParameterModification[]);
                setTimelineStatus('completed');
            } catch (error) {
                console.error('Diagnosis failed:', error);
                setTimelineStatus('idle');
            }
        } else if (mode === 'detect') {
            setTimelineStatus('completed');
        }
        // In 'chat' mode, no inference needed
    };

    /** Called from DefectVisualization "继续深度诊断" button */
    const handleContinueWithDetection = () => {
        setDiagnosisMode('deep');
        // Keep existing inferenceResults as-is (bypass inference step)
    };

    /** Allow updating results after manual correction */
    const handleResultsUpdated = (results: InferenceResult[]) => {
        setInferenceResults(results);
    };

    const handleImageChange = (file: File | null) => {
        setCurrentImageFile(file);
    };

    const handlePresetChange = (has: boolean) => {
        setHasPresetFile(has);
    };

    const handleParsingChange = (isParsing: boolean) => {
        if (isParsing) setTimelineStatus('parsing');
        else if (timelineStatus === 'parsing') setTimelineStatus('idle');
    };

    const showVisualization = diagnosisMode === 'detect' || diagnosisMode === 'deep';
    const showDeepResults = diagnosisMode === 'deep' || diagnosisMode === 'chat';

    return (
        <div className="space-y-8 pb-12 relative">
            <header>
                <h1 className="text-3xl font-heading font-bold text-text-light dark:text-text-dark">AI 诊断</h1>
                <p className="text-text-light/60 dark:text-text-dark/40 mt-1">
                    上传打印缺陷图片和预设文件，由本地识别模型与大语言模型协同工作提供深度诊断。
                </p>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-stretch">
                <div className="xl:col-span-8 space-y-8">

                    {/* ─── Diagnosis Input ─── */}
                    <section className="card-glass dark:bg-primary/40">
                        <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-cta rounded-full" />
                            诊断输入中心
                        </h2>
                        {modelError && (
                            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                                <strong>AI 模型加载失败：</strong> {modelError}
                            </div>
                        )}
                        <UploadSystem
                            onStartDiagnosis={handleStartDiagnosis}
                            onImageChange={handleImageChange}
                            onPresetChange={handlePresetChange}
                            onParsingChange={handleParsingChange}
                            isInferencing={isInferencing}
                            isModelReady={isModelReady}
                        />
                    </section>

                    {/* ─── Defect Visualization (detect / deep mode) ─── */}
                    {showVisualization && (
                        <section className="card-glass dark:bg-primary/40">
                            <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                                <span className="w-1.5 h-6 bg-cta rounded-full" />
                                识别可视化
                            </h2>
                            <DefectVisualization
                                imageFile={currentImageFile}
                                results={inferenceResults}
                                onContinueDeep={
                                    diagnosisMode === 'detect'
                                        ? handleContinueWithDetection
                                        : undefined
                                }
                                onResultsUpdated={handleResultsUpdated}
                            />
                        </section>
                    )}

                    {/* ─── Parameter Diff (deep mode only) ─── */}
                    {showDeepResults && (
                        <section className="card-glass dark:bg-primary/40">
                            <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                                <span className="w-1.5 h-6 bg-cta rounded-full" />
                                参数变更建议 (Diff)
                            </h2>
                            <ParameterDiffViewer modifications={modifications} />
                        </section>
                    )}
                </div>

                {/* ─── Right Sidebar ─── */}
                <div className="xl:col-span-4 flex flex-col gap-8 h-full relative">
                    {/* Progress Card (Static) */}
                    <section className="card-glass dark:bg-primary/40 shrink-0">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-text-light/40 dark:text-text-dark/40 mb-6">
                            分析进度
                        </h2>
                        <AnalysisTimeline
                            hasImage={!!currentImageFile}
                            hasPreset={hasPresetFile}
                            status={timelineStatus}
                        />
                    </section>

                    {/* AI Reasoning Card (Sticky) */}
                    {showDeepResults && (
                        <div className="sticky top-0 z-30 self-start w-full">
                            <section className="card-glass dark:bg-primary/40 max-h-[calc(100vh-140px)] flex flex-col shadow-2xl shadow-cta/5 border-cta/20">
                                <h2 className="text-base font-bold uppercase tracking-widest text-text-light/40 dark:text-text-dark/40 mb-6 flex items-center gap-2 shrink-0">
                                    <span className="w-1.5 h-6 bg-cta rounded-full" />
                                    AI 推理建议
                                </h2>

                                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
                                    <AIResultMarkdown
                                        content={aiReasoning || ''}
                                        isLoading={timelineStatus === 'analyzing'}
                                    />

                                    {diagnosisMode === 'deep' && (
                                        <div className="pt-6 border-t border-secondary/10 flex flex-col gap-3">
                                            <button className="btn-cta w-full justify-center">下载修复后的预设包</button>
                                            <button className="px-4 py-3 text-sm font-bold text-text-light/60 hover:text-cta transition-colors text-center">
                                                生成详细 PDF 诊断报告
                                            </button>
                                        </div>
                                    )}
                                    {diagnosisMode === 'chat' && (
                                        <div className="pt-6 border-t border-secondary/10">
                                            <button className="w-full px-4 py-3 text-sm font-bold text-text-light/60 hover:text-cta transition-colors text-center">
                                                生成 PDF 建议报告
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </section>
                        </div>
                    )}
                </div>
            </div>

            {/* Debug: current mode badge — remove in production */}
            {currentPayload && (
                <div className="text-xs text-text-light/20 flex gap-4">
                    <span>mode: {diagnosisMode}</span>
                    <span>image: {currentPayload.imageFile?.name ?? '—'}</span>
                    <span>desc: {currentPayload.description ? '✓' : '—'}</span>
                    <span>preset: {currentPayload.presetBundle?.bundleId?.slice(0, 20) ?? '—'}</span>
                </div>
            )}
        </div>
    );
};
