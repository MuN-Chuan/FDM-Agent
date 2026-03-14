import type { Modification } from './api';

export interface ChatSessionMetadata {
    id: string;
    title: string;
    timestamp: number;
}

export interface ChatSessionData extends ChatSessionMetadata {
    messages: any[]; // Use any for now or import UIMessage if possible (but UIMessage is inside AIChatPage)
    // To avoid circular dependency or complex imports, we'll use a generic object for data
    modifications: Modification[];
    selection: any;
    bundle: any;
    presetFileName: string | null;
}

const METADATA_KEY = 'fdm_chat_sessions_metadata';
const SESSION_PREFIX = 'fdm_chat_session_';

export const chatStorage = {
    listSessions(): ChatSessionMetadata[] {
        const raw = localStorage.getItem(METADATA_KEY);
        if (!raw) return [];
        try {
            return JSON.parse(raw).sort((a: ChatSessionMetadata, b: ChatSessionMetadata) => b.timestamp - a.timestamp);
        } catch {
            return [];
        }
    },

    getSession(id: string): ChatSessionData | null {
        const raw = localStorage.getItem(SESSION_PREFIX + id);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    },

    saveSession(data: ChatSessionData) {
        // Save full data
        localStorage.setItem(SESSION_PREFIX + data.id, JSON.stringify(data));

        // Update metadata list
        const metadataList = this.listSessions();
        const existingIdx = metadataList.findIndex(m => m.id === data.id);
        const meta: ChatSessionMetadata = {
            id: data.id,
            title: data.title,
            timestamp: data.timestamp
        };

        if (existingIdx >= 0) {
            metadataList[existingIdx] = meta;
        } else {
            metadataList.unshift(meta);
        }

        localStorage.setItem(METADATA_KEY, JSON.stringify(metadataList));
    },

    deleteSession(id: string) {
        localStorage.removeItem(SESSION_PREFIX + id);
        const metadataList = this.listSessions().filter(m => m.id !== id);
        localStorage.setItem(METADATA_KEY, JSON.stringify(metadataList));
    }
};
