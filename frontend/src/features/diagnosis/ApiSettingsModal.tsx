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

    const inputClass = "w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-slate-100 text-sm font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cta/60 focus:border-cta transition-all";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-800/60">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-slate-100">
                        <Settings size={20} className="text-cta" />
                        AI 服务供应商设置
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-slate-100 cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6 flex-1 overflow-y-auto">

                    <div className="bg-blue-900/40 border border-blue-500/40 p-3 rounded-lg flex gap-3 text-blue-300 text-sm">
                        <AlertCircle size={18} className="shrink-0 mt-0.5" />
                        <div>
                            配置任意兼容 <strong className="text-blue-200">OpenAI API</strong> 标准格式的大型语言模型服务（如智谱、DeepSeek、阿里通义等）。
                        </div>
                    </div>

                    {/* System Default Model Selection */}
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-3">
                            系统默认模型选择（使用服务器内置密钥）
                        </label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {[
                                { id: 'glm-4.7', label: 'GLM-4.7', sub: '推荐 (推荐)' },
                                { id: 'glm-4.6v-flash', label: 'GLM-4.6V-Flash', sub: '极速 (推荐)' },
                            ].map(m => {
                                const isActive = settings.model_name === m.id && !settings.api_key && !settings.base_url;
                                return (
                                    <button
                                        key={m.id}
                                        onClick={() => setSettings({ ...settings, base_url: '', api_key: '', model_name: m.id })}
                                        className={`px-6 py-3 text-sm font-bold border rounded-xl transition-all cursor-pointer flex flex-col items-center gap-1 ${
                                            isActive
                                                ? 'border-cta bg-cta/20 text-cta shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                                                : 'border-slate-600 hover:border-cta/60 hover:text-cta text-slate-300 bg-slate-800'
                                        }`}
                                    >
                                        <span>智谱 {m.label}</span>
                                        <span className={`text-[11px] font-normal ${isActive ? 'text-cta/70' : 'text-slate-500'}`}>{m.sub}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-[11px] text-slate-500 italic">
                            选择后将清空下方自定义配置，使用服务器内置密钥。GLM-4-Flash 和 GLM-4.7 推荐首选。
                        </p>
                    </div>

                    {/* Custom configuration */}
                    <div className="space-y-4 pt-4 border-t border-slate-700">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                            自定义大模型接口（需兼容 OpenAI API）
                        </label>

                        <div>
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                                API Base URL（接口地址）
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
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                                API Key（密钥）
                            </span>
                            <input
                                type="password"
                                value={settings.api_key}
                                onChange={e => setSettings({ ...settings, api_key: e.target.value })}
                                placeholder="输入您的自定义 API Key..."
                                className={inputClass}
                            />
                        </div>

                        <div>
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                                Model Name（模型名称）
                            </span>
                            <input
                                type="text"
                                value={settings.model_name}
                                onChange={e => setSettings({ ...settings, model_name: e.target.value })}
                                placeholder="例如: deepseek-chat 或 glm-4-flash"
                                className={inputClass}
                            />
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-700 bg-slate-800/60 flex items-center justify-between gap-4">
                    <button
                        onClick={() => setSettings(DEFAULT_API_SETTINGS)}
                        className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    >
                        恢复默认值
                    </button>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-bold text-slate-200 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors border border-slate-600 cursor-pointer"
                        >
                            取消
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-5 py-2 text-sm font-bold bg-cta text-white shadow-lg shadow-cta/20 hover:bg-cta/90 rounded-lg transition-all flex items-center gap-2 cursor-pointer"
                        >
                            <Save size={16} /> 保存设置
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
