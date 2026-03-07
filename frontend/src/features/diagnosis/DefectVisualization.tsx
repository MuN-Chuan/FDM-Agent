import React from 'react';
import { Maximize2, Tag, Crosshair } from 'lucide-react';
import type { InferenceResult } from './useOnnxModel';

interface DefectVisualizationProps {
    imageFile: File | null;
    results: InferenceResult[] | null;
}

export const DefectVisualization: React.FC<DefectVisualizationProps> = ({ imageFile, results }) => {
    if (!imageFile || !results) {
        return (
            <div className="flex items-center justify-center p-12 text-sm text-text-light/40 border border-secondary/10 border-dashed rounded-xl">
                等待图片上传与 AI 诊断...
            </div>
        );
    }

    const topResults = results.slice(0, 3);
    const primaryResult = topResults[0];

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
                            {primaryResult.className} ({(primaryResult.probability * 100).toFixed(1)}%)
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
                            <button className="text-[10px] font-bold text-cta hover:underline">手动修正结果</button>
                        </div>

                        <div className="space-y-3">
                            {topResults.map((res, i) => (
                                <div key={i} className={`flex items-center justify-between ${i > 0 ? 'opacity-60' : ''}`}>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-cta' : 'bg-yellow-500'}`} />
                                        <span className="text-sm font-bold truncate max-w-[150px]">{res.className}</span>
                                    </div>
                                    <div className="flex items-center gap-2 w-24">
                                        <div className="flex-1 h-1 bg-secondary/10 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full ${i === 0 ? 'bg-cta' : 'bg-yellow-500'}`}
                                                style={{ width: `${res.probability * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-[10px] font-mono">{(res.probability * 100).toFixed(1)}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="p-4 bg-cta/5 border border-cta/10 rounded-xl text-xs space-y-2">
                        <p className="font-bold flex items-center gap-2">
                            <Crosshair size={14} />
                            本地推理引擎 (ONNX)
                        </p>
                        <p className="text-text-light/60">
                            最高置信度识别结果为 <strong>{primaryResult.className}</strong>，置信度 <strong>{(primaryResult.probability * 100).toFixed(1)}%</strong>。模型已通过 640px WebAssembly 后端完成本地加速推理。
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
