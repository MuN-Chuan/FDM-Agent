import React, { useState, useEffect } from 'react';
import { Settings, X, Save, AlertCircle } from 'lucide-react';
import type { ApiSettings } from '../../api/apiSettings';
import { loadApiSettings, saveApiSettings, DEFAULT_API_SETTINGS } from '../../api/apiSettings';

interface ApiSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (settings: ApiSettings) => void;
}

export const ApiSettingsModal: React.FC<ApiSettingsModalProps> = ({ isOpen, onClose, onSave }) => {
    const [settings, setSettings] = useState<ApiSettings>(DEFAULT_API_SETTINGS);

    useEffect(() => {
        if (isOpen) setSettings(loadApiSettings());
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        saveApiSettings(settings);
        onSave(settings);
        onClose();
    };

    const inputClass = "w-full bg-secondary/5 border border-secondary/10 rounded-xl p-3 text-text-light dark:text-text-dark text-sm font-body placeholder-text-light/30 focus:outline-none focus:ring-4 focus:ring-cta/10 focus:border-cta/40 transition-all";

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-background-dark border border-secondary/10 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-secondary/5 bg-secondary/5 dark:bg-secondary/10">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-text-light dark:text-text-dark">
                        <Settings size={20} className="text-cta" />
                        AI 服务供应商设置
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-secondary/10 rounded-full transition-colors text-text-light/40 hover:text-text-light dark:hover:text-text-dark cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">

                    <div className="bg-cta/5 border border-cta/10 p-4 rounded-xl flex gap-3 text-cta text-sm font-medium">
                        <AlertCircle size={18} className="shrink-0 mt-0.5" />
                        <div>
                            配置任意兼容 <strong className="text-cta font-bold">OpenAI API</strong> 标准格式的大型语言模型服务（如智谱、DeepSeek、阿里通义等）。
                        </div>
                    </div>

                    {/* System Default Model Selection */}
                    <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-text-light/40 dark:text-text-dark/40 block mb-3">
                            系统默认模型（使用内置密钥）
                        </label>
                        <div className="grid grid-cols-2 gap-3 mb-2">
                            {[
                                { id: 'glm-4.7', label: 'GLM-4.7', sub: '推荐 (效率均衡)' },
                                { id: 'glm-4.6v-flash', label: 'GLM-4.6V-Flash', sub: '极速 (毫秒响应)' },
                            ].map(m => {
                                const isActive = settings.model_name === m.id && !settings.api_key && !settings.base_url;
                                return (
                                    <button
                                        key={m.id}
                                        onClick={() => setSettings({ ...settings, base_url: '', api_key: '', model_name: m.id })}
                                        className={`px-4 py-3 text-sm font-bold border rounded-xl transition-all cursor-pointer flex flex-col items-center gap-1 group ${
                                            isActive
                                                ? 'border-cta bg-cta/10 text-cta shadow-sm ring-2 ring-cta/5'
                                                : 'border-secondary/10 hover:border-cta/40 hover:bg-cta/5 text-text-light/60 dark:text-text-dark/40'
                                        }`}
                                    >
                                        <span className={isActive ? 'text-cta' : 'group-hover:text-cta transition-colors'}>智谱 {m.label}</span>
                                        <span className={`text-[10px] font-normal ${isActive ? 'text-cta/60' : 'text-text-light/30'}`}>{m.sub}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-[10px] text-text-light/30 dark:text-text-dark/30 italic mt-2">
                            选择内置模型将优先使用系统预设的高吞吐量节点。
                        </p>
                    </div>

                    {/* Custom configuration */}
                    <div className="space-y-5 pt-5 border-t border-secondary/5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-text-light/40 dark:text-text-dark/40 block">
                            自定义接口配置
                        </label>

                        <div className="space-y-4">
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-text-light/40 dark:text-text-dark/40 block mb-2">
                                    API Base URL
                                </span>
                                <input
                                    type="text"
                                    value={settings.base_url}
                                    onChange={e => setSettings({ ...settings, base_url: e.target.value })}
                                    placeholder="例如: https://api.deepseek.com/v1"
                                    className={inputClass}
                                />
                            </div>

                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-text-light/40 dark:text-text-dark/40 block mb-2">
                                    API Key
                                </span>
                                <input
                                    type="password"
                                    value={settings.api_key}
                                    onChange={e => setSettings({ ...settings, api_key: e.target.value })}
                                    placeholder="输入您的自定义密钥..."
                                    className={inputClass}
                                />
                            </div>

                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-text-light/40 dark:text-text-dark/40 block mb-2">
                                    Model Name
                                </span>
                                <input
                                    type="text"
                                    value={settings.model_name}
                                    onChange={e => setSettings({ ...settings, model_name: e.target.value })}
                                    placeholder="例如: deepseek-chat"
                                    className={inputClass}
                                />
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-secondary/5 bg-secondary/5 dark:bg-secondary/10 flex items-center justify-between gap-4">
                    <button
                        onClick={() => setSettings(DEFAULT_API_SETTINGS)}
                        className="px-4 py-2 text-[12px] font-bold text-text-light/30 hover:text-cta transition-colors cursor-pointer uppercase tracking-wider"
                    >
                        恢复默认
                    </button>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-5 py-2 text-sm font-bold text-text-light/60 dark:text-text-dark/60 hover:text-text-light dark:hover:text-text-dark bg-secondary/5 border border-secondary/10 rounded-xl transition-all cursor-pointer"
                        >
                            取消
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-6 py-2 text-sm font-bold bg-cta text-white shadow-lg shadow-cta/20 hover:bg-cta/90 hover:scale-[1.02] active:scale-[0.98] rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                        >
                            <Save size={16} /> 保存配置
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
