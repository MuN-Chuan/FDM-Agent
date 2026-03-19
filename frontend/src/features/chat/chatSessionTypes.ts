import type { Modification, SessionMetadata } from '../../api/api';
import type { ParsedBundle, PresetSelection } from '../diagnosis/presetTypes';

export interface ChatUIMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    imageUrl?: string;
    attachedFiles?: { name: string; size: number }[];
    thought?: string;
    modifications?: Modification[];
    isStreaming?: boolean;
    imagePreviewUrl?: string;
    presetName?: string;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
        cache_tokens?: number;
    };
}

export type ChatSessionMetadata = SessionMetadata;

export interface ChatSessionData extends ChatSessionMetadata {
    messages: ChatUIMessage[];
    modifications: Modification[];
    selection: PresetSelection;
    bundle: ParsedBundle | null;
    presetFileName: string | null;
}
