import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import JSZip from 'jszip';
import {
    Send, Paperclip, Image as ImageIcon, Brain, Sparkles, Loader2,
    ChevronDown, ChevronUp, Wrench, Download, X, FileArchive, AlertTriangle, Settings,
    PencilLine, RotateCcw, Package, FileText, Scan
} from 'lucide-react';
import { api } from '../api/api';
import type { ChatMessage, Modification } from '../api/api';
import { loadApiSettings } from '../api/apiSettings';
import { ParameterDiffViewer } from '../features/diagnosis/ParameterDiffViewer';
import { ApiSettingsModal } from '../features/diagnosis/ApiSettingsModal';
import { PresetSelectionModal } from '../features/diagnosis/PresetSelectionModal';
import { DefectRecognitionModal } from '../features/diagnosis/DefectRecognitionModal';
import { chatStorage } from '../api/chatStorage';
import type { ChatSessionData } from '../api/chatStorage';

// ─── Rename Config ─────────────────────────────────────────────────────────
const RENAME_CONFIG = { prefix: 'fix_', suffix: '' };
const applyRename = (name: string) => `${RENAME_CONFIG.prefix}${name}${RENAME_CONFIG.suffix}`;
// ─── Preset Types ────────────────────────────────────────────────────────
interface RawPreset {
    name: string;
    path: string;
    data: Record<string, any>;
}

interface ParsedBundle {
    format: 'bambu' | 'orca';
    bundleId: string;
    printers: RawPreset[];
    filaments: RawPreset[];
    processes: RawPreset[];
}

interface PresetSelection {
    printer: RawPreset | null;
    process: RawPreset | null;
    filaments: RawPreset[];
    defectFilaments: RawPreset[];
}

