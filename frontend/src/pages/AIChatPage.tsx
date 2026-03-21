import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';

import { api } from '../api/api';
import type { ChatMessage, Modification } from '../api/api';
import { loadApiSettings } from '../api/apiSettings';
import { ChatComposer } from '../components/chat/ChatComposer';
import { ChatMessageList } from '../components/chat/ChatMessageList';
import type { ChatUIMessage } from '../features/chat/chatSessionTypes';
import { useChatSessionState } from '../features/chat/useChatSessionState';
import { ApiSettingsModal } from '../features/diagnosis/ApiSettingsModal';
import { DefectRecognitionModal } from '../features/diagnosis/DefectRecognitionModal';
import { PresetSelectionModal } from '../features/diagnosis/PresetSelectionModal';
import { usePresetParser } from '../features/diagnosis/usePresetParser';
import { useI18n } from '../i18n/I18nProvider';

interface AIChatPageProps {
    currentSessionId: string | null;
    onSessionChange: (id: string | null) => void;
}

const isVisionModel = (modelName: string) => {
    const value = modelName.toLowerCase();
    return value.includes('vision') || value.includes('gpt-4o') || value.includes('gemini') || value.includes('vl');
};

const applyRename = (name: string) => `fix_${name}`;

interface PendingFile {
    name: string;
    size: number;
    content: string;
}

