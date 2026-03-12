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
import { ApiSettingsModal } from '../features/diagnosis/ApiSettingsModal';
import { loadApiSettings } from '../api/apiSettings';
import { Settings } from 'lucide-react';

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
    const [selectedDefectClasses, setSelectedDefectClasses] = useState<string[]>([]);

    // API Settings modal
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const runDeepDiagnosis = async (payload: DiagnosisPayload, classesToUse: string[], allResults: InferenceResult[] | null) => {
        setTimelineStatus('analyzing');
        try {
            const apiSettings = loadApiSettings();
            let accumulatedReasoning = "";

            // Build detections payload based on selected classes
            const detectionsToSubmit = classesToUse.map(cls => {
                const found = allResults?.find(r => r.className === cls);
                return {
                    label: cls,
                    confidence: found ? found.probability : 0.99
                };
            });

            await api.diagnoseStream({
                detections: detectionsToSubmit,
                description: payload.description,
                safety_constraints: payload.safetyConstraints,
                preset_data: {
                    printer: payload.presetSelection?.printer?.data || {},
                    filament: payload.presetSelection?.filaments.map(f => f.data) || [],
                    process: payload.presetSelection?.process?.data || {}
                },
                api_settings: apiSettings
            }, (chunk) => {
                if (chunk.type === 'text' && chunk.content) {
                    accumulatedReasoning += chunk.content;
                    setAiReasoning(accumulatedReasoning);
                } else if (chunk.type === 'done') {
                    if (chunk.reasoning_markdown) setAiReasoning(chunk.reasoning_markdown);
                    if (chunk.modifications) setModifications(chunk.modifications as ParameterModification[]);
                    setTimelineStatus('completed');
                } else if (chunk.type === 'error') {
                    setAiReasoning(`### ❌ AI 服务异常\n\n${chunk.message}\n\n${chunk.raw ? "```text\n" + chunk.raw + "\n```" : ""}`);
                    setTimelineStatus('completed');
                }
            });
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            console.error('Diagnosis stream failed:', msg);
            setAiReasoning(`### ❌ 连接错误\n\n${msg}\n\n**请检查:**\n- 后端服务是否正在运行 (http://localhost:8001)\n- 网络连接是否正常`);
            setModifications([]);
            setTimelineStatus('completed');
        }
    };

    const handleStartDiagnosis = async (mode: DiagnosisMode, payload: DiagnosisPayload) => {
        setDiagnosisMode(mode);
        setCurrentPayload(payload);
        setAiReasoning(null);
        setModifications([]);

        let detections: InferenceResult[] = [];
        let initialSelected: string[] = [];

        if (mode === 'detect' || mode === 'deep') {
            if (payload.imageFile) {
                setInferenceResults(null);
                setTimelineStatus('detecting');
                const res = await runInference(payload.imageFile);
                if (res && res.length > 0) {
                    setInferenceResults(res);
                    detections = res;
                    initialSelected = [res[0].className]; // Default to highest confidence
                    setSelectedDefectClasses(initialSelected);
                }
            }
        }

        // Deep/Chat diagnosis backend call
        if (mode === 'deep' || mode === 'chat') {
            await runDeepDiagnosis(payload, initialSelected, detections);
        } else if (mode === 'detect') {
            setTimelineStatus('completed');
        }
    };

    /** Called from DefectVisualization "继续深度诊断" button */
    const handleContinueWithDetection = () => {
        if (!currentPayload) return;
        setDiagnosisMode('deep');
        setAiReasoning(null);
        setModifications([]);
        runDeepDiagnosis(currentPayload, selectedDefectClasses, inferenceResults);
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
            <header className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-heading font-bold text-text-light dark:text-text-dark">AI 诊断</h1>
                    <p className="text-text-light/60 dark:text-text-dark/40 mt-1">
                        上传打印缺陷图片和预设文件，由本地识别模型与大语言模型协同工作提供深度诊断。
                    </p>
                </div>
                <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="p-2 bg-secondary/5 hover:bg-secondary/10 border border-secondary/10 hover:border-cta/30 rounded-xl transition-all text-text-light/60 hover:text-cta flex items-center gap-2"
                    title="配置 AI 服务调用"
                >
                    <Settings size={20} />
                    <span className="text-xs font-bold uppercase tracking-wider hidden sm:block">AI 设置</span>
                </button>
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
                                selectedClasses={selectedDefectClasses}
                                onSelectionChange={setSelectedDefectClasses}
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
                                        modelName={loadApiSettings().model_name}
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

            <ApiSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                onSave={() => setIsSettingsOpen(false)}
            />
        </div>
    );
};

