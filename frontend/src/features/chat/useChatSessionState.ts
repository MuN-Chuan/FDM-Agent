import { useEffect, useState } from 'react';

import { api } from '../../api/api';
import type { Modification, ThreeMFParseResult } from '../../api/api';
import { chatStorage } from '../../api/chatStorage';
import type { ChatSessionData, ChatUIMessage } from './chatSessionTypes';
import type { ParsedBundle, PresetSelection } from '../diagnosis/presetTypes';

interface UseChatSessionStateParams {
    currentSessionId: string | null;
    bundle: ParsedBundle | null;
    selection: PresetSelection;
    resetPresetState: () => void;
    restoreBundle: (bundle: ParsedBundle, selection: PresetSelection) => void;
    createWelcomeMessage: () => ChatUIMessage;
}

export function useChatSessionState({
    currentSessionId,
    bundle,
    selection,
    resetPresetState,
    restoreBundle,
    createWelcomeMessage,
}: UseChatSessionStateParams) {
    const [messages, setMessages] = useState<ChatUIMessage[]>([createWelcomeMessage()]);
    const [input, setInput] = useState('');
    const [pendingImage, setPendingImage] = useState<{ base64: string; previewUrl: string } | null>(null);
    const [pendingSlicerResult, setPendingSlicerResult] = useState<ThreeMFParseResult | null>(null);
    const [presetFileName, setPresetFileName] = useState<string | null>(null);
    const [modifications, setModifications] = useState<Modification[]>([]);
    const [paramCategoryMap, setParamCategoryMap] = useState<Record<string, string[]> | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);

    useEffect(() => {
        if (!bundle?.format) {
            setParamCategoryMap(null);
            return;
        }

        void api
            .getParameterMap(bundle.format)
            .then(setParamCategoryMap)
            .catch(() => setParamCategoryMap(null));
    }, [bundle?.format]);

    useEffect(() => {
        let cancelled = false;

        if (!currentSessionId) {
            setMessages([createWelcomeMessage()]);
            setModifications([]);
            setPendingImage(null);
            setPendingSlicerResult(null);
            setPresetFileName(null);
            resetPresetState();

            return () => {
                cancelled = true;
            };
        }

        void (async () => {
            const session = await chatStorage.getSession(currentSessionId);
            if (!session || cancelled) {
                return;
            }

            setMessages(session.messages);
            setModifications(session.modifications ?? []);
            setPresetFileName(session.presetFileName ?? null);

            if (session.bundle && session.selection) {
                restoreBundle(session.bundle, session.selection);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [currentSessionId, createWelcomeMessage, resetPresetState, restoreBundle]);

    useEffect(() => {
        if (!currentSessionId || messages.length <= 1) {
            return;
        }

        const title = messages.find((message) => message.role === 'user')?.content.slice(0, 30) || 'New chat';
        const payload: ChatSessionData = {
            id: currentSessionId,
            title,
            timestamp: Date.now(),
            messages,
            modifications,
            selection,
            bundle,
            presetFileName,
        };

        void chatStorage.saveSession(payload);
    }, [bundle, currentSessionId, messages, modifications, presetFileName, selection]);

    return {
        messages,
        setMessages,
        input,
        setInput,
        pendingImage,
        setPendingImage,
        pendingSlicerResult,
        setPendingSlicerResult,
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
    };
}