export const AIChatPage: React.FC<AIChatPageProps> = ({ currentSessionId, onSessionChange }) => {
    const { t } = useI18n();
    const {
        bundle,
        isParsing: isParsingPreset,
        selection,
        parsePresetFile,
        updateSelection,
        validateSelection,
        restoreBundle,
        resetPresetState,
    } = usePresetParser();

    const createWelcomeMessage = useCallback(
        (): ChatUIMessage => ({
            id: 'welcome',
            role: 'assistant',
            content: t('chat.welcome'),
        }),
        [t],
    );

    const {
        messages,
        setMessages,
        input,
        setInput,
        pendingImage,
        setPendingImage,
        presetFileName,
        setPresetFileName,
        modifications,
        setModifications,
        paramCategoryMap,
        isStreaming,
        setIsStreaming,
        isSettingsOpen,
        setIsSettingsOpen,
        isPresetModalOpen,
        setIsPresetModalOpen,
    } = useChatSessionState({
        currentSessionId,
        bundle,
        selection,
        resetPresetState,
        restoreBundle,
        createWelcomeMessage,
    });

    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
    const [isDefectModalOpen, setIsDefectModalOpen] = useState(false);

    const imageInputRef = useRef<HTMLInputElement>(null);
    const presetInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (!textareaRef.current) {
            return;
        }

        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }, [input]);

    const presetValidationError = useMemo(() => (bundle ? validateSelection() : null), [bundle, validateSelection]);
    const modelName = loadApiSettings().model_name;

    const handleImageFile = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = String(reader.result);
            setPendingImage({ base64: dataUrl.split(',')[1], previewUrl: dataUrl });
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    };

    const handlePresetFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        setPresetFileName(file.name);
        const parsed = await parsePresetFile(file);
        if (parsed) {
            setIsPresetModalOpen(true);
        } else {
            setPresetFileName(null);
        }
        event.target.value = '';
    };

    const handleGenericFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        if (files.length === 0) {
            return;
        }

        const nextFiles: PendingFile[] = [];
        for (const file of files) {
            try {
                const text = await file.text();
                nextFiles.push({
                    name: file.name,
                    size: file.size,
                    content: text.length > 50000 ? `${text.slice(0, 50000)}\n...[Truncated]` : text,
                });
            } catch (error) {
                console.error(`Failed to read file ${file.name}`, error);
            }
        }

        setPendingFiles((current) => [...current, ...nextFiles]);
        event.target.value = '';
    };

    const handleDownloadPresets = useCallback(
        async (mods?: Modification[]) => {
            const targetMods = mods || modifications;
            if (!selection || targetMods.length === 0) {
                return;
            }

            const zip = new JSZip();
            const applyMods = (
                preset: Record<string, unknown>,
                name: string,
                category: 'process' | 'filament' | 'printer',
            ) => {
                const nextData = JSON.parse(JSON.stringify(preset)) as Record<string, unknown>;
                let hasChanges = false;

                for (const mod of targetMods) {
                    const matchesMap = paramCategoryMap?.[category]?.includes(mod.name) ?? false;
                    const matchesFallback = mod.category?.toLowerCase() === category || mod.name in nextData;
                    if (!matchesMap && !matchesFallback) {
                        continue;
                    }
                    nextData[mod.name] = mod.new;
                    hasChanges = true;
                }

                if (!hasChanges) {
                    return null;
                }

                nextData.name = applyRename(name);
                return nextData;
            };

            if (selection.process) {
                const result = applyMods(selection.process.data as Record<string, unknown>, selection.process.name, 'process');
                if (result) {
                    zip.file(`${result.name as string}.json`, JSON.stringify(result, null, 2));
                }
            }

            selection.filaments.forEach((filament) => {
                const result = applyMods(filament.data as Record<string, unknown>, filament.name, 'filament');
                if (result) {
                    zip.file(`${result.name as string}.json`, JSON.stringify(result, null, 2));
                }
            });

            if (selection.printer) {
                const result = applyMods(selection.printer.data as Record<string, unknown>, selection.printer.name, 'printer');
                if (result) {
                    zip.file(`${result.name as string}.json`, JSON.stringify(result, null, 2));
                }
            }

            if (Object.keys(zip.files).length === 0) {
                return;
            }

            const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'fixed_presets.zip';
            link.click();
            URL.revokeObjectURL(url);
        },
        [modifications, paramCategoryMap, selection],
    );

    const sendMessage = useCallback(
        async (
            text: string,
            requestModifications = false,
            overrideHistory?: ChatUIMessage[],
            overrideFiles?: PendingFile[],
        ) => {
            const activeFiles = overrideFiles ?? pendingFiles;

            if (isStreaming || presetValidationError) {
                return;
            }
            if (!text.trim() && !pendingImage && activeFiles.length === 0) {
                return;
            }

            const apiSettings = loadApiSettings();
            if (pendingImage && !isVisionModel(apiSettings.model_name)) {
                alert(t('chat.modelNoVision', { model: apiSettings.model_name }));
                return;
            }

            const internalContextText =
                activeFiles.length > 0
                    ? activeFiles
                          .map(
                              (file) =>
                                  `--- ${t('chat.internalAttachmentStart')}: ${file.name} ---\n${file.content}\n--- ${t('chat.internalAttachmentEnd')} ---`,
                          )
                          .join('\n\n')
                    : '';
            const finalContentToSend = internalContextText ? `${internalContextText}\n\n${text}` : text;

            if (!currentSessionId) {
                onSessionChange(`chat-${Date.now()}`);
            }

            const assistantId = `assistant-${Date.now()}`;
            const currentHistory = overrideHistory ?? messages;

            setMessages((current) => [
                ...(overrideHistory ?? current),
                {
                    id: `user-${Date.now()}`,
                    role: 'user',
                    content: text,
                    imagePreviewUrl: pendingImage?.previewUrl,
                    attachedFiles: activeFiles.length > 0 ? activeFiles.map((file) => ({ name: file.name, size: file.size })) : undefined,
                    presetName: presetFileName ?? undefined,
                },
                { id: assistantId, role: 'assistant', content: '', isStreaming: true },
            ]);
            setInput('');
            setIsStreaming(true);

            const imageToSend = pendingImage;
            setPendingImage(null);
            setPresetFileName(null);
            setPendingFiles([]);

            const history: ChatMessage[] = [
                ...currentHistory
                    .filter((message) => !message.isStreaming)
                    .map((message) => ({ role: message.role, content: message.content })),
                { role: 'user', content: finalContentToSend },
            ];

            const presetData = bundle
                ? {
                      printer: selection.printer?.data || {},
                      process: selection.process?.data || {},
                      filament: selection.filaments.map((filament) => filament.data),
                  }
                : undefined;

            let streamedText = '';
            let streamedThought = '';

            try {
                await api.chatStream(
                    {
                        messages: history,
                        image_base64: imageToSend?.base64,
                        preset_data: presetData,
                        api_settings: apiSettings,
                        request_modifications: requestModifications,
                    },
                    (chunk) => {
                        if (chunk.type === 'thought' && chunk.content) {
                            streamedThought += chunk.content;
                            setMessages((current) =>
                                current.map((message) =>
                                    message.id === assistantId ? { ...message, thought: streamedThought } : message,
                                ),
                            );
                            return;
                        }

                        if (chunk.type === 'text' && chunk.content) {
                            streamedText += chunk.content;
                            setMessages((current) =>
                                current.map((message) =>
                                    message.id === assistantId
                                        ? {
                                              ...message,
                                              content: streamedText.replace(/```json_modifications[\s\S]*?```/g, '').trim(),
                                          }
                                        : message,
                                ),
                            );
                            return;
                        }

                        if (chunk.type === 'done') {
                            const nextMods = (chunk.modifications || []) as Modification[];
                            if (nextMods.length > 0) {
                                setModifications(nextMods);
                            }
                            setMessages((current) =>
                                current.map((message) =>
                                    message.id === assistantId
                                        ? {
                                              ...message,
                                              isStreaming: false,
                                              modifications: nextMods.length > 0 ? nextMods : undefined,
                                              usage: chunk.usage,
                                          }
                                        : message,
                                ),
                            );
                            setIsStreaming(false);
                            return;
                        }

                        if (chunk.type === 'error') {
                            const errorMessage = chunk.message || 'Unknown error';
                            setMessages((current) =>
                                current.map((message) =>
                                    message.id === assistantId
                                        ? {
                                              ...message,
                                              content: t('chat.aiServiceError', { message: errorMessage }),
                                              isStreaming: false,
                                          }
                                        : message,
                                ),
                            );
                            setIsStreaming(false);
                        }
                    },
                );
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                setMessages((current) =>
                    current.map((entry) =>
                        entry.id === assistantId
                            ? { ...entry, content: t('chat.connectionError', { message }), isStreaming: false }
                            : entry,
                    ),
                );
                setIsStreaming(false);
            }
        },
        [
            bundle,
            currentSessionId,
            isStreaming,
            messages,
            onSessionChange,
            pendingFiles,
            pendingImage,
            presetFileName,
            presetValidationError,
            selection,
            setInput,
            setIsStreaming,
            setMessages,
            setModifications,
            setPendingImage,
            setPresetFileName,
            t,
        ],
    );

    const handleRequestModifications = useCallback(
        (assistantMessageId: string) => {
            const assistantIndex = messages.findIndex((message) => message.id === assistantMessageId);
            if (assistantIndex === -1) {
                return;
            }

            const userMessage = [...messages.slice(0, assistantIndex)].reverse().find((message) => message.role === 'user');
            if (!userMessage) {
                return;
            }

            const history = messages.slice(0, messages.findIndex((message) => message.id === userMessage.id));
            void sendMessage(userMessage.content, true, history);
        },
        [messages, sendMessage],
    );

    const handleRegenerateMessage = useCallback(
        (assistantMessageId: string) => {
            const assistantIndex = messages.findIndex((message) => message.id === assistantMessageId);
            if (assistantIndex === -1) {
                return;
            }

            const userMessage = [...messages.slice(0, assistantIndex)].reverse().find((message) => message.role === 'user');
            if (!userMessage) {
                return;
            }

            const history = messages.slice(0, messages.findIndex((message) => message.id === userMessage.id));
            void sendMessage(userMessage.content, false, history);
        },
        [messages, sendMessage],
    );

    const handleEditMessage = useCallback(
        (messageId: string, content: string) => {
            const userIndex = messages.findIndex((message) => message.id === messageId);
            if (userIndex === -1) {
                return;
            }

            const editedMessage = messages[userIndex];
            const history = messages.slice(0, userIndex);
            const attachedFiles =
                editedMessage.attachedFiles?.map((file) => ({
                    name: file.name,
                    size: file.size,
                    content: '',
                })) ?? [];

            void sendMessage(content, false, history, attachedFiles);
        },
        [messages, sendMessage],
    );

    return (
        <div className="-m-8 relative flex h-[calc(100vh-64px)] overflow-hidden bg-background-light dark:bg-background-dark">
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
            <input
                ref={presetInputRef}
                type="file"
                accept=".bbscfg,.orca_printer,.zip"
                className="hidden"
                onChange={handlePresetFile}
            />
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".txt,.json,.csv,.md,.gcode,.log,.xml"
                className="hidden"
                onChange={handleGenericFile}
            />

            <div className="relative flex min-w-0 flex-1 flex-col">
                <ChatMessageList
                    messages={messages}
                    hasPresetBundle={!!bundle}
                    onDownloadPresets={handleDownloadPresets}
                    onEditMessage={handleEditMessage}
                    onRegenerateMessage={handleRegenerateMessage}
                    onRequestModifications={handleRequestModifications}
                    bottomRef={bottomRef}
                />
                <ChatComposer
                    input={input}
                    isStreaming={isStreaming}
                    isParsingPreset={isParsingPreset}
                    pendingImage={pendingImage}
                    pendingFiles={pendingFiles}
                    presetFileName={presetFileName}
                    presetValidationError={presetValidationError}
                    modelName={modelName}
                    imageInputRef={imageInputRef}
                    presetInputRef={presetInputRef}
                    fileInputRef={fileInputRef}
                    textareaRef={textareaRef}
                    onInputChange={setInput}
                    onSubmit={() => sendMessage(input)}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                    onOpenPresetModal={() => setIsPresetModalOpen(true)}
                    onOpenDefectRecognition={() => setIsDefectModalOpen(true)}
                    onRemovePendingFile={(index) => {
                        setPendingFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
                    }}
                    onClearPreset={() => {
                        setPresetFileName(null);
                        resetPresetState();
                    }}
                />
            </div>

            <ApiSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                onSave={() => setIsSettingsOpen(false)}
            />
            <DefectRecognitionModal isOpen={isDefectModalOpen} onClose={() => setIsDefectModalOpen(false)} />
            <PresetSelectionModal
                isOpen={isPresetModalOpen}
                onClose={() => setIsPresetModalOpen(false)}
                onConfirm={() => setIsPresetModalOpen(false)}
                bundle={bundle}
                selection={selection}
                onUpdateSelection={updateSelection}
                validationError={presetValidationError}
            />
        </div>
    );
};
