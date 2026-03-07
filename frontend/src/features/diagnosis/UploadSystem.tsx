import React, { useRef, useState } from 'react';
import { Upload, X, FileCode, ImageIcon, AlertTriangle, ShieldCheck } from 'lucide-react';

interface UploadSystemProps {
    onStartDiagnosis: (file: File) => void;
    isInferencing: boolean;
    isModelReady: boolean;
}

export const UploadSystem: React.FC<UploadSystemProps> = ({ onStartDiagnosis, isInferencing, isModelReady }) => {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setImageFile(e.target.files[0]);
        }
    };


    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Image Upload Area */}
                <div
                    className="border-2 border-dashed border-secondary/10 rounded-xl p-8 hover:border-cta/40 hover:bg-cta/5 transition-all text-center group cursor-pointer relative"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleImageChange}
                    />
                    {imageFile ? (
                        <div className="flex flex-col items-center">
                            <img src={URL.createObjectURL(imageFile)} alt="Preview" className="h-24 object-contain rounded mb-4" />
                            <p className="text-sm font-bold text-cta">{imageFile.name}</p>
                        </div>
                    ) : (
                        <>
                            <div className="w-12 h-12 bg-secondary/5 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                <ImageIcon className="text-text-light/40 group-hover:text-cta" />
                            </div>
                            <p className="text-sm font-bold mb-1">图片上传</p>
                            <p className="text-xs text-text-light/40">点击上传打印缺陷照片</p>
                        </>
                    )}
                </div>

                {/* Preset Upload Area */}
                <div className="border-2 border-dashed border-secondary/10 rounded-xl p-8 hover:border-cta/40 hover:bg-cta/5 transition-all text-center group cursor-pointer">
                    <div className="w-12 h-12 bg-secondary/5 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                        <FileCode className="text-text-light/40 group-hover:text-cta" />
                    </div>
                    <p className="text-sm font-bold mb-1">预设文件上传</p>
                    <p className="text-xs text-text-light/40">支持 .bbcfg / .json / .orca_printer</p>
                </div>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-text-light/40 block mb-2">问题补充说明</label>
                    <textarea
                        className="w-full bg-secondary/5 border border-secondary/10 rounded-lg p-4 text-sm min-h-[100px] focus:outline-none focus:ring-2 focus:ring-cta/20 focus:border-cta/40 transition-all font-body"
                        placeholder="描述您在打印过程中遇到的具体情况..."
                    />
                </div>

                <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-text-light/40 block mb-2 flex items-center gap-2">
                        <ShieldCheck size={14} className="text-cta" />
                        参数安全限制 (AI 调参边界)
                    </label>
                    <textarea
                        className="w-full bg-secondary/5 border border-secondary/10 rounded-lg p-4 text-sm min-h-[100px] focus:outline-none focus:ring-2 focus:ring-cta/20 focus:border-cta/40 transition-all font-body"
                        placeholder="输入对 AI 调参的硬性要求（例如：不要修改打印温度、保持原有支撑设置...），AI 思考前和输出时都会严格检查该限制。"
                    />
                </div>
            </div>

            <div className="flex justify-end pt-4 gap-4 items-center">
                {!isModelReady && <span className="text-xs text-yellow-500">模型初始化中...</span>}
                <button
                    className="btn-cta disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!imageFile || isInferencing || !isModelReady}
                    onClick={() => imageFile && onStartDiagnosis(imageFile)}
                >
                    <Upload size={18} />
                    {isInferencing ? "AI 识别推理中..." : "开始深度 AI 诊断"}
                </button>
            </div>
        </div>
    );
};
