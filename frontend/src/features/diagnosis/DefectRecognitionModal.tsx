import React, { useState, useRef } from 'react';
import { X, ImageIcon, Loader2, Scan } from 'lucide-react';
import { useOnnxModel } from './useOnnxModel';

const LABELS_CN: Record<string, string> = {
    "Blob of Death": "死亡团块",
    "Blobs and Zits": "疙瘩与斑点",
    "Bridging Failure": "桥接失效",
    "Layer Separation": "层间剥离",
    "Layer Shifting": "层间错位",
    "No Defect": "无缺陷",
    "Nozzle Clog": "喷嘴堵塞",
    "Overhang Sagging": "悬垂下垂",
    "Spaghetti": "炒面 (乱丝)",
    "Stringing": "拉丝",
    "Under Extrusion": "挤出不足",
    "Warping": "边缘翘曲",
    "Z-Banding": "Z轴纹路",
    "Bed Adhesion": "热床粘附失效",
    "Over Extrusion": "过度挤出"
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

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setResults(null);
        }
        e.target.value = '';
    };

    const handleStartRecognition = async () => {
        if (!imageFile) return;
        const res = await runInference(imageFile);
        if (res) {
            setResults(res.slice(0, 3)); // Show top 3 results
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
            
            <div className="relative w-full max-w-md bg-background-light dark:bg-background-dark border border-secondary/20 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-secondary/10 flex items-center justify-between bg-secondary/5 rounded-t-2xl">
                    <div className="flex items-center gap-2">
                        <Scan size={18} className="text-cta" />
                        <h2 className="font-bold text-text-light dark:text-text-dark">打印缺陷识别 <span className="text-xs font-normal text-text-light/50 ml-1">(仅供参考)</span></h2>
                    </div>
                    <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-secondary/10 text-text-light/50 transition-colors">
                        <X size={16} />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto">
                    <div className="space-y-4">
                        {/* Image Upload Area */}
                        {!previewUrl ? (
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-secondary/20 hover:border-cta/40 rounded-xl p-8 text-center cursor-pointer group bg-secondary/5 hover:bg-cta/5 transition-all"
                            >
                                <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                                    <ImageIcon size={20} className="text-text-light/40 group-hover:text-cta" />
                                </div>
                                <p className="text-sm font-bold text-text-light dark:text-text-dark mb-1">点击上传图片识别</p>
                                <p className="text-xs text-text-light/50">支持 JPG, PNG 格式</p>
                            </div>
                        ) : (
                            <div className="relative rounded-xl overflow-hidden border border-secondary/20 bg-black/5 group">
                                <img src={previewUrl} alt="Preview" className="w-full h-48 object-contain" />
                                <button 
                                    onClick={() => { setImageFile(null); setPreviewUrl(null); setResults(null); }}
                                    className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )}
                        <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageChange} />

                        {/* Results or Action Button */}
                        {previewUrl && !results && (
                            <button
                                onClick={handleStartRecognition}
                                disabled={isInferencing || !isModelReady}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-cta text-white font-bold rounded-xl shadow-lg shadow-cta/20 hover:bg-cta-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isInferencing ? <Loader2 size={16} className="animate-spin" /> : <Scan size={16} />}
                                {isInferencing ? '正在识别...' : !isModelReady ? '模型加载中...' : '开始识别'}
                            </button>
                        )}

                        {/* Top 3 Results */}
                        {results && (
                            <div className="space-y-3 mt-4 animate-in fade-in slide-in-from-bottom-2">
                                <h3 className="text-xs font-bold uppercase text-text-light/50 tracking-wider">识别结果 (Top 3)</h3>
                                <div className="space-y-2">
                                    {results.map((res, i) => (
                                        <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${i === 0 ? 'bg-cta/5 border-cta/20' : 'bg-secondary/5 border-secondary/10'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${i === 0 ? 'bg-cta text-white shadow-sm' : 'bg-secondary/20 text-text-light/70'}`}>
                                                    {i + 1}
                                                </div>
                                                <span className={`text-sm font-bold ${i === 0 ? 'text-cta' : 'text-text-light dark:text-text-dark'}`}>
                                                    {formatClassName(res.className)}
                                                </span>
                                            </div>
                                            <div className="text-xs font-mono font-medium text-text-light/60">
                                                {(res.probability * 100).toFixed(1)}%
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4 pt-4 border-t border-secondary/10 text-center">
                                    <p className="text-[11px] text-text-light/60 bg-secondary/5 p-2 rounded-lg">
                                        💡 提示：以上结果仅供参考，请根据此结果组织您的提问。
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
