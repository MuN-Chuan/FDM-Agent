import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
    Send, Paperclip, Image as ImageIcon, Brain, Sparkles, Loader2,
    ChevronDown, ChevronUp, Wrench, Download, X, FileArchive, AlertTriangle, Settings
} from 'lucide-react';
import { api } from '../api/api';
import type { ChatMessage, Modification } from '../api/api';
import { loadApiSettings } from '../api/apiSettings';
import { usePresetParser } from '../features/diagnosis/usePresetParser';
import { ParameterDiffViewer } from '../features/diagnosis/ParameterDiffViewer';
import { ApiSettingsModal } from '../features/diagnosis/ApiSettingsModal';
import { PresetSelectionModal } from '../features/diagnosis/PresetSelectionModal';

// ─── Rename Config ─────────────────────────────────────────────────────────
const RENAME_CONFIG = { prefix: 'fix_', suffix: '' };
const applyRename = (name: string) => `${RENAME_CONFIG.prefix}${name}${RENAME_CONFIG.suffix}`;

// ─── Types ──────────────────────────────────────────────────────────────────
interface UIMessage extends ChatMessage {
    id: string;
    thought?: string;
    modifications?: Modification[];
    isStreaming?: boolean;
    imagePreviewUrl?: string;
}

// ─── Message Bubble ──────────────────────────────────────────────────────────
const MessageBubble: React.FC<{
    msg: UIMessage;
    onRequestModifications: (msgId: string) => void;
    hasPreset: boolean;
}> = ({ msg, onRequestModifications, hasPreset }) => {
    const [thoughtOpen, setThoughtOpen] = useState(true);
    const isUser = msg.role === 'user';

    if (isUser) {
        return (
            <div className="flex justify-end gap-3 px-4 sm:px-6">
                <div className="max-w-[75%] space-y-2">
                    {msg.imagePreviewUrl && (
                        <div className="rounded-xl overflow-hidden border border-secondary/20 shadow-sm">
                            <img
                                src={msg.imagePreviewUrl}
                                alt="uploaded"
                                className="max-h-60 object-contain w-full bg-secondary/5"
                            />
                        </div>
                    )}
                    <div className="bg-cta text-white px-5 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed whitespace-pre-wrap shadow-md">
                        {msg.content}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex gap-4 items-start px-4 sm:px-6">
            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-cta/10 border border-cta/20 flex items-center justify-center shrink-0 mt-1 shadow-sm">
                <Sparkles size={16} className="text-cta" />
            </div>

            <div className="flex-1 min-w-0 space-y-3">
                {/* Thinking block */}
                {msg.thought && (
                    <div className="rounded-xl border border-secondary/10 bg-secondary/5 overflow-hidden shadow-sm">
                        <button
                            onClick={() => setThoughtOpen(!thoughtOpen)}
                            className="w-full flex items-center justify-between px-4 py-2 bg-secondary/10 backdrop-blur-md hover:bg-secondary/20 transition-colors group"
                        >
                            <div className="flex items-center gap-2 text-text-light/50 group-hover:text-cta transition-colors">
                                <Brain size={14} className="text-cta" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">思考过程</span>
                            </div>
                            {thoughtOpen ? <ChevronUp size={14} className="text-text-light/30" /> : <ChevronDown size={14} className="text-text-light/30" />}
                        </button>
                        {thoughtOpen && (
                            <div className="px-4 py-3 text-[13px] leading-relaxed text-text-light/50 dark:text-text-dark/50 italic whitespace-pre-wrap border-l-2 border-cta/20 ml-4 my-2 mr-4">
                                {msg.thought}
                                {msg.isStreaming && !msg.content && <span className="inline-block ml-1 w-1.5 h-3 bg-cta/30 animate-pulse" />}
                            </div>
                        )}
                    </div>
                )}

                {/* Main content */}
                {msg.content && (
                    <div className="text-sm leading-relaxed text-text-light/90 dark:text-text-dark/90 whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none">
                        {msg.content.split('\n\n').map((block, idx) => {
                            if (block.startsWith('### ')) return <h3 key={idx} className="text-base font-bold text-cta mt-4 mb-2">{block.replace('### ', '')}</h3>;
                            if (block.startsWith('#### ')) return <h4 key={idx} className="font-semibold text-text-light dark:text-text-dark mt-3 mb-1">{block.replace('#### ', '')}</h4>;
                            if (block.startsWith('- ') || block.startsWith('* ')) return (
                                <ul key={idx} className="list-disc pl-5 space-y-1 my-2">
                                    {block.split('\n').map((li, i) => <li key={i}>{li.replace(/^[-*] /, '')}</li>)}
                                </ul>
                            );
                            if (block.startsWith('```')) {
                                const lines = block.split('\n');
                                const code = lines.slice(1, -1).join('\n');
                                return <pre key={idx} className="bg-secondary/10 border border-secondary/20 rounded-lg p-3 text-xs overflow-x-auto my-3 font-mono"><code>{code}</code></pre>;
                            }
                            return <p key={idx} className="my-2">{block}</p>;
                        })}
                        {msg.isStreaming && <span className="inline-block ml-1 w-1.5 h-4 bg-cta/40 animate-pulse align-middle" />}
                    </div>
                )}

                {/* Parameter modifications */}
                {msg.modifications && msg.modifications.length > 0 && (
                    <div className="mt-4 rounded-xl border border-cta/30 bg-cta/5 overflow-hidden shadow-sm">
                        <div className="px-4 py-2 border-b border-cta/10 flex items-center gap-2 bg-cta/10">
                            <Wrench size={14} className="text-cta" />
                            <span className="text-[11px] font-bold uppercase tracking-widest text-cta">参数修改建议</span>
                        </div>
                        <div className="p-4">
                            <ParameterDiffViewer modifications={msg.modifications} />
                        </div>
                    </div>
                )}

                {/* Action buttons */}
                {!msg.isStreaming && (
                    <div className="flex gap-2 flex-wrap pt-2">
                        {hasPreset && (
                            <button
                                onClick={() => onRequestModifications(msg.id)}
                                className="flex items-center gap-2 px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg border border-secondary/20 text-text-light/60 hover:text-cta hover:border-cta/40 hover:bg-cta/5 transition-all shadow-sm"
                            >
                                <Wrench size={13} />
                                帮我修改预设参数
                            </button>
                        )}
                        <button className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg border border-secondary/10 text-text-light/30 hover:text-text-light dark:hover:text-text-dark transition-all">
                            复制回答
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export const AIChatPage: React.FC = () => {
    const [messages, setMessages] = useState<UIMessage[]>([{
        id: 'welcome',
        role: 'assistant',
        content: '你好！我是 FDM 3D 打印 AI 顾问。\n\n我可以帮助你：\n- 诊断打印缺陷（拉丝、翘边、层分离等）\n- 优化切片参数\n- 分析你上传的打印图片\n- 根据你的预设给出具体参数建议\n\n你可以上传图片或预设文件，然后直接提问！',
    }]);
    const [input, setInput] = useState('');
    const [pendingImage, setPendingImage] = useState<{ base64: string; previewUrl: string } | null>(null);
    const [presetFileName, setPresetFileName] = useState<string | null>(null);
    const [modifications, setModifications] = useState<Modification[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [showDiffPanel, setShowDiffPanel] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const { parsePresetFile, isParsing: isParsingPreset, bundle, validateSelection, selection, updateSelection } = usePresetParser();

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    // ─── Auto-resize textarea ─────────────────────────────────────────────
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
        }
    }, [input]);

    // ─── Validation ──────────────────────────────────────────────────────
    const presetValidationError = useMemo(() => {
        if (!bundle) return null;
        // Selection is maintained by the hook, but we local-state it too for compatibility
        // Let's rely on hook selection which is synced in handleModalConfirm
        return validateSelection();
    }, [bundle, validateSelection]);

    // ─── Preset file handler ──────────────────────────────────────────────
    const handlePresetFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPresetFileName(file.name);
        const result = await parsePresetFile(file);
        if (result) {
            // Auto open the modal when a bundle is parsed
            setIsModalOpen(true);
        } else {
            setPresetFileName(null);
        }
        e.target.value = '';
    };

    const handleModalConfirm = () => {
        setIsModalOpen(false);
    };

    // ─── Image file handler ────────────────────────────────────────────────
    const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(',')[1];
            setPendingImage({ base64, previewUrl: dataUrl });
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    // ─── Send message ─────────────────────────────────────────────────────
    const sendMessage = useCallback(async (text: string, requestMods = false) => {
        if ((!text.trim() && !pendingImage) || presetValidationError) return;
        if (isStreaming) return;

        const userMsg: UIMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: text,
            imagePreviewUrl: pendingImage?.previewUrl,
        };

        const aiMsgId = `ai-${Date.now()}`;
        const aiMsg: UIMessage = {
            id: aiMsgId,
            role: 'assistant',
            content: '',
            thought: undefined,
            isStreaming: true,
        };

        setMessages(prev => [...prev, userMsg, aiMsg]);
        setInput('');
        const capturedImage = pendingImage;
        setPendingImage(null);
        setIsStreaming(true);

        const history: ChatMessage[] = [...messages, userMsg]
            .filter(m => !m.isStreaming)
            .map(m => ({ role: m.role, content: m.content }));

        const presetData = selection ? {
            printer: selection.printer?.data || {},
            process: selection.process?.data || {},
            filament: selection.filaments.map(f => f.data),
        } : undefined;

        const apiSettings = loadApiSettings();
        let accText = '';
        let accThought = '';

        try {
            await api.chatStream({
                messages: history,
                image_base64: capturedImage?.base64,
                preset_data: presetData,
                api_settings: apiSettings,
                request_modifications: requestMods,
            }, (chunk) => {
                if (chunk.type === 'thought' && chunk.content) {
                    accThought += chunk.content;
                    setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, thought: accThought } : m));
                } else if (chunk.type === 'text' && chunk.content) {
                    accText += chunk.content;
                    const displayText = accText.replace(/```json_modifications[\s\S]*?```/g, '');
                    setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: displayText } : m));
                } else if (chunk.type === 'done') {
                    const mods = (chunk.modifications || []) as Modification[];
                    if (mods.length > 0) {
                        setModifications(mods);
                        setShowDiffPanel(true);
                    }
                    setMessages(prev => prev.map(m =>
                        m.id === aiMsgId ? { ...m, isStreaming: false, modifications: mods.length > 0 ? mods : undefined } : m
                    ));
                    setIsStreaming(false);
                } else if (chunk.type === 'error') {
                    setMessages(prev => prev.map(m =>
                        m.id === aiMsgId ? { ...m, content: `❌ AI 服务异常: ${chunk.message}`, isStreaming: false } : m
                    ));
                    setIsStreaming(false);
                }
            });
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            setMessages(prev => prev.map(m =>
                m.id === aiMsgId ? { ...m, content: `❌ 连接错误: ${errMsg}`, isStreaming: false } : m
            ));
            setIsStreaming(false);
        }
    }, [messages, pendingImage, selection, isStreaming, presetValidationError]);

    const handleRequestModifications = useCallback((msgId: string) => {
        const msg = messages.find(m => m.id === msgId);
        if (!msg) return;
        sendMessage('请基于之前的回答，提供具体的预设参数修改建议（帮我修改预设参数）', true);
    }, [messages, sendMessage]);

    const handleDownloadPresets = async () => {
        if (!selection || modifications.length === 0) return;
        const zip = new JSZip();
        const applyMods = (preset: Record<string, unknown>, name: string) => {
            const newData = JSON.parse(JSON.stringify(preset));
            let hasChanges = false;
            for (const mod of modifications) {
                if (mod.name in newData) { newData[mod.name] = mod.new; hasChanges = true; }
            }
            if (!hasChanges) return null;
            const newName = applyRename(name);
            newData.name = newName;
            if (newData.printer_settings_id) newData.printer_settings_id = applyRename(String(newData.printer_settings_id));
            if (newData.filament_settings_id) newData.filament_settings_id = applyRename(String(newData.filament_settings_id));
            if (newData.print_settings_id) newData.print_settings_id = applyRename(String(newData.print_settings_id));
            return { name: newName, data: newData };
        };
        [selection.printer, selection.process, ...selection.filaments].forEach(p => {
            if (!p) return;
            const result = applyMods(p.data as Record<string, unknown>, p.name);
            if (result) zip.file(`${result.name}.json`, JSON.stringify(result.data, null, 2));
        });
        if (Object.keys(zip.files).length === 0) { alert('没有需要修改的预设参数'); return; }
        const blob = await zip.generateAsync({ type: 'blob' });
        saveAs(blob, 'fixed_presets.zip');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    const hasPreset = !!bundle;

    return (
        <div className="-m-8 h-[calc(100vh-64px)] flex relative bg-background-light dark:bg-background-dark overflow-hidden">
            {/* Hidden inputs */}
            <input ref={fileInputRef} type="file" accept=".bbscfg,.orca_printer,.zip" className="hidden" onChange={handlePresetFile} />
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />

            {/* ─── Chat Area ─── */}
            <div className="flex-1 flex flex-col relative h-full">
                {/* Messages List - Absolute scrollable area */}
                <div className="flex-1 overflow-y-auto pt-8 pb-32 space-y-8 custom-scrollbar relative">
                    {messages.map(msg => (
                        <MessageBubble
                            key={msg.id}
                            msg={msg}
                            onRequestModifications={handleRequestModifications}
                            hasPreset={hasPreset}
                        />
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Sticky Input Area at Bottom */}
                <div className="absolute bottom-0 left-0 right-0 px-6 pb-6 pt-10 bg-gradient-to-t from-background-light dark:from-background-dark via-background-light/95 dark:via-background-dark/95 to-transparent pointer-events-none">
                    <div className="max-w-4xl mx-auto w-full pointer-events-auto">
                        <div className="bg-white dark:bg-secondary/10 border border-secondary/20 rounded-3xl shadow-xl flex flex-col overflow-hidden focus-within:border-cta/40 focus-within:ring-2 focus-within:ring-cta/10 transition-all">
                            
                            {/* Inside Input Preview Area (ChatGPT Style) */}
                            {(pendingImage || presetFileName) && (
                                <div className="px-4 pt-4 flex flex-wrap gap-3">
                                    {pendingImage && (
                                        <div className="relative group">
                                            <img src={pendingImage.previewUrl} alt="preview" className="h-14 w-14 rounded-xl object-cover border border-secondary/20 shadow-sm" />
                                            <button
                                                onClick={() => setPendingImage(null)}
                                                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-secondary-900 dark:bg-white text-white dark:text-secondary-900 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    )}
                                    {presetFileName && (
                                        <div className="relative group flex items-center gap-2 px-3 py-2 bg-cta/10 border border-cta/20 rounded-xl max-w-[200px]">
                                            <FileArchive size={16} className="text-cta shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-cta truncate uppercase tracking-tight">已选预设</p>
                                                <p className="text-xs text-cta/70 truncate font-medium">{presetFileName}</p>
                                            </div>
                                            <div className="flex items-center gap-1.5 ml-1">
                                                <button onClick={() => setIsModalOpen(true)} className="p-1 rounded hover:bg-cta/10 text-cta" title="修改配置">
                                                    <Settings size={14} />
                                                </button>
                                                <button 
                                                    onClick={() => { setPresetFileName(null); updateSelection({ printer: null, process: null, filaments: [], defectFilaments: [] }); }} 
                                                    className="p-1 rounded hover:bg-cta/10 text-cta"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Text Input Row */}
                            <div className="flex items-end gap-2 px-3 py-3">
                                <div className="flex items-center gap-0.5 mb-1.5 ml-1">
                                    <button
                                        onClick={() => imageInputRef.current?.click()}
                                        disabled={isStreaming}
                                        className="p-2 rounded-xl text-text-light/40 hover:text-cta hover:bg-cta/10 transition-colors disabled:opacity-30"
                                        title="上传图片 (JPG, PNG, WebP)"
                                    >
                                        <ImageIcon size={20} />
                                    </button>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isStreaming || isParsingPreset}
                                        className="p-2 rounded-xl text-text-light/40 hover:text-cta hover:bg-cta/10 transition-colors disabled:opacity-30"
                                        title="上传预设文件 (.bbscfg, .orca_printer)"
                                    >
                                        {isParsingPreset ? <Loader2 size={20} className="animate-spin" /> : <Paperclip size={20} />}
                                    </button>
                                </div>

                                <textarea
                                    ref={textareaRef}
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="描述您的问题或上传预设..."
                                    disabled={isStreaming}
                                    rows={1}
                                    className="flex-1 bg-transparent px-2 pt-2.5 pb-2 text-sm text-text-light dark:text-text-dark placeholder-text-light/40 dark:placeholder-text-dark/40 resize-none outline-none disabled:opacity-50 font-body leading-relaxed"
                                    style={{ minHeight: '44px', maxHeight: '180px' }}
                                />

                                <div className="flex items-center gap-2 mb-1 mr-1">
                                    {presetValidationError && (
                                        <div className="p-2 text-amber-500" title={presetValidationError}>
                                            <AlertTriangle size={20} />
                                        </div>
                                    )}
                                    <button
                                        onClick={() => sendMessage(input)}
                                        disabled={isStreaming || (!input.trim() && !pendingImage) || !!presetValidationError}
                                        className="bg-cta text-white p-2.5 rounded-2xl hover:bg-cta/90 transition-all disabled:opacity-20 disabled:cursor-not-allowed shrink-0 shadow-lg shadow-cta/20 flex items-center justify-center"
                                    >
                                        {isStreaming ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <p className="text-[10px] text-center mt-3 text-text-light/30 dark:text-text-dark/30">AI 可能会产生误差，建议在正式打印前检查关键参数。</p>
                    </div>
                </div>
            </div>

            {/* ─── Right Panel: Modifications & Download ─── */}
            {showDiffPanel && modifications.length > 0 && (
                <div className="w-[380px] shrink-0 border-l border-secondary/10 flex flex-col bg-background-light dark:bg-background-dark overflow-hidden shadow-2xl z-20">
                    <div className="px-5 py-4 border-b border-secondary/10 flex items-center justify-between shrink-0 bg-secondary/5">
                        <div className="flex items-center gap-2">
                            <Wrench size={18} className="text-cta" />
                            <span className="text-sm font-bold text-text-light dark:text-text-dark uppercase tracking-wide">参数修改建议</span>
                        </div>
                        <button onClick={() => setShowDiffPanel(false)} className="p-1.5 rounded-lg hover:bg-secondary/10 text-text-light/40 hover:text-text-light transition-colors">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        <ParameterDiffViewer modifications={modifications} />
                    </div>

                    <div className="p-5 border-t border-secondary/10 space-y-3 shrink-0 bg-secondary/5">
                        <button
                            onClick={handleDownloadPresets}
                            disabled={!hasPreset}
                            className="btn-cta w-full justify-center py-3 rounded-2xl shadow-lg shadow-cta/20 disabled:scale-100 disabled:opacity-40"
                        >
                            <Download size={18} />
                            下载修复后的预设包
                        </button>
                        {!hasPreset && (
                            <p className="text-center text-[11px] text-amber-500 font-medium">请先上传预设文件以应用修改</p>
                        )}
                    </div>
                </div>
            )}

            <ApiSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                onSave={() => setIsSettingsOpen(false)}
            />

            <PresetSelectionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onConfirm={handleModalConfirm}
                bundle={bundle}
                selection={selection}
                onUpdateSelection={updateSelection}
                validationError={presetValidationError}
            />
        </div>
    );
};
