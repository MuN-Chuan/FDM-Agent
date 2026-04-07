import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, ChevronDown, Eye, EyeOff, Loader2, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { api } from '../../../api/api';
import type { ProviderConfig, ProviderModel } from '../../../api/api';
import { useI18n } from '../../../i18n/I18nProvider';

interface DeveloperModelConfigPanelProps {
    isAuthenticated: boolean;
}

export const DeveloperModelConfigPanel: React.FC<DeveloperModelConfigPanelProps> = ({ isAuthenticated }) => {
    useI18n();
    const [providers, setProviders] = useState<Record<string, ProviderConfig>>({});
    const [loading, setLoading] = useState(false);
    const [detecting, setDetecting] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [showAddProvider, setShowAddProvider] = useState(false);
    const [newProvider, setNewProvider] = useState<ProviderConfig>({
        name: '',
        base_url: '',
        api_key: '',
        default_model: '',
        supports_vision: false,
        enabled: true,
        enabled_for_users: false,
        models: []
    });

    useEffect(() => {
        if (isAuthenticated) {
            void loadProviders();
        }
    }, [isAuthenticated]);

    const loadProviders = async () => {
        try {
            setLoading(true);
            setError('');
            const data = await api.getProviders();
            setProviders(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load providers');
        } finally {
            setLoading(false);
        }
    };

    const handleDetectModels = async (providerId: string) => {
        try {
            setDetecting(providerId);
            setError('');
            const result = await api.detectProviderModels(providerId);
            setProviders(prev => {
                const existingModels = prev[providerId].models || [];
                
                const detectedModels: ProviderModel[] = result.models.map((id: string) => {
                    const existing = existingModels.find((m: ProviderModel) => m.id === id);
                    return {
                        id,
                        enabled_for_users: existing ? existing.enabled_for_users : false
                    };
                });
                
                const manuallyAddedModels = existingModels.filter(
                    (m: ProviderModel) => !result.models.includes(m.id)
                );
                
                const mergedModels = [...manuallyAddedModels, ...detectedModels];
                
                return {
                    ...prev,
                    [providerId]: {
                        ...prev[providerId],
                        models: mergedModels,
                        default_model: result.models[0] || prev[providerId].default_model
                    }
                };
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to detect models');
        } finally {
            setDetecting(null);
        }
    };

    const handleToggleForUsers = async (providerId: string, enabledForUsers: boolean) => {
        try {
            await api.toggleProviderForUsers(providerId, enabledForUsers);
            setProviders(prev => ({
                ...prev,
                [providerId]: { ...prev[providerId], enabled_for_users: enabledForUsers }
            }));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to toggle provider');
        }
    };

    const handleSaveProvider = async (providerId: string, config: ProviderConfig) => {
        try {
            await api.updateProvider(providerId, config);
            setProviders(prev => ({
                ...prev,
                [providerId]: config
            }));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save provider');
        }
    };

    const handleToggleModelForUsers = async (providerId: string, modelId: string, enabledForUsers: boolean) => {
        try {
            try {
                await api.toggleModelForUsers(providerId, modelId, enabledForUsers);
            } catch (err) {
                if (err instanceof Error && err.message === 'Failed to toggle model') {
                    const currentConfig = providers[providerId];
                    if (currentConfig && currentConfig.models.some((m: ProviderModel) => m.id === modelId)) {
                        await api.updateProvider(providerId, currentConfig);
                        await api.toggleModelForUsers(providerId, modelId, enabledForUsers);
                    } else {
                        throw err;
                    }
                } else {
                    throw err;
                }
            }
            setProviders(prev => ({
                ...prev,
                [providerId]: {
                    ...prev[providerId],
                    models: prev[providerId].models.map((m: ProviderModel) =>
                        m.id === modelId ? { ...m, enabled_for_users: enabledForUsers } : m
                    )
                }
            }));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to toggle model');
        }
    };

    const handleAddProvider = async () => {
        if (!newProvider.name || !newProvider.base_url || !newProvider.api_key) {
            setError('Please fill in all required fields');
            return;
        }
        try {
            const providerId = newProvider.name.toLowerCase().replace(/\s+/g, '-');
            await api.addProvider({
                ...newProvider,
                name: newProvider.name
            });
            setProviders(prev => ({
                ...prev,
                [providerId]: { ...newProvider }
            }));
            setShowAddProvider(false);
            setNewProvider({
                name: '',
                base_url: '',
                api_key: '',
                default_model: '',
                supports_vision: false,
                enabled: true,
                enabled_for_users: false,
                models: []
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add provider');
        }
    };

    const handleDeleteProvider = async (providerId: string) => {
        try {
            await api.deleteProvider(providerId);
            setProviders(prev => {
                const next = { ...prev };
                delete next[providerId];
                return next;
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete provider');
        }
    };

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-[rgba(191,202,186,0.35)] overflow-hidden">
            <div className="px-6 py-4 border-b border-[rgba(191,202,186,0.35)] bg-[var(--color-surface-container-lowest)]">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-[var(--color-on-surface)]">AI 模型配置</h2>
                    <button
                        onClick={() => void loadProviders()}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container-high)] rounded-lg transition-colors"
                        disabled={loading}
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        刷新
                    </button>
                </div>
            </div>

            {error && (
                <div className="mx-6 mt-4 flex items-start gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            <div className="p-6">
                <div className="mb-4">
                    <p className="text-sm text-[var(--color-on-surface-variant)]">
                        配置 AI 模型供应商。勾选「显示给用户」的供应商，其模型将出现在普通用户的模型选择中。
                    </p>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 size={24} className="animate-spin text-[var(--color-primary)]" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        {!showAddProvider && (
                            <button
                                onClick={() => setShowAddProvider(true)}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-container)] transition-colors"
                            >
                                <Plus size={16} />
                                添加供应商
                            </button>
                        )}

                        {showAddProvider && (
                            <AddProviderForm
                                config={newProvider}
                                onChange={setNewProvider}
                                onSave={() => void handleAddProvider()}
                                onCancel={() => setShowAddProvider(false)}
                            />
                        )}

                        {Object.entries(providers).map(([providerId, config]) => (
                            <ProviderCard
                                key={providerId}
                                providerId={providerId}
                                config={config}
                                isDetecting={detecting === providerId}
                                onDetect={() => void handleDetectModels(providerId)}
                                onDelete={() => void handleDeleteProvider(providerId)}
                                onToggleForUsers={(enabled) => void handleToggleForUsers(providerId, enabled)}
                                onToggleModel={(modelId, enabled) => void handleToggleModelForUsers(providerId, modelId, enabled)}
                                onSave={(cfg) => void handleSaveProvider(providerId, cfg)}
                            />
                        ))}

                        {Object.keys(providers).length === 0 && !showAddProvider && (
                            <div className="text-center py-8 text-[var(--color-on-surface-variant)]">
                                暂无配置的供应商
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

interface ProviderCardProps {
    providerId: string;
    config: ProviderConfig;
    isDetecting: boolean;
    onDetect: () => void;
    onDelete: () => void;
    onToggleForUsers: (enabled: boolean) => void;
    onToggleModel: (modelId: string, enabled: boolean) => void;
    onSave: (config: ProviderConfig) => void;
}

const ProviderCard: React.FC<ProviderCardProps> = ({
    providerId,
    config,
    isDetecting,
    onDetect,
    onDelete,
    onToggleForUsers,
    onToggleModel,
    onSave
}) => {
    useI18n();
    const [isExpanded, setIsExpanded] = useState(false);
    const [editConfig, setEditConfig] = useState<ProviderConfig>(config);
    const [newModelId, setNewModelId] = useState('');

    useEffect(() => {
        setEditConfig(config);
    }, [config]);

    const handleAddModel = () => {
        if (!newModelId.trim()) return;
        const exists = editConfig.models.some((m: ProviderModel) => m.id === newModelId.trim());
        if (exists) return;
        setEditConfig({
            ...editConfig,
            models: [...editConfig.models, { id: newModelId.trim(), enabled_for_users: false }]
        });
        setNewModelId('');
    };

    const handleRemoveModel = (modelId: string) => {
        setEditConfig({
            ...editConfig,
            models: editConfig.models.filter((m: ProviderModel) => m.id !== modelId)
        });
    };

    return (
        <div className={`border rounded-xl p-4 transition-colors ${config.enabled ? 'border-[rgba(191,202,186,0.35)]' : 'border-red-200 opacity-60'}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[var(--color-secondary-container)] flex items-center justify-center">
                        <span className="text-sm font-bold">{config.name?.[0]?.toUpperCase() || providerId[0].toUpperCase()}</span>
                    </div>
                    <div>
                        <h3 className="font-semibold text-[var(--color-on-surface)]">{config.name}</h3>
                        <p className="text-xs text-[var(--color-on-surface-variant)]">
                            {config.models.length} 个模型 | {config.models.filter((m: ProviderModel) => m.enabled_for_users).length} 个显示给用户
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.enabled_for_users}
                            onChange={(e) => onToggleForUsers(e.target.checked)}
                            className="w-4 h-4 rounded border-[rgba(191,202,186,0.35)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                        />
                        <span className="text-[var(--color-on-surface-variant)]">显示给用户</span>
                    </label>
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-2 hover:bg-[var(--color-surface-container-high)] rounded-lg transition-colors"
                    >
                        <ChevronDown size={16} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    <button
                        onClick={onDetect}
                        disabled={isDetecting || !config.enabled}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-[var(--color-surface-container-high)] hover:bg-[var(--color-surface-container-highest)] rounded-lg transition-colors disabled:opacity-50"
                    >
                        {isDetecting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        检测
                    </button>
                    <button
                        onClick={onDelete}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="mt-4 pt-4 border-t border-[rgba(191,202,186,0.35)] space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium text-[var(--color-on-surface-variant)] block mb-1">名称</label>
                            <input
                                type="text"
                                value={editConfig.name}
                                onChange={(e) => setEditConfig({ ...editConfig, name: e.target.value })}
                                className="w-full px-3 py-2 text-sm border border-[rgba(191,202,186,0.35)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-[var(--color-on-surface-variant)] block mb-1">默认模型</label>
                            <input
                                type="text"
                                value={editConfig.default_model}
                                onChange={(e) => setEditConfig({ ...editConfig, default_model: e.target.value })}
                                className="w-full px-3 py-2 text-sm border border-[rgba(191,202,186,0.35)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-[var(--color-on-surface-variant)] block mb-1">Base URL</label>
                        <input
                            type="text"
                            value={editConfig.base_url}
                            onChange={(e) => setEditConfig({ ...editConfig, base_url: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-[rgba(191,202,186,0.35)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-[var(--color-on-surface-variant)] block mb-1">API Key</label>
                        <input
                            type="password"
                            value={editConfig.api_key}
                            onChange={(e) => setEditConfig({ ...editConfig, api_key: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-[rgba(191,202,186,0.35)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-[var(--color-on-surface-variant)] block mb-1">
                            模型列表 ({editConfig.models.filter((m: ProviderModel) => m.enabled_for_users).length} / {editConfig.models.length} 已启用)
                        </label>
                        <div className="flex gap-2 mb-2">
                            <input
                                type="text"
                                value={newModelId}
                                onChange={(e) => setNewModelId(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddModel()}
                                placeholder="输入模型 ID，如 openai/gpt-4"
                                className="flex-1 px-3 py-2 text-sm border border-[rgba(191,202,186,0.35)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            />
                            <button
                                onClick={handleAddModel}
                                disabled={!newModelId.trim()}
                                className="px-3 py-2 text-sm font-medium bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-container)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                添加
                            </button>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto border border-[rgba(191,202,186,0.35)] rounded-lg p-3">
                            {(editConfig.models || []).map((model: ProviderModel) => (
                                <div key={model.id} className="flex items-center justify-between gap-3 p-2 bg-[var(--color-surface-container-lowest)] rounded-lg">
                                    <div className="flex-1 min-w-0">
                                        <span className="text-sm font-medium text-[var(--color-on-surface)] truncate block">
                                            {model.id}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => onToggleModel(model.id, !model.enabled_for_users)}
                                            className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                                                model.enabled_for_users
                                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                            }`}
                                            title={model.enabled_for_users ? '点击隐藏' : '点击显示'}
                                        >
                                            {model.enabled_for_users ? <Eye size={16} /> : <EyeOff size={16} />}
                                        </button>
                                        <button
                                            onClick={() => handleRemoveModel(model.id)}
                                            className="p-1.5 rounded-lg transition-colors flex-shrink-0 text-red-500 hover:bg-red-50"
                                            title="删除模型"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {(!editConfig.models || editConfig.models.length === 0) && (
                                <p className="text-xs text-[var(--color-on-surface-variant)] text-center py-2">
                                    输入模型 ID 点击「添加」手动添加，或点击「检测」自动获取
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={editConfig.supports_vision}
                                onChange={(e) => setEditConfig({ ...editConfig, supports_vision: e.target.checked })}
                                className="w-4 h-4 rounded border-[rgba(191,202,186,0.35)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                            />
                            支持视觉
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={editConfig.enabled}
                                onChange={(e) => setEditConfig({ ...editConfig, enabled: e.target.checked })}
                                className="w-4 h-4 rounded border-[rgba(191,202,186,0.35)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                            />
                            启用
                        </label>
                    </div>
                    <button
                        onClick={() => onSave(editConfig)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-container)] transition-colors"
                    >
                        <Check size={14} />
                        保存更改
                    </button>
                </div>
            )}
        </div>
    );
};

interface AddProviderFormProps {
    config: ProviderConfig;
    onChange: (config: ProviderConfig) => void;
    onSave: () => void;
    onCancel: () => void;
}

const AddProviderForm: React.FC<AddProviderFormProps> = ({
    config,
    onChange,
    onSave,
    onCancel
}) => {
    return (
        <div className="border-2 border-dashed border-[var(--color-primary)] rounded-xl p-4 bg-[var(--color-primary)]/5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-[var(--color-on-surface)]">添加供应商</h3>
                <button onClick={onCancel} className="p-1 hover:bg-[var(--color-surface-container-high)] rounded-lg">
                    <X size={16} />
                </button>
            </div>
            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs font-medium text-[var(--color-on-surface-variant)] block mb-1">名称 *</label>
                        <input
                            type="text"
                            value={config.name}
                            onChange={(e) => onChange({ ...config, name: e.target.value })}
                            placeholder="Zhipu AI"
                            className="w-full px-3 py-2 text-sm border border-[rgba(191,202,186,0.35)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-[var(--color-on-surface-variant)] block mb-1">默认模型</label>
                        <input
                            type="text"
                            value={config.default_model}
                            onChange={(e) => onChange({ ...config, default_model: e.target.value })}
                            placeholder="glm-4.7"
                            className="w-full px-3 py-2 text-sm border border-[rgba(191,202,186,0.35)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                        />
                    </div>
                </div>
                <div>
                    <label className="text-xs font-medium text-[var(--color-on-surface-variant)] block mb-1">Base URL *</label>
                    <input
                        type="text"
                        value={config.base_url}
                        onChange={(e) => onChange({ ...config, base_url: e.target.value })}
                        placeholder="https://api.example.com/v1"
                        className="w-full px-3 py-2 text-sm border border-[rgba(191,202,186,0.35)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                </div>
                <div>
                    <label className="text-xs font-medium text-[var(--color-on-surface-variant)] block mb-1">API Key *</label>
                    <input
                        type="password"
                        value={config.api_key}
                        onChange={(e) => onChange({ ...config, api_key: e.target.value })}
                        placeholder="sk-..."
                        className="w-full px-3 py-2 text-sm border border-[rgba(191,202,186,0.35)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    />
                </div>
                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={config.supports_vision}
                            onChange={(e) => onChange({ ...config, supports_vision: e.target.checked })}
                            className="w-4 h-4 rounded border-[rgba(191,202,186,0.35)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                        />
                        支持视觉
                    </label>
                </div>
                <div className="flex gap-2 pt-2">
                    <button
                        onClick={onSave}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-container)] transition-colors"
                    >
                        <Check size={14} />
                        添加
                    </button>
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium bg-[var(--color-surface-container-high)] text-[var(--color-on-surface-variant)] rounded-lg hover:bg-[var(--color-surface-container-highest)] transition-colors"
                    >
                        取消
                    </button>
                </div>
            </div>
        </div>
    );
};