// ─── Types ──────────────────────────────────────────────────────────────────
interface UIMessage extends ChatMessage {
    id: string;
    thought?: string;
    modifications?: Modification[];
    isStreaming?: boolean;
    imagePreviewUrl?: string;
    attachedFiles?: { name: string; size: number }[];
    presetName?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const isVisionModel = (modelName: string): boolean => {
    const name = modelName.toLowerCase();
    return name.includes('vision') || name.includes('v-flash') || name.includes('v-plus') || 
           name.includes('gpt-4o') || name.includes('gemini') || name.includes('vl');
};

// ─── Message Bubble ──────────────────────────────────────────────────────────
const MessageBubble: React.FC<{
    msg: UIMessage;
    onRequestModifications: (msgId: string) => void;
    onDownloadPresets: () => void;
    onEdit: (msgId: string, content: string) => void;
    onRegenerate: (msgId: string) => void;
    hasPreset: boolean;
    isLast: boolean;
    editingId: string | null;
    onStartEdit: (id: string, content: string) => void;
    onCancelEdit: () => void;
}> = ({ msg, onRequestModifications, onDownloadPresets, onEdit, onRegenerate, hasPreset, isLast, editingId, onStartEdit, onCancelEdit }) => {
    const [thoughtOpen, setThoughtOpen] = useState(true);
    const hasAutoCollapsedRef = useRef(false);
    const [recommendationOpen, setRecommendationOpen] = useState(true);
    const [tempEditValue, setTempEditValue] = useState(msg.content);
    const isUser = msg.role === 'user';
    const isEditing = editingId === msg.id;

    useEffect(() => {
        // Auto-collapse thought when content starts flowing
        if (msg.content && !hasAutoCollapsedRef.current) {
            setThoughtOpen(false);
            hasAutoCollapsedRef.current = true;
        }
    }, [msg.content]);

    if (isUser) {
        return (
            <div className="flex flex-col items-end gap-2 group/msg">
                <div className="flex justify-end gap-3 w-full">
                    <div className="max-w-[85%] space-y-2 flex flex-col items-end">
                        {/* Inline Context Attachments Container */}
                        {(msg.imagePreviewUrl || (msg.attachedFiles && msg.attachedFiles.length > 0) || msg.presetName) && (
                            <div className="flex flex-wrap gap-2 justify-end mb-1 w-full">
                                {msg.imagePreviewUrl && (
                                    <div className="rounded-xl overflow-hidden border border-secondary/20 shadow-sm max-w-sm">
                                        <img
                                            src={msg.imagePreviewUrl}
                                            alt="uploaded"
                                            className="max-h-60 object-contain w-full bg-secondary/5"
                                        />
                                    </div>
                                )}
                                {msg.presetName && (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-cta/10 border border-cta/20 text-cta rounded-xl shadow-sm text-xs">
                                        <FileArchive size={14} className="shrink-0" />
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-bold truncate max-w-[150px]">{msg.presetName}</span>
                                            <span className="text-[10px] opacity-70">预设配置</span>
                                        </div>
                                    </div>
                                )}
                                {msg.attachedFiles?.map((file, idx) => (
                                    <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-secondary/10 border border-secondary/20 text-text-light dark:text-text-dark rounded-xl shadow-sm text-xs">
                                        <FileText size={14} className="shrink-0 opacity-70" />
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-medium truncate max-w-[150px]">{file.name}</span>
                                            <span className="text-[10px] opacity-60">{formatFileSize(file.size)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {!isEditing ? (
                            <div className="bg-cta text-white px-5 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed whitespace-pre-wrap shadow-md relative group max-w-full">
                                {msg.content}
                            </div>
                        ) : (
                            <div className="w-full min-w-[300px] bg-white dark:bg-secondary/20 border border-cta rounded-2xl p-3 shadow-xl">
                                <textarea
                                    className="w-full bg-transparent text-sm text-text-light dark:text-text-dark outline-none resize-none min-h-[80px]"
                                    value={tempEditValue}
                                    onChange={(e) => setTempEditValue(e.target.value)}
                                    autoFocus
                                />
                                <div className="flex justify-end gap-2 mt-2">
                                    <button 
                                        onClick={onCancelEdit}
                                        className="px-3 py-1.5 text-xs font-bold text-text-light/40 hover:text-text-light transition-colors"
                                    >
                                        取消
                                    </button>
                                    <button 
                                        onClick={() => onEdit(msg.id, tempEditValue)}
                                        className="px-4 py-1.5 bg-cta text-white text-xs font-bold rounded-lg shadow-sm hover:bg-cta-hover transition-all"
                                    >
                                        发送并重试
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                {!isEditing && (
                    <div className="flex gap-2 opacity-0 group-hover/msg:opacity-100 transition-opacity mr-2">
                        <button 
                            onClick={() => { onStartEdit(msg.id, msg.content); setTempEditValue(msg.content); }}
                            className="p-1.5 text-text-light/30 hover:text-cta hover:bg-cta/5 rounded-lg transition-all"
                            title="编辑消息"
                        >
                            <PencilLine size={14} />
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex gap-4 items-start group/msg">
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
                        {msg.content.split('\n\n').map((block: string, idx: number) => {
                            if (block.startsWith('### ')) return <h3 key={idx} className="text-base font-bold text-cta mt-4 mb-2">{block.replace('### ', '')}</h3>;
                            if (block.startsWith('#### ')) return <h4 key={idx} className="font-semibold text-text-light dark:text-text-dark mt-3 mb-1">{block.replace('#### ', '')}</h4>;
                            if (block.startsWith('- ') || block.startsWith('* ')) return (
                                <ul key={idx} className="list-disc pl-5 space-y-1 my-2">
                                    {block.split('\n').map((li: string, i: number) => <li key={i}>{li.replace(/^[-*] /, '')}</li>)}
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
                    <div className="mt-4 rounded-xl border border-cta/30 bg-cta/5 overflow-hidden shadow-sm animate-in fade-in slide-in-from-top-2">
                        <button 
                            onClick={() => setRecommendationOpen(!recommendationOpen)}
                            className="w-full px-4 py-2 border-b border-cta/10 flex items-center justify-between bg-cta/10 hover:bg-cta/20 transition-colors group"
                        >
                            <div className="flex items-center gap-2">
                                <Wrench size={14} className="text-cta" />
                                <span className="text-[11px] font-bold uppercase tracking-widest text-cta">参数修改建议</span>
                            </div>
                            {recommendationOpen ? <ChevronUp size={14} className="text-cta/40" /> : <ChevronDown size={14} className="text-cta/40" />}
                        </button>
                        
                        {recommendationOpen && (
                            <div className="p-4 space-y-4">
                                <ParameterDiffViewer modifications={msg.modifications} />
                                
                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={onDownloadPresets}
                                        disabled={!hasPreset}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-cta text-white text-xs font-bold rounded-xl hover:bg-cta-hover shadow-md shadow-cta/20 transition-all disabled:opacity-40 disabled:scale-100 active:scale-95"
                                    >
                                        <Download size={14} />
                                        下载修复后的预设包
                                    </button>
                                    <button
                                        onClick={() => alert('PDF 导出功能即将推出 (PDF Export coming soon)')}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-secondary/20 text-secondary text-xs font-bold rounded-xl hover:bg-secondary/5 transition-all active:scale-95"
                                    >
                                        <Download size={14} />
                                        下载对比 PDF
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Action buttons */}
                {!msg.isStreaming && (
                    <div className="flex gap-2 flex-wrap pt-2">
                        {/* Smart Help Button: Only show if preset is present, NOT welcome message, NOT streaming, AND content seems relevant */}
                        {hasPreset && msg.id !== 'welcome' && (msg.content.includes('参数') || msg.content.includes('优化') || msg.content.includes('建议') || msg.content.includes('切片')) && (
                            <button
                                onClick={() => onRequestModifications(msg.id)}
                                className="flex items-center gap-2 px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg border border-cta/20 text-cta bg-cta/5 hover:bg-cta/10 transition-all shadow-sm"
                            >
                                <Wrench size={13} />
                                帮我修改预设参数
                            </button>
                        )}
                        
                        <button className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg border border-secondary/10 text-text-light/30 hover:text-text-light dark:hover:text-text-dark transition-all">
                            复制回答
                        </button>

                        {/* Regenerate: Only for last AI message, NOT welcome message */}
                        {isLast && !isUser && msg.id !== 'welcome' && (
                            <button 
                                onClick={() => onRegenerate(msg.id)}
                                className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg border border-secondary/10 text-text-light/30 hover:text-cta hover:border-cta/20 hover:bg-cta/5 transition-all group"
                            >
                                <RotateCcw size={13} className="text-text-light/30 group-hover:text-cta" />
                                重新生成
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
interface AIChatPageProps {
    currentSessionId: string | null;
    onSessionChange: (id: string | null) => void;
}

export const AIChatPage: React.FC<AIChatPageProps> = ({ currentSessionId, onSessionChange }) => {
    const [messages, setMessages] = useState<UIMessage[]>([{
        id: 'welcome',
        role: 'assistant',
        content: '你好！我是 FDM 3D 打印 AI 顾问。\n\n我可以帮助你：\n- 诊断打印缺陷（拉丝、翘边、层分离等）\n- 优化切片参数\n- 分析你上传的打印图片\n- 根据你的预设给出具体参数建议\n\n你可以上传图片或预设文件，然后直接提问！',
    }]);
    const [input, setInput] = useState('');
    const [pendingImage, setPendingImage] = useState<{ base64: string; previewUrl: string } | null>(null);
    const [presetFileName, setPresetFileName] = useState<string | null>(null);
    const [pendingFiles, setPendingFiles] = useState<{ name: string; size: number; content: string }[]>([]);
    const [modifications, setModifications] = useState<Modification[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [showDiffPanel, setShowDiffPanel] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDefectModalOpen, setIsDefectModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

    // Initialized from hook inlining
    const [bundle, setBundle] = useState<ParsedBundle | null>(null);
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    const [parseError, setParseError] = useState<any>(null);
    const [isParsingPreset, setIsParsingPreset] = useState(false);
    const [selection, setSelection] = useState<PresetSelection>({
        printer: null,
        process: null,
        filaments: [],
        defectFilaments: []
    });

    // ─── 1.5 Refs ─────────────────────────────────────────────────────────
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const presetInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // ─── 2. Callbacks (Fixed Order) ───────────────────────────────────────
    const handleScroll = useCallback(() => {
        if (!scrollContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
        setShouldAutoScroll(isNearBottom);
    }, []);

    const restoreBundle = useCallback((newBundle: any, newSelection: any) => {
        setBundle(newBundle);
        setSelection(newSelection);
    }, []);

    const parsePresetFile = useCallback(async (file: File) => {
        setIsParsingPreset(true);
        setParseError(null);
        setBundle(null);
        setSelection({ printer: null, process: null, filaments: [], defectFilaments: [] });

        try {
            const zip = await JSZip.loadAsync(file);
            const bundleFile = zip.file('bundle_structure.json');
            if (!bundleFile) throw new Error('缺少 bundle_structure.json');
            const bundleJson = JSON.parse(await bundleFile.async('text'));
            
            async function readPresets(paths: string[]): Promise<any[]> {
                const results: any[] = [];
                for (const p of paths) {
                    const f = zip.file(p);
                    if (!f) continue;
                    try {
                        const text = await f.async('text');
                        const data = JSON.parse(text);
                        results.push({ name: data.name || data.print_settings_id || p, path: p, data });
                    } catch {
                        results.push({ name: p, path: p, data: {} });
                    }
                }
                return results;
            }

            const [printers, filaments, processes] = await Promise.all([
                readPresets(bundleJson.printer_config || []),
                readPresets(bundleJson.filament_config || []),
                readPresets(bundleJson.process_config || []),
            ]);

            const parsed: ParsedBundle = {
                format: (file.name.endsWith('.bbscfg') ? 'bambu' : 'orca') as 'bambu' | 'orca',
                bundleId: bundleJson.bundle_id || file.name,
                printers,
                filaments,
                processes,
            };
            setBundle(parsed);
            setIsParsingPreset(false);
            return parsed;
        } catch (e: any) {
            setParseError({ type: 'parse_error', message: e.message });
            setIsParsingPreset(false);
            return null;
        }
    }, []);

    const updateSelection = useCallback((patch: any) => {
        setSelection((prev: any) => {
            const next = { ...prev, ...patch };
            if (next.filaments.length <= 1) {
                next.defectFilaments = next.filaments.length === 1 ? [next.filaments[0]] : [];
            } else {
                next.defectFilaments = next.defectFilaments.filter((df: any) =>
                    next.filaments.some((f: any) => f.path === df.path)
                );
            }
            return next;
        });
    }, []);

    const validateSelection = useCallback((): string | null => {
        if (!bundle) return '请先上传预设文件。';
        if (!selection.printer) return '请选择机器预设';
        if (!selection.process) return '请选择工艺预设';
        if (selection.filaments.length === 0) return '请至少选择一个材料预设';
        if (selection.filaments.length > 1 && selection.defectFilaments.length === 0) {
            return '多色打印请标记产生缺陷的材料';
        }
        return null;
    }, [bundle, selection]);

    // ─── 3. Effects (Fixed Order) ─────────────────────────────────────────
    // Load session
    useEffect(() => {
        if (currentSessionId) {
            const session = chatStorage.getSession(currentSessionId);
            if (session) {
                setMessages(session.messages);
                setModifications(session.modifications || []);
                setPresetFileName(session.presetFileName || null);
                if (session.selection && session.bundle) {
                    restoreBundle(session.bundle, session.selection);
                }
            }
        } else {
            setMessages([{
                id: 'welcome',
                role: 'assistant',
                content: '你好！我是 FDM 3D 打印 AI 顾问。\n\n我可以帮助你：\n- 诊断打印缺陷（拉丝、翘边、层分离等）\n- 优化切片参数\n- 分析你上传的打印图片\n- 根据你的预设给出具体参数建议\n\n你可以上传图片或预设文件，然后直接提问！',
            }]);
            setModifications([]);
            setPresetFileName(null);
            setPendingFiles([]);
            setPendingImage(null);
        }
    }, [currentSessionId, restoreBundle]);

    // Auto-save
    useEffect(() => {
        if (!currentSessionId && messages.length <= 1) return;
        if (currentSessionId) {
            const currentData = chatStorage.getSession(currentSessionId);
            const sessionData: ChatSessionData = {
                id: currentSessionId,
                title: currentData?.title || messages.find(m => m.role === 'user')?.content.substring(0, 30) || '新对话',
                timestamp: Date.now(),
                messages,
                modifications,
                selection,
                bundle,
                presetFileName
            };
            chatStorage.saveSession(sessionData);
        }
    }, [messages, modifications, selection, bundle, presetFileName, currentSessionId]);

    // Scroll effect
    useEffect(() => {
        if (shouldAutoScroll && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, shouldAutoScroll]);

    // Auto-resize effect
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
        }
    }, [input]);

    // ─── 4. Memos (Fixed Order) ───────────────────────────────────────────
    const presetValidationError = useMemo(() => {
        if (!bundle) return null;
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

    // ─── Generic File (Text) Handler ───────────────────────────────────────────
    const handleGenericFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        
        const newFiles: { name: string; size: number; content: string }[] = [];
        
        for (const file of files) {
            try {
                const text = await (file as any).text();
                // Basic truncation to prevent overflowing context unexpectedly
                const content = text.length > 50000 ? text.substring(0, 50000) + '\n...[Truncated]' : text;
                newFiles.push({ name: file.name, size: file.size, content });
            } catch (err) {
                console.error(`Failed to read file ${file.name}:`, err);
                alert(`无法读取文件 ${file.name}`);
            }
        }
        
        if (newFiles.length > 0) {
            setPendingFiles(prev => [...prev, ...newFiles]);
        }
        e.target.value = '';
    };

    // ─── Send message ─────────────────────────────────────────────────────
    const sendMessage = useCallback(async (text: string, requestMods = false, overrideHistory?: UIMessage[]) => {
        if ((!text.trim() && !pendingImage && pendingFiles.length === 0) || presetValidationError) return;
        if (isStreaming) return;

        // NEW: If no session ID, generate a new one
        let sessionId = currentSessionId;
        if (!sessionId) {
            sessionId = `chat-${Date.now()}`;
            onSessionChange(sessionId);
        }

        const currentSettings = loadApiSettings();
        if (pendingImage && !isVisionModel(currentSettings.model_name)) {
            alert(`当前选中的模型 [${currentSettings.model_name}] 不支持图片视觉分析，请在设置中切换为视觉模型（如 glm-4.6v-flash）。`);
            return;
        }

        // Construct internal file text for LLM context
        let internalContextText = '';
        if (pendingFiles.length > 0) {
            internalContextText = pendingFiles.map(f => `--- 内容附件: ${f.name} ---\n${f.content}\n--- 附件结束 ---\n`).join('\n');
        }

        const finalContentToSend = internalContextText ? `${internalContextText}\n${text}` : text;

        const userMsg: UIMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: text, // Only show the typed text in the UI bubble
            imagePreviewUrl: pendingImage?.previewUrl,
            attachedFiles: pendingFiles.length > 0 ? pendingFiles.map(f => ({ name: f.name, size: f.size })) : undefined,
            presetName: presetFileName || undefined,
        };

        const aiMsgId = `ai-${Date.now()}`;
        const aiMsg: UIMessage = {
            id: aiMsgId,
            role: 'assistant',
            content: '',
            thought: undefined,
            isStreaming: true,
        };

        const newMessages = overrideHistory ? [...overrideHistory, userMsg, aiMsg] : [...messages, userMsg, aiMsg];
        setMessages(newMessages);
        setInput('');
        setEditingId(null);
        const capturedImage = pendingImage;
        const capturedFinalContent = finalContentToSend;
        setPendingImage(null);
        setPendingFiles([]); // Clear pending files from input area
        setPresetFileName(null); // Clear preset visual from input, but keep `bundle` state for generation
        // Note: we don't clear `bundle/selection` here because they are needed for generating the next response and potentially future actions
        setIsStreaming(true);

        const apiUserMsg: ChatMessage = { role: 'user', content: capturedFinalContent };

        const baseHistory: ChatMessage[] = (overrideHistory ? [...overrideHistory] : [...messages])
            .filter(m => !m.isStreaming)
            .map(m => {
                // If the historical message had files, its content already includes it, or we should re-inject it if we stored it separately.
                // However, we didn't store the raw text with files in `messages`, only the user's typed text.
                // To keep it simple and avoid context explosion, we only inject the file content for the CURRENT message.
                // Previous attachments' raw text is lost on page reload or just not sent in history.
                // Given the typical use case, sending the file in the current prompt is usually sufficient, 
                // but for true ChatGPT behavior, we'd need to store `internalContent` in `UIMessage`.
                // Let's rely on the LLM's memory or just standard text for history for now to avoid complexity,
                // BUT for the *current* user message we definitely use `apiUserMsg`.
                return { role: m.role, content: m.content };
            });
            
        const history: ChatMessage[] = [...baseHistory, apiUserMsg];

        const presetData = selection ? {
            slicer: bundle?.format,
            printer: selection.printer?.data || {},
            process: selection.process?.data || {},
            filament: selection.filaments.map((f: RawPreset) => f.data),
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
                        // Auto-open side panel disabled per user request
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

    const handleEditMessage = useCallback((msgId: string, newContent: string) => {
        const idx = messages.findIndex(m => m.id === msgId);
        if (idx === -1) return;
        const history = messages.slice(0, idx);
        sendMessage(newContent, false, history);
    }, [messages, sendMessage]);

    const handleRegenerate = useCallback((msgId: string) => {
        const idx = messages.findIndex(m => m.id === msgId);
        if (idx === -1) return;
        // Find last user message before this AI message
        const userMsg = messages.slice(0, idx).reverse().find(m => m.role === 'user');
        if (!userMsg) return;
        const history = messages.slice(0, messages.findIndex(m => m.id === userMsg.id));
        sendMessage(userMsg.content, false, history);
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
        
        const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
        
        // Chrome-compatible download: use File System Access API if available
        if ('showSaveFilePicker' in window) {
            try {
                const handle = await (window as any).showSaveFilePicker({
                    suggestedName: 'fixed_presets.zip',
                    types: [{
                        description: 'ZIP Archive',
                        accept: { 'application/zip': ['.zip'] },
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                return;
            } catch (err: any) {
                // User cancelled the picker — silently return
                if (err?.name === 'AbortError') return;
                // API failed, fall through to fallback
            }
        }
        
        // Fallback: classic anchor download
        const url = URL.createObjectURL(new Blob([blob], { type: 'application/zip' }));
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.setAttribute('download', 'fixed_presets.zip');
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 200);
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
            <input ref={presetInputRef} type="file" accept=".bbscfg,.orca_printer,.zip" className="hidden" onChange={handlePresetFile} />
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
            <input ref={fileInputRef} type="file" multiple accept=".txt,.json,.csv,.md,.gcode,.log,.xml" className="hidden" onChange={handleGenericFile} />

            {/* ─── Chat Area ─── */}
            <div className="flex-1 flex flex-col relative h-full">
                {/* Messages List - Absolute scrollable area */}
                <div 
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto pt-8 pb-[40vh] custom-scrollbar relative"
                >
                    <div className="max-w-4xl mx-auto w-full space-y-8 px-4 sm:px-6">
                        {messages.map((msg, idx) => (
                            <MessageBubble
                                key={msg.id}
                                msg={msg}
                                onRequestModifications={handleRequestModifications}
                                onDownloadPresets={handleDownloadPresets}
                                onEdit={handleEditMessage}
                                onRegenerate={handleRegenerate}
                                hasPreset={hasPreset}
                                isLast={idx === messages.length - 1}
                                editingId={editingId}
                                onStartEdit={(id) => setEditingId(id)}
                                onCancelEdit={() => setEditingId(null)}
                            />
                        ))}
                    </div>
                    <div ref={messagesEndRef} />
                </div>

                {/* Sticky Input Area at Bottom */}
                <div className="absolute bottom-0 left-0 right-0 px-6 pb-6 pt-10 bg-gradient-to-t from-background-light dark:from-background-dark via-background-light/95 dark:via-background-dark/95 to-transparent pointer-events-none">
                    <div className="max-w-4xl mx-auto w-full pointer-events-auto">
                        
                        {/* Previews (Image, Files, Presets) moved just above the input box */}
                        {(pendingImage || presetFileName || pendingFiles.length > 0) && (
                            <div className="flex flex-wrap gap-3 mb-3 animate-in fade-in slide-in-from-bottom-2 px-6">
                                {pendingImage && (
                                    <div className="relative group/img flex-shrink-0">
                                        <img 
                                            src={pendingImage.previewUrl} 
                                            alt="Preview" 
                                            className="w-16 h-16 object-cover rounded-xl border-2 border-cta/20 shadow-lg"
                                        />
                                        <button 
                                            onClick={() => setPendingImage(null)}
                                            className="absolute -top-2 -right-2 p-1 bg-background-dark text-white rounded-full shadow-md hover:bg-cta transition-colors opacity-0 group-hover/img:opacity-100"
                                        >
                                            <X size={10} />
                                        </button>
                                    </div>
                                )}
                                {presetFileName && (
                                    <div className="relative group/preset flex items-center gap-2 px-3 py-2 bg-cta/10 border border-cta/20 rounded-xl shadow-sm h-16 max-w-xs">
                                        <FileArchive size={20} className="text-cta shrink-0" />
                                        <div className="min-w-0 pr-2">
                                            <p className="text-[10px] font-bold text-cta truncate uppercase tracking-tight">已选预设</p>
                                            <p className="text-xs text-cta/80 truncate font-medium title={presetFileName}">{presetFileName}</p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0 ml-auto border-l border-cta/20 pl-2">
                                            <button onClick={() => setIsModalOpen(true)} className="p-1.5 rounded hover:bg-cta/10 text-cta" title="修改配置">
                                                <Settings size={14} />
                                            </button>
                                            <button 
                                                onClick={() => { setPresetFileName(null); updateSelection({ printer: null, process: null, filaments: [], defectFilaments: [] }); }} 
                                                className="p-1.5 rounded hover:bg-cta/10 text-cta"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {pendingFiles.map((f, idx) => (
                                    <div key={idx} className="relative group/file flex items-center gap-2 px-3 py-2 bg-secondary/5 border border-secondary/20 rounded-xl shadow-sm h-16 max-w-xs pr-8 text-text-light dark:text-text-dark">
                                        <FileText size={20} className="shrink-0 opacity-60" />
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold opacity-60 truncate uppercase tracking-tight">附件</p>
                                            <p className="text-xs truncate font-medium" title={f.name}>{f.name}</p>
                                            <p className="text-[10px] opacity-40">{formatFileSize(f.size)}</p>
                                        </div>
                                        <button 
                                            onClick={() => setPendingFiles(prev => prev.filter((_, i) => i !== idx))} 
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-secondary/10 opacity-0 group-hover/file:opacity-100 transition-opacity"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Gemini-style pill container */}
                        <div className="bg-white dark:bg-secondary/10 border border-secondary/20 rounded-[32px] shadow-xl flex flex-col focus-within:border-cta/40 focus-within:ring-4 focus-within:ring-cta/10 transition-all">
                            {/* Text Input Row */}
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="描述您的问题或上传预设..."
                                disabled={isStreaming}
                                rows={1}
                                className="w-full bg-transparent px-6 pt-5 pb-2 text-base text-text-light dark:text-text-dark placeholder-text-light/40 dark:placeholder-text-dark/40 resize-none outline-none disabled:opacity-50 font-body leading-relaxed min-h-[60px] max-h-[300px]"
                            />

                            {/* Actions Row (Attachments, Model, Send) */}
                            <div className="flex items-center justify-between px-4 pb-3 pt-1">
                                {/* Left: Attachments */}
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => imageInputRef.current?.click()}
                                        disabled={isStreaming}
                                        className="p-2.5 rounded-full text-text-light/60 hover:text-cta hover:bg-cta/5 transition-all relative group"
                                        title="上传图片"
                                    >
                                        <ImageIcon size={20} />
                                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-1.5 bg-secondary/95 backdrop-blur-sm shadow-xl text-white text-xs rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap z-50 border border-white/10">
                                            上传图片 (支持 JPG, PNG, WebP 格式)
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => presetInputRef.current?.click()}
                                        disabled={isStreaming || isParsingPreset}
                                        className="p-2.5 rounded-full text-text-light/60 hover:text-cta hover:bg-cta/5 transition-all relative group"
                                        title="上传参数预设包"
                                    >
                                        {isParsingPreset ? <Loader2 size={18} className="animate-spin text-cta" /> : <Package size={18} />}
                                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-1.5 bg-secondary/95 backdrop-blur-sm shadow-xl text-white text-xs rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap z-50 border border-white/10">
                                            上传参数预设包 (支持 .bbscfg, .orca_printer, .zip)
                                        </span>
                                    </button>
                                    <div className="w-px h-4 bg-secondary/10 mx-1"></div>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isStreaming}
                                        className="p-2.5 rounded-full text-text-light/60 hover:text-cta hover:bg-cta/5 transition-all relative group"
                                        title="上传附件文档"
                                    >
                                        <Paperclip size={18} />
                                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-1.5 bg-secondary/95 backdrop-blur-sm shadow-xl text-white text-xs rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap z-50 border border-white/10">
                                            上传附件文档 (支持 .txt, .json, .gcode, .log 等)
                                        </span>
                                    </button>

                                </div>

                                {/* Right: Model Selection & Send */}
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setIsDefectModalOpen(true)}
                                        className="p-2.5 rounded-full text-text-light/60 hover:text-cta hover:bg-cta/5 transition-all relative group"
                                        title="打印缺陷识别"
                                    >
                                        <Scan size={18} />
                                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-1.5 bg-secondary/95 backdrop-blur-sm shadow-xl text-white text-xs rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap z-50 border border-white/10">
                                            打印缺陷识别 (上传图片进入实时识别模式)
                                        </span>
                                    </button>
                                    
                                    {/* Model Selector Indicator */}
                                    <button 
                                        onClick={() => setIsSettingsOpen(true)}
                                        className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-bold text-cta hover:bg-cta/15 bg-cta/10 rounded-full transition-all border border-cta/20 shadow-sm"
                                    >
                                        <Sparkles size={14} className="text-cta" />
                                        <span>{loadApiSettings().model_name}</span>
                                        <ChevronDown size={14} />
                                    </button>

                                    <div className="flex items-center gap-2">
                                        {presetValidationError && (
                                            <div className="group relative">
                                                <AlertTriangle size={20} className="text-yellow-500 animate-pulse" />
                                                <span className="absolute bottom-full right-0 mb-2 w-48 px-3 py-2 bg-background-dark text-white text-[10px] rounded shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 border border-yellow-500/30">
                                                    预设选择不完整或不匹配，请点击预设文件修正后再发送。
                                                </span>
                                            </div>
                                        )}
                                        <button
                                            onClick={() => sendMessage(input)}
                                            disabled={isStreaming || (!input.trim() && !pendingImage && pendingFiles.length === 0) || !!presetValidationError}
                                            className={`p-2.5 rounded-full transition-all shadow-md ${
                                                isStreaming || (!input.trim() && !pendingImage && pendingFiles.length === 0) || !!presetValidationError
                                                    ? 'bg-secondary/20 text-text-light/20 cursor-not-allowed border border-secondary/10'
                                                    : 'bg-cta text-white hover:bg-cta-hover hover:scale-105 active:scale-95 shadow-lg shadow-cta/20'
                                            }`}
                                        >
                                            {isStreaming ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                                        </button>
                                    </div>
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

            <DefectRecognitionModal 
                isOpen={isDefectModalOpen}
                onClose={() => setIsDefectModalOpen(false)}
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
