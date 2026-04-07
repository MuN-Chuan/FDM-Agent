import React, { useState, useEffect } from 'react';
import { Settings, X, Save, AlertCircle, Loader2 } from 'lucide-react';
import type { ApiSettings } from '../../api/apiSettings';
import { loadApiSettings, saveApiSettings, DEFAULT_API_SETTINGS } from '../../api/apiSettings';
import { api } from '../../api/api';
import type { ProviderConfig, ProviderModel } from '../../api/api';

interface ApiSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (settings: ApiSettings) => void;
}

type TabType = 'official' | 'custom';

export const ApiSettingsModal: React.FC<ApiSettingsModalProps> = ({ isOpen, onClose, onSave }) => {
    const [settings, setSettings] = useState<ApiSettings>(DEFAULT_API_SETTINGS);
    const [providers, setProviders] = useState<Record<string, ProviderConfig>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<TabType>('official');

    useEffect(() => {
        if (isOpen) {
            const loaded = loadApiSettings();
            setSettings(loaded);
            setActiveTab(loaded.is_custom ? 'custom' : 'official');
            void fetchProviders();
        }
    }, [isOpen]);

    const fetchProviders = async () => {
        try {
            setLoading(true);
            setError('');
            const data = await api.getPublicProviders();
            setProviders(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load providers');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const handleOfficialModelSelect = (providerId: string, modelName: string) => {
        setSettings({
            provider_id: providerId,
            model_name: modelName,
            is_custom: false,
            custom_api_key: '',
            custom_base_url: '',
            custom_provider_name: ''
        });
    };

    const handleCustomProviderChange = (field: string, value: string) => {
        setSettings(prev => ({
            ...prev,
            is_custom: true,
            [field]: value
        }));
    };

    const handleSave = () => {
        saveApiSettings(settings);
        onSave(settings);
        onClose();
    };

    const providerEntries = Object.entries(providers);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-background-dark border border-secondary/10 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

                <div className="flex items-center justify-between px-6 py-4 border-b border-secondary/5 bg-secondary/5 dark:bg-secondary/10">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-text-light dark:text-text-dark">
                        <Settings size={20} className="text-cta" />
                        AI 模型设置
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-secondary/10 rounded-full transition-colors text-text-light/40 hover:text-text-light dark:hover:text-text-dark cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">

                    <div className="bg-cta/5 border border-cta/10 p-4 rounded-xl flex gap-3 text-cta text-sm font-medium">
                        <AlertCircle size={18} className="shrink-0 mt-0.5" />
                        <div>
                            选择 AI 模型。模型列表由管理员配置，也可选择自定义输入。
                        </div>
                    </div>

                    <div className="flex gap-2 p-1 bg-secondary/5 rounded-xl">
                        <button
                            onClick={() => setActiveTab('official')}
                            className={`flex-1 px-4 py-2.5 text-sm font-bold rounded-lg transition-all ${
                                activeTab === 'official'
                                    ? 'bg-white dark:bg-background-dark shadow-sm text-cta'
                                    : 'text-text-light/60 dark:text-text-dark/40 hover:text-text-light'
                            }`}
                        >
                            官方模型
                        </button>
                        <button
                            onClick={() => setActiveTab('custom')}
                            className={`flex-1 px-4 py-2.5 text-sm font-bold rounded-lg transition-all ${
                                activeTab === 'custom'
                                    ? 'bg-white dark:bg-background-dark shadow-sm text-cta'
                                    : 'text-text-light/60 dark:text-text-dark/40 hover:text-text-light'
                            }`}
                        >
                            自定义
                        </button>
                    </div>

                    {activeTab === 'official' && (
                        <>
                            {loading && (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 size={24} className="animate-spin text-[var(--color-primary)]" />
                                </div>
                            )}

                            {error && !loading && (
                                <div className="text-center py-8 text-red-600">
                                    <p>{error}</p>
                                    <button
                                        onClick={() => void fetchProviders()}
                                        className="mt-2 text-sm text-cta hover:underline"
                                    >
                                        重试
                                    </button>
                                </div>
                            )}

                            {!loading && !error && providerEntries.length === 0 && (
                                <div className="text-center py-8 text-text-light/50 dark:text-text-dark/50">
                                    暂无可用模型，请联系管理员配置。
                                </div>
                            )}

                            {!loading && !error && providerEntries.length > 0 && (
                                <div className="space-y-6">
                                    {providerEntries.map(([providerId, provider]) => (
                                        <div key={providerId} className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-text-light dark:text-text-dark">{provider.name}</span>
                                                {provider.supports_vision && (
                                                    <span className="text-[9px] px-1.5 py-0.5 bg-cta/10 text-cta rounded">视觉</span>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                {(provider.models || []).map((model: ProviderModel) => {
                                                    const isActive = settings.provider_id === providerId && settings.model_name === model.id && !settings.is_custom;
                                                    return (
                                                        <button
                                                            key={model.id}
                                                            onClick={() => handleOfficialModelSelect(providerId, model.id)}
                                                            className={`px-4 py-3 text-sm border rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                                                                isActive
                                                                    ? 'border-cta bg-cta/10 text-cta shadow-sm ring-2 ring-cta/5'
                                                                    : 'border-secondary/10 hover:border-cta/40 hover:bg-cta/5 text-text-light/60 dark:text-text-dark/40'
                                                            }`}
                                                        >
                                                            <span className="font-medium truncate">{model.id}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {activeTab === 'custom' && (
                        <div className="space-y-5">
                            <p className="text-sm text-text-light/50 dark:text-text-dark/50">
                                使用您自己的 API Key 连接自定义模型供应商。
                            </p>

                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider text-text-light/40 dark:text-text-dark/40 block mb-2">
                                    供应商名称
                                </label>
                                <input
                                    type="text"
                                    value={settings.custom_provider_name || ''}
                                    onChange={(e) => handleCustomProviderChange('custom_provider_name', e.target.value)}
                                    placeholder="例如: OpenRouter, Custom AI"
                                    className="w-full bg-secondary/5 border border-secondary/10 rounded-xl p-3 text-sm focus:outline-none focus:ring-4 focus:ring-cta/10 focus:border-cta/40 transition-all"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider text-text-light/40 dark:text-text-dark/40 block mb-2">
                                    Base URL
                                </label>
                                <input
                                    type="text"
                                    value={settings.custom_base_url || ''}
                                    onChange={(e) => handleCustomProviderChange('custom_base_url', e.target.value)}
                                    placeholder="https://api.example.com/v1"
                                    className="w-full bg-secondary/5 border border-secondary/10 rounded-xl p-3 text-sm focus:outline-none focus:ring-4 focus:ring-cta/10 focus:border-cta/40 transition-all"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider text-text-light/40 dark:text-text-dark/40 block mb-2">
                                    API Key
                                </label>
                                <input
                                    type="password"
                                    value={settings.custom_api_key || ''}
                                    onChange={(e) => handleCustomProviderChange('custom_api_key', e.target.value)}
                                    placeholder="sk-..."
                                    className="w-full bg-secondary/5 border border-secondary/10 rounded-xl p-3 text-sm focus:outline-none focus:ring-4 focus:ring-cta/10 focus:border-cta/40 transition-all"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider text-text-light/40 dark:text-text-dark/40 block mb-2">
                                    模型名称
                                </label>
                                <input
                                    type="text"
                                    value={settings.model_name || ''}
                                    onChange={(e) => handleCustomProviderChange('model_name', e.target.value)}
                                    placeholder="例如: gpt-4o, claude-3-sonnet"
                                    className="w-full bg-secondary/5 border border-secondary/10 rounded-xl p-3 text-sm focus:outline-none focus:ring-4 focus:ring-cta/10 focus:border-cta/40 transition-all"
                                />
                            </div>
                        </div>
                    )}

                </div>

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
