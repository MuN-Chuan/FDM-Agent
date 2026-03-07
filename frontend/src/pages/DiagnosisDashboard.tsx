import React, { useState } from 'react';
import { UploadSystem } from '../features/diagnosis/UploadSystem';
import { AnalysisTimeline } from '../features/diagnosis/AnalysisTimeline';
import { DefectVisualization } from '../features/diagnosis/DefectVisualization';
import { ParameterDiffViewer } from '../features/diagnosis/ParameterDiffViewer';
import { AIResultMarkdown } from '../features/diagnosis/AIResultMarkdown';
import { useOnnxModel } from '../features/diagnosis/useOnnxModel';
import type { InferenceResult } from '../features/diagnosis/useOnnxModel';

export const DiagnosisDashboard: React.FC = () => {
    const { isModelReady, isInferencing, modelError, runInference } = useOnnxModel();
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [results, setResults] = useState<InferenceResult[] | null>(null);

    const handleStartDiagnosis = async (file: File) => {
        setImageFile(file);
        const res = await runInference(file);
        if (res) {
            setResults(res);
        }
    };

    return (
        <div className="space-y-8 pb-12">
            <header>
                <h1 className="text-3xl font-heading font-bold text-text-light dark:text-text-dark">AI 诊断</h1>
                <p className="text-text-light/60 dark:text-text-dark/40 mt-1">上传打印缺陷图片和预设文件，由本地识别模型与大语言模型协同工作提供深度诊断。</p>
            </header>

            {/* Grid for main content */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                <div className="xl:col-span-8 space-y-8">
                    {/* Main Workspace: Actions */}
                    <section className="card-glass dark:bg-primary/40">
                        <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-cta rounded-full" />
                            诊断输入中心
                        </h2>
                        {modelError && (
                            <div className="mb-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                                模型加载失败: {modelError}
                            </div>
                        )}
                        <UploadSystem
                            onStartDiagnosis={handleStartDiagnosis}
                            isInferencing={isInferencing}
                            isModelReady={isModelReady}
                        />
                    </section>

                    {/* AI Analysis visualization */}
                    <section className="card-glass dark:bg-primary/40">
                        <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-cta rounded-full" />
                            识别可视化
                        </h2>
                        <DefectVisualization imageFile={imageFile} results={results} />
                    </section>

                    {/* Diff View */}
                    <section className="card-glass dark:bg-primary/40">
                        <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-cta rounded-full" />
                            参数变更建议 (Diff)
                        </h2>
                        <ParameterDiffViewer />
                    </section>
                </div>

                <div className="xl:col-span-4 space-y-8 sticky top-24">
                    {/* Timeline / Progress */}
                    <section className="card-glass dark:bg-primary/40">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-text-light/40 dark:text-text-dark/40 mb-6">分析进度</h2>
                        <AnalysisTimeline />
                    </section>

                    {/* AI Reasoning Markdown */}
                    <section className="card-glass dark:bg-primary/40">
                        <h2 className="text-base font-bold uppercase tracking-widest text-text-light/40 dark:text-text-dark/40 mb-6">AI 推理建议</h2>
                        <AIResultMarkdown />
                        <div className="mt-8 pt-6 border-t border-secondary/10 flex flex-col gap-3">
                            <button className="btn-cta w-full justify-center">
                                下载修复后的预设包
                            </button>
                            <button className="px-4 py-3 text-sm font-bold text-text-light/60 hover:text-cta transition-colors text-center">
                                生成详细 PDF 诊断报告
                            </button>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};
