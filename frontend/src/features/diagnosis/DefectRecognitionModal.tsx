import React, { useRef, useState } from 'react';
import { ImageIcon, Loader2, Scan, X } from 'lucide-react';

import { useOnnxModel } from './useOnnxModel';

const LABELS_CN: Record<string, string> = {
    'Blob of Death': '死亡团块',
    'Blobs and Zits': '疙瘩与斑点',
    'Bridging Failure': '桥接失败',
    'Layer Separation': '层间剥离',
    'Layer Shifting': '层间错位',
    'No Defect': '无缺陷',
    'Nozzle Clog': '喷嘴堵塞',
    'Overhang Sagging': '悬垂下垂',
    Spaghetti: '炒面纹',
    Stringing: '拉丝',
    'Under Extrusion': '挤出不足',
    Warping: '翘边',
    'Z-Banding': 'Z 轴纹路',
    'Bed Adhesion': '热床附着失败',
    'Over Extrusion': '过度挤出',
};

const formatClassName = (name: string) => LABELS_CN[name] || name;

interface DefectRecognitionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const DefectRecognitionModal: React.FC<DefectRecognitionModalProps> = ({ isOpen, onClose }) => {
    const { isModelReady, isInferencing, runInference } = useOnnxModel();
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [results, setResults] = useState<{ className: string; probability: number }[] | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setImageFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setResults(null);
        }
        event.target.value = '';
    };

    const handleStartRecognition = async () => {
        if (!imageFile) return;
        const result = await runInference(imageFile);
        if (result) {
            setResults(result.slice(0, 3));
        }
    };

    const handleClose = () => {
        setImageFile(null);
        setPreviewUrl(null);
        setResults(null);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-background-dark/60 backdrop-blur-sm" onClick={handleClose} />

            <div className="relative flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl border border-secondary/20 bg-background-light shadow-2xl dark:bg-background-dark">
                <div className="flex items-center justify-between rounded-t-2xl border-b border-secondary/10 bg-secondary/5 p-4">
                    <div className="flex items-center gap-2">
                        <Scan size={18} className="text-cta" />
                        <h2 className="font-bold text-text-light dark:text-text-dark">
                            打印缺陷识别
                            <span className="ml-1 text-xs font-normal text-text-light/50">（仅供参考）</span>
                        </h2>
                    </div>
                    <button onClick={handleClose} className="rounded-lg p-1.5 text-text-light/50 transition-colors hover:bg-secondary/10">
                        <X size={16} />
                    </button>
                </div>

                <div className="overflow-y-auto p-6">
                    <div className="space-y-4">
                        {!previewUrl ? (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="group cursor-pointer rounded-xl border-2 border-dashed border-secondary/20 bg-secondary/5 p-8 text-center transition-all hover:border-cta/40 hover:bg-cta/5"
                            >
                                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary/10 transition-transform group-hover:scale-110">
                                    <ImageIcon size={20} className="text-text-light/40 group-hover:text-cta" />
                                </div>
                                <p className="mb-1 text-sm font-bold text-text-light dark:text-text-dark">点击上传图片进行识别</p>
                                <p className="text-xs text-text-light/50">支持 JPG、PNG 格式</p>
                            </div>
                        ) : (
                            <div className="group relative overflow-hidden rounded-xl border border-secondary/20 bg-black/5">
                                <img src={previewUrl} alt="Preview" className="h-48 w-full object-contain" />
                                <button
                                    onClick={() => {
                                        setImageFile(null);
                                        setPreviewUrl(null);
                                        setResults(null);
                                    }}
                                    className="absolute right-2 top-2 rounded-lg bg-black/50 p-1.5 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                        <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageChange} />

                        {previewUrl && !results && (
                            <button
                                onClick={handleStartRecognition}
                                disabled={isInferencing || !isModelReady}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-cta py-3 font-bold text-white shadow-lg shadow-cta/20 transition-all hover:bg-cta disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isInferencing ? <Loader2 size={16} className="animate-spin" /> : <Scan size={16} />}
                                {isInferencing ? '正在识别...' : !isModelReady ? '模型加载中...' : '开始识别'}
                            </button>
                        )}

                        {results && (
                            <div className="animate-in mt-4 space-y-3 fade-in slide-in-from-bottom-2">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-text-light/50">识别结果（Top 3）</h3>
                                <div className="space-y-2">
                                    {results.map((result, index) => (
                                        <div
                                            key={index}
                                            className={`flex items-center justify-between rounded-lg border p-3 ${
                                                index === 0 ? 'border-cta/20 bg-cta/5' : 'border-secondary/10 bg-secondary/5'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                                                        index === 0 ? 'bg-cta text-white shadow-sm' : 'bg-secondary/20 text-text-light/70'
                                                    }`}
                                                >
                                                    {index + 1}
                                                </div>
                                                <span className={`text-sm font-bold ${index === 0 ? 'text-cta' : 'text-text-light dark:text-text-dark'}`}>
                                                    {formatClassName(result.className)}
                                                </span>
                                            </div>
                                            <div className="text-xs font-medium font-mono text-text-light/60">
                                                {(result.probability * 100).toFixed(1)}%
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4 border-t border-secondary/10 pt-4 text-center">
                                    <p className="rounded-lg bg-secondary/5 p-2 text-[11px] text-text-light/60">
                                        提示：以上结果仅供参考，你可以基于识别结果继续向 AI 提问。
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
