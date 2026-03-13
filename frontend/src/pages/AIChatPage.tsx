import React, { useState, useRef, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
    Send, Paperclip, Image as ImageIcon, Brain, Sparkles, Loader2,
    ChevronDown, ChevronUp, Wrench, Download, X, FileArchive
} from 'lucide-react';
import { api } from '../api/api';
import type { ChatMessage, Modification } from '../api/api';
import { loadApiSettings } from '../api/apiSettings';
import { usePresetParser } from '../features/diagnosis/usePresetParser';
import type { PresetSelection } from '../features/diagnosis/usePresetParser';
import { ParameterDiffViewer } from '../features/diagnosis/ParameterDiffViewer';
import { ApiSettingsModal } from '../features/diagnosis/ApiSettingsModal';
import { Settings } from 'lucide-react';

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
            <div className="flex justify-end gap-3">
                <div className="max-w-[75%] space-y-2">
                    {msg.imagePreviewUrl && (
                        <img
                            src={msg.imagePreviewUrl}
                            alt="uploaded"
                            className="rounded-xl max-h-48 object-cover w-full border border-secondary/20"
                        />
                    )}
                    <div className="bg-cta text-white px-4 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex gap-3 items-start">
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-cta/10 border border-cta/20 flex items-center justify-center shrink-0 mt-1">
                <Sparkles size={14} className="text-cta" />
            </div>

            <div className="flex-1 min-w-0 space-y-3">
                {/* Thinking block */}
                {msg.thought && (
                    <div className="rounded-xl border border-secondary/10 bg-secondary/5 overflow-hidden">
                        <button
                            onClick={() => setThoughtOpen(!thoughtOpen)}
                            className="sticky top-0 z-10 w-full flex items-center justify-between px-4 py-2 bg-secondary/10 backdrop-blur-md hover:bg-secondary/20 transition-colors group"
                        >
                            <div className="flex items-center gap-2 text-text-light/50 group-hover:text-cta transition-colors">
                                <Brain size={13} className="text-cta" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">思考过程</span>
                            </div>
                            {thoughtOpen ? <ChevronUp size={13} className="text-text-light/30" /> : <ChevronDown size={13} className="text-text-light/30" />}
                        </button>
                        {thoughtOpen && (
                            <div className="px-4 py-3 text-[13px] leading-relaxed text-text-light/40 italic whitespace-pre-wrap border-l-2 border-cta/10 ml-4 my-2 mr-4">
                                {msg.thought}
                                {msg.isStreaming && !msg.content && <span className="inline-block ml-1 w-1.5 h-3 bg-cta/30 animate-pulse" />}
                            </div>
                        )}
                    </div>
                )}

                {/* Main content */}
                {msg.content && (
                    <div className={`text-sm leading-relaxed text-text-light/80 dark:text-text-dark/80 whitespace-pre-wrap ${msg.isStreaming ? '' : ''}`}>
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
                                return <pre key={idx} className="bg-secondary/10 border border-secondary/20 rounded-lg p-3 text-xs overflow-x-auto my-2"><code>{code}</code></pre>;
                            }
                            return <p key={idx} className="my-1">{block}</p>;
                        })}
                        {msg.isStreaming && <span className="inline-block ml-1 w-1.5 h-3 bg-cta/30 animate-pulse" />}
                    </div>
                )}

                {/* Parameter modifications */}
                {msg.modifications && msg.modifications.length > 0 && (
                    <div className="mt-4 rounded-xl border border-cta/20 bg-cta/5 overflow-hidden">
                        <div className="px-4 py-2 border-b border-cta/10 flex items-center gap-2">
                            <Wrench size={13} className="text-cta" />
                            <span className="text-[11px] font-bold uppercase tracking-widest text-cta">参数修改建议</span>
                        </div>
                        <div className="p-4">
                            <ParameterDiffViewer modifications={msg.modifications} />
                        </div>
                    </div>
                )}

                {/* Action buttons */}
                {!msg.isStreaming && (
                    <div className="flex gap-2 flex-wrap pt-1">
                        {hasPreset && (
                            <button
                                onClick={() => onRequestModifications(msg.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-secondary/20 text-text-light/60 hover:text-cta hover:border-cta/30 hover:bg-cta/5 transition-all"
                            >
                                <Wrench size={12} />
                                帮我修改预设参数
                            </button>
                        )}
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
    const [presetSelection, setPresetSelection] = useState<PresetSelection | null>(null);
    const [presetFileName, setPresetFileName] = useState<string | null>(null);
    const [modifications, setModifications] = useState<Modification[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [showDiffPanel, setShowDiffPanel] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const { parsePresetFile, isParsing: isParsingPreset } = usePresetParser();

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    // ─── Auto-resize textarea ─────────────────────────────────────────────
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
        }
    }, [input]);

    // ─── Preset file handler ──────────────────────────────────────────────
    const handlePresetFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPresetFileName(file.name);
        const result = await parsePresetFile(file);
        if (result) {
            const printer = result.printers[0] || null;
            const process = result.processes[0] || null;
            const filament = result.filaments[0] ? [result.filaments[0]] : [];
            setPresetSelection({ printer, process, filaments: filament, defectFilaments: [] });
        } else {
            // parsePresetFile already updates bundle state; access the updated bundle if needed
            setPresetFileName(null);
        }
        e.target.value = '';
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
        if (!text.trim() && !pendingImage) return;
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

        // Build history for API (exclude streaming placeholder)
        const history: ChatMessage[] = [...messages, userMsg]
            .filter(m => !m.isStreaming)
            .map(m => ({ role: m.role, content: m.content }));

        const presetData = presetSelection ? {
            printer: presetSelection.printer?.data || {},
            process: presetSelection.process?.data || {},
            filament: presetSelection.filaments.map(f => f.data),
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
    }, [messages, pendingImage, presetSelection, isStreaming]);

    // ─── Request modifications for a specific message ─────────────────────
    const handleRequestModifications = useCallback((msgId: string) => {
        const msg = messages.find(m => m.id === msgId);
        if (!msg) return;
        sendMessage('请基于之前的回答，提供具体的预设参数修改建议（帮我修改预设参数）', true);
    }, [messages, sendMessage]);

    // ─── Download preset ──────────────────────────────────────────────────
    const handleDownloadPresets = async () => {
        if (!presetSelection || modifications.length === 0) return;

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

        [presetSelection.printer, presetSelection.process, ...presetSelection.filaments].forEach(p => {
            if (!p) return;
            const result = applyMods(p.data as Record<string, unknown>, p.name);
            if (result) zip.file(`${result.name}.json`, JSON.stringify(result.data, null, 2));
        });

        if (Object.keys(zip.files).length === 0) { alert('没有需要修改的预设参数'); return; }
        const blob = await zip.generateAsync({ type: 'blob' });
        saveAs(blob, 'fixed_presets.zip');
    };

    // ─── Keyboard handler ─────────────────────────────────────────────────
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    const hasPreset = !!presetSelection;

    return (
        <div className="-m-8 h-[calc(100vh-0px)] flex overflow-hidden">
            {/* Hidden inputs */}
            <input ref={fileInputRef} type="file" accept=".bbscfg,.orca_printer,.zip" className="hidden" onChange={handlePresetFile} />
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />

            {/* ─── Chat Area ─── */}
            <div className="flex-1 flex flex-col bg-background-light dark:bg-background-dark relative overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-secondary/10 flex items-center justify-between shrink-0 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm">
                    <div>
                        <h1 className="text-lg font-heading font-bold text-text-light dark:text-text-dark flex items-center gap-2">
                            <Sparkles size={20} className="text-cta" />
                            AI 答疑
                        </h1>
                        <p className="text-xs text-text-light/40 dark:text-text-dark/40">3D 打印参数优化 & 缺陷诊断助手</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {presetFileName && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cta/10 border border-cta/20">
                                <FileArchive size={14} className="text-cta" />
                                <span className="text-xs text-cta font-medium max-w-[140px] truncate">{presetFileName}</span>
                                <button onClick={() => { setPresetSelection(null); setPresetFileName(null); }} className="text-cta/60 hover:text-cta">
                                    <X size={12} />
                                </button>
                            </div>
                        )}
                        {modifications.length > 0 && (
                            <button
                                onClick={() => setShowDiffPanel(!showDiffPanel)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cta/10 border border-cta/20 text-cta text-xs font-semibold hover:bg-cta/20 transition-colors"
                            >
                                <Wrench size={14} />
                                参数建议 ({modifications.length})
                            </button>
                        )}
                        <button onClick={() => setIsSettingsOpen(true)} className="p-2 rounded-lg text-text-light/40 hover:text-cta hover:bg-secondary/10 transition-colors">
                            <Settings size={18} />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar">
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

                {/* Input bar */}
                <div className="px-6 py-4 border-t border-secondary/10 shrink-0 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm">
                    {/* Pending image preview */}
                    {pendingImage && (
                        <div className="mb-3 flex items-start gap-2">
                            <div className="relative">
                                <img src={pendingImage.previewUrl} alt="preview" className="h-16 w-16 rounded-lg object-cover border border-secondary/20" />
                                <button
                                    onClick={() => setPendingImage(null)}
                                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center"
                                >
                                    <X size={10} />
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3 items-end">
                        <div className="flex-1 bg-secondary/5 border border-secondary/20 rounded-2xl flex flex-col overflow-hidden focus-within:border-cta/40 transition-colors">
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="输入问题... (Shift+Enter 换行)"
                                disabled={isStreaming}
                                rows={1}
                                className="flex-1 bg-transparent px-4 pt-3 pb-2 text-sm text-text-light dark:text-text-dark placeholder-text-light/30 dark:placeholder-text-dark/30 resize-none outline-none disabled:opacity-50"
                                style={{ minHeight: '46px', maxHeight: '180px' }}
                            />
                            <div className="flex items-center gap-1 px-2 pb-2">
                                <button
                                    onClick={() => imageInputRef.current?.click()}
                                    disabled={isStreaming}
                                    className="p-1.5 rounded-lg text-text-light/40 hover:text-cta hover:bg-cta/10 transition-colors disabled:opacity-30"
                                    title="上传图片"
                                >
                                    <ImageIcon size={16} />
                                </button>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isStreaming || isParsingPreset}
                                    className="p-1.5 rounded-lg text-text-light/40 hover:text-cta hover:bg-cta/10 transition-colors disabled:opacity-30"
                                    title="上传预设文件"
                                >
                                    {isParsingPreset ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={() => sendMessage(input)}
                            disabled={isStreaming || (!input.trim() && !pendingImage)}
                            className="bg-cta text-white p-3 rounded-2xl hover:bg-cta/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0 shadow-lg shadow-cta/20"
                        >
                            {isStreaming ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* ─── Right Panel: Modifications & Download ─── */}
            {showDiffPanel && modifications.length > 0 && (
                <div className="w-[360px] shrink-0 border-l border-secondary/10 flex flex-col bg-background-light dark:bg-background-dark overflow-hidden">
                    <div className="px-5 py-4 border-b border-secondary/10 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            <Wrench size={16} className="text-cta" />
                            <span className="text-sm font-bold text-text-light dark:text-text-dark">参数修改建议</span>
                        </div>
                        <button onClick={() => setShowDiffPanel(false)} className="text-text-light/40 hover:text-text-light transition-colors">
                            <X size={16} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        <ParameterDiffViewer modifications={modifications} />
                    </div>

                    <div className="p-4 border-t border-secondary/10 space-y-2 shrink-0">
                        <button
                            onClick={handleDownloadPresets}
                            disabled={!hasPreset}
                            className="btn-cta w-full justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Download size={16} />
                            下载修复后的预设包
                        </button>
                        {!hasPreset && (
                            <p className="text-center text-xs text-text-light/40">请先上传预设文件以启用下载</p>
                        )}
                    </div>
                </div>
            )}

            <ApiSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                onSave={() => setIsSettingsOpen(false)}
            />
        </div>
    );
};
